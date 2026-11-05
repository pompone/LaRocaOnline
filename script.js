const STREAM_URL =
  "https://stream.radiosnethosting.com:8016/stream";
const STATION_NAME = "La Roca Online";

const audio = document.getElementById("radioAudio");
const playBtn = document.getElementById("playBtn");
const playIcon = document.getElementById("playIcon");
const muteBtn = document.getElementById("muteBtn");
const muteIcon = document.getElementById("muteIcon");
const volumeSlider = document.getElementById("volumeSlider");
const volumeValue = document.getElementById("volumeValue");
const statusText = document.getElementById("statusText");
const powerBtn = document.getElementById("powerBtn");
const castButton = document.getElementById("castButton");
const castFallbackBtn = document.getElementById("castFallbackBtn");
const liveDot = document.getElementById("liveDot");
const liveLabel = document.getElementById("liveLabel");
const signalText = document.getElementById("signalText");
let bufferingTimer = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let wantsLocalAudio = false;
const RECONNECT_DELAYS = [3000, 6000, 12000, 20000, 30000];

function cancelReconnect() {
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
}

function scheduleReconnect() {
  if (!poweredOn || !wantsLocalAudio || getCastSession() || reconnectTimer) return;
  const delay = RECONNECT_DELAYS[Math.min(reconnectAttempts, RECONNECT_DELAYS.length - 1)];
  reconnectAttempts++;
  setStreamError();
  setStatus(`Reconectando en ${Math.ceil(delay / 1000)} segundos...`);
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    if (!poweredOn || !wantsLocalAudio || getCastSession()) return;
    try {
      audio.pause();
      audio.load(); // Reinicia una conexión de audio bloqueada.
      await audio.play();
    } catch (error) {
      if (error.name === "NotAllowedError") {
        wantsLocalAudio = false; // Requiere una nueva interacción del oyente.
        setStatus("Tocá Play para continuar escuchando");
        return;
      }
      if (poweredOn && wantsLocalAudio) scheduleReconnect();
    }
  }, delay);
}


let poweredOn = false;
let castReady = false;
let castContext = null;
let isRemotePlaying = false;

audio.crossOrigin = "anonymous"; // Habilita el análisis del stream si el servidor permite CORS.
audio.src = STREAM_URL;
audio.volume = 0.70;

function setStatus(message) {
  statusText.textContent = message;
}

function setPlayingUI(isPlaying, message) {
  clearTimeout(bufferingTimer);
  bufferingTimer = null;
  document.body.classList.remove("stream-error");
  signalText.textContent = "TRANSMITIENDO DESDE LA ROCA ONLINE";
  document.body.classList.toggle("playing", isPlaying);
  playIcon.classList.toggle("is-playing", isPlaying);
  playBtn.setAttribute(
    "aria-label",
    isPlaying ? "Pausar" : "Reproducir"
  );
  liveDot.classList.toggle("off", !isPlaying);
  liveLabel.textContent = isPlaying ? "EN VIVO" : "DETENIDA";

  if (message) setStatus(message);
}

function setStreamError() {
  if (!poweredOn || getCastSession()) return;
  setPlayingUI(false, "Error en la transmisión");
  document.body.classList.add("stream-error");
  signalText.textContent = "ERROR EN LA TRANSMISIÓN";
  liveLabel.textContent = "SIN SEÑAL";
}

function setBuffering() {
  if (!poweredOn || getCastSession() || audio.paused) return;
  document.body.classList.remove("playing", "stream-error");
  signalText.textContent = "CONECTANDO...";
  liveDot.classList.add("off");
  liveLabel.textContent = "CONECTANDO";
  setStatus("Conectando...");
  clearTimeout(bufferingTimer);
  bufferingTimer = setTimeout(() => {
    if (poweredOn && !getCastSession() && !audio.paused && audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
      scheduleReconnect();
    }
  }, 8000);
}

function getCastSession() {
  return castContext?.getCurrentSession() || null;
}

function showCastControl(available) {
  // Usamos un botón propio: el launcher nativo puede ocultarse por su cuenta.
  castButton.classList.add("hidden");
  castFallbackBtn.classList.toggle("hidden", !available);
  castFallbackBtn.title = available
    ? "Elegir dispositivo Chromecast"
    : "Comprobar disponibilidad de Chromecast";
}

async function playLocal() {
  if (!poweredOn) return;
  wantsLocalAudio = true;
  cancelReconnect();
  if (audio.error) audio.load();

  try {
    setStatus("Conectando...");
    await prepareSpectrumAudio();
    await audio.play();

    if (poweredOn && !getCastSession()) {
      setPlayingUI(true, "Reproduciendo");
    } else {
      audio.pause();
    }
  } catch (error) {
    console.error("Error al reproducir:", error);
    if (poweredOn && error.name !== "NotAllowedError") {
      scheduleReconnect();
    } else if (error.name === "NotAllowedError") {
      wantsLocalAudio = false;
      setStatus("Tocá Play para continuar escuchando");
    }
  }
}

function pauseLocal() {
  wantsLocalAudio = false;
  cancelReconnect();
  audio.pause();
  setPlayingUI(false, "Pausada");
}

async function syncCastVolume() {
  const session = getCastSession();
  if (!session) return;

  const value = Number(volumeSlider.value) / 100;

  try {
    await session.setVolume(value);
    await session.setMute(value === 0);
  } catch (error) {
    console.error("No se pudo ajustar el volumen Cast:", error);
  }
}

async function loadStreamOnCast(session) {
  if (!window.chrome?.cast?.media || !session || !poweredOn) {
    return;
  }

  const mediaInfo = new chrome.cast.media.MediaInfo(
    STREAM_URL,
    "audio/mpeg"
  );
  mediaInfo.streamType = chrome.cast.media.StreamType.LIVE;

  const metadata = new chrome.cast.media.MusicTrackMediaMetadata();
  metadata.title = STATION_NAME;
  metadata.artist = "Radio online";
  mediaInfo.metadata = metadata;

  const request = new chrome.cast.media.LoadRequest(mediaInfo);
  request.autoplay = true;

  pauseLocal();
  setStatus("Enviando al dispositivo Cast...");

  try {
    await session.loadMedia(request);
    isRemotePlaying = true;
    setPlayingUI(true, "Reproduciendo por Cast");
    await syncCastVolume();
  } catch (error) {
    console.error("Error de Cast:", error);
    isRemotePlaying = false;
    setPlayingUI(false, "No se pudo enviar el stream al Cast");
  }
}

async function togglePlayback() {
  if (!poweredOn) {
    setStatus("La radio está apagada");
    return;
  }

  const session = getCastSession();

  if (session) {
    const mediaSession = session.getMediaSession();

    if (!mediaSession) {
      await loadStreamOnCast(session);
      return;
    }

    try {
      if (isRemotePlaying) {
        await mediaSession.pause(null);
        isRemotePlaying = false;
        setPlayingUI(false, "Pausada en Cast");
      } else {
        await mediaSession.play(null);
        isRemotePlaying = true;
        setPlayingUI(true, "Reproduciendo por Cast");
      }
    } catch (error) {
      console.error("Error al controlar Cast:", error);
      setStatus("No se pudo controlar la reproducción Cast");
    }

    return;
  }

  if (audio.paused) {
    await playLocal();
  } else {
    pauseLocal();
  }
}

function updateVolumeUI(value) {
  volumeValue.textContent = `${Math.round(value)}%`;
  volumeSlider.style.setProperty("--level", `${value}%`);

  const hue = 210 - value * 1.7;
  volumeSlider.style.setProperty(
    "--level-color",
    `hsl(${hue} 95% 55%)`
  );

  document.body.classList.toggle("is-muted", value === 0);

  muteIcon.classList.toggle("volume-muted", value === 0);
  muteIcon.classList.toggle("volume-low", value > 0 && value < 50);
  muteIcon.classList.toggle("volume-high", value >= 50);
  muteBtn.setAttribute("aria-label", value === 0 ? "Activar sonido" : "Silenciar");
}

function applyVolume(value) {
  const adjusted = Math.max(0, Math.min(100, Number(value)));
  volumeSlider.value = adjusted;
  updateVolumeUI(adjusted);

  if (getCastSession()) {
    void syncCastVolume();
  } else {
    audio.volume = adjusted / 100;
    audio.muted = adjusted === 0;
  }
}

volumeSlider.addEventListener("input", (event) => {
  applyVolume(event.target.value);
});

/* La rueda ajusta el volumen desde cualquier parte de la página. */
document.addEventListener(
  "wheel",
  (event) => {
    if (event.ctrlKey) return;
    const panel = document.getElementById("messagesPanel");
    if (panel && panel.classList.contains("is-open")) return;

    event.preventDefault();
    const change = event.deltaY < 0 ? 5 : -5;
    applyVolume(Number(volumeSlider.value) + change);
  },
  { passive: false }
);

muteBtn.addEventListener("click", () => {
  const current = Number(volumeSlider.value);

  if (current > 0) {
    volumeSlider.dataset.previousVolume = String(current);
    applyVolume(0);
  } else {
    applyVolume(Number(volumeSlider.dataset.previousVolume || 70));
  }
});

playBtn.addEventListener("click", togglePlayback);

powerBtn.addEventListener("click", async () => {
  poweredOn = !poweredOn;
  document.body.classList.toggle("power-off", !poweredOn);
  powerBtn.setAttribute("aria-pressed", String(poweredOn));

  if (!poweredOn) {
    wantsLocalAudio = false;
    cancelReconnect();
    clearTimeout(bufferingTimer);
    audio.pause();

    const mediaSession = getCastSession()?.getMediaSession();
    if (mediaSession) {
      try {
        await mediaSession.stop(null);
      } catch (error) {
        console.error("No se pudo detener Cast:", error);
      }
    }

    isRemotePlaying = false;
    setPlayingUI(false, "Radio apagada");
  } else {
    await togglePlayback();
  }
});

audio.addEventListener("playing", () => {
  if (!getCastSession() && poweredOn) {
    reconnectAttempts = 0;
    cancelReconnect();
    setPlayingUI(true, "Reproduciendo");
  }
});

audio.addEventListener("waiting", setBuffering);
audio.addEventListener("stalled", setBuffering);

audio.addEventListener("error", () => {
  console.error("MediaError:", audio.error);

  if (!getCastSession() && poweredOn && wantsLocalAudio) {
    scheduleReconnect();
  }
});

castFallbackBtn.addEventListener("click", () => {
  if (!castReady) initCast();

  if (!castReady || !castContext) {
    alert(
      "Chromecast no está disponible en este navegador o no se pudo cargar su API. Probá con Chrome o Edge desde la página HTTPS."
    );
    return;
  }

  if (castContext.getCastState() === cast.framework.CastState.NO_DEVICES_AVAILABLE) {
    alert(
      "No se detecta un Chromecast. Comprobá que la computadora y el dispositivo estén en la misma red Wi-Fi."
    );
    return;
  }

  // Se llama directamente desde el clic para conservar la acción del usuario.
  castContext.requestSession().catch((error) => {
    if (error !== chrome.cast.ErrorCode.CANCEL) {
      console.error("No se pudo iniciar Cast:", error);
      alert("No se pudo conectar con Chromecast. Revisá la red y volvé a intentar.");
    }
  });
});

function initCast() {
  if (castReady) return;
  if (!window.cast?.framework || !window.chrome?.cast?.media) {
    return;
  }

  try {
    castContext = cast.framework.CastContext.getInstance();

    castContext.setOptions({
      receiverApplicationId:
        chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
      autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
    });

    castReady = true;

    function refreshCastControl() {
      const state = castContext.getCastState();
      const available =
        state === cast.framework.CastState.NOT_CONNECTED ||
        state === cast.framework.CastState.CONNECTING ||
        state === cast.framework.CastState.CONNECTED;

      showCastControl(available);
    }

    castContext.addEventListener(
      cast.framework.CastContextEventType.CAST_STATE_CHANGED,
      refreshCastControl
    );

    castContext.addEventListener(
      cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
      async (event) => {
        const state = event.sessionState;

        if (
          state === cast.framework.SessionState.SESSION_STARTED ||
          state === cast.framework.SessionState.SESSION_RESUMED
        ) {
          const session = getCastSession();
          if (poweredOn && session) {
            await loadStreamOnCast(session);
          }
        }

        if (
          state === cast.framework.SessionState.SESSION_ENDED ||
          state === cast.framework.SessionState.SESSION_ENDING
        ) {
          isRemotePlaying = false;
          if (poweredOn) {
            setPlayingUI(false, "Cast desconectado");
          }
        }
      }
    );

    refreshCastControl();
  } catch (error) {
    console.error("No se pudo iniciar Chromecast:", error);
    castReady = false;
    castContext = null;
    showCastControl(false);
  }
}

window.addEventListener("cast-api-available", (event) => {
  if (event.detail) initCast();
});

/* Cubre el caso en que la API respondió antes de cargar script.js. */
if (window.cast?.framework) {
  initCast();
}

setTimeout(initCast, 1500);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js", { updateViaCache: "none" })
      .catch((error) => {
        console.error("Service Worker:", error);
      });
  });
}

document.body.classList.add("power-off");
powerBtn.setAttribute("aria-pressed", "false");
setPlayingUI(false, "Radio apagada");
updateVolumeUI(Number(volumeSlider.value));
showCastControl(false);

// Temperatura y condición actuales para Ingeniero Huergo, Río Negro.
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast?latitude=-39.07146&longitude=-67.2379&current=temperature_2m,weather_code,is_day&timezone=America%2FArgentina%2FBuenos_Aires&forecast_days=1";
const weatherTemp = document.getElementById("weatherTemp");
const weatherIcon = document.getElementById("weatherIcon");
let weatherLastUpdated = 0;
let weatherLoading = false;

function weatherSymbol(code, isDay) {
  if (code === 0 || code === 1) return isDay ? "☀️" : "🌙";
  if (code === 2) return isDay ? "🌤️" : "☁️";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 51 && code <= 67) return "🌧️";
  if (code >= 71 && code <= 77) return "❄️";
  if (code >= 80 && code <= 82) return "🌦️";
  if (code >= 85 && code <= 86) return "🌨️";
  if (code >= 95) return "⛈️";
  return "🌤️";
}

async function updateWeather() {
  if (weatherLoading || Date.now() - weatherLastUpdated < 15 * 60 * 1000) return;
  weatherLoading = true;
  try {
    const response = await fetch(WEATHER_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Clima HTTP ${response.status}`);
    const data = await response.json();
    const current = data.current;
    if (!current || !Number.isFinite(current.temperature_2m)) {
      throw new Error("Datos de clima incompletos");
    }
    weatherTemp.textContent = `${Math.round(current.temperature_2m)} °C`;
    weatherIcon.textContent = weatherSymbol(current.weather_code, current.is_day === 1);
    weatherIcon.title = "Condición climática actual";
    weatherLastUpdated = Date.now();
  } catch (error) {
    console.warn("No se pudo cargar el clima:", error);
    if (!weatherLastUpdated) {
      weatherTemp.textContent = "-- °C";
      weatherIcon.textContent = "🌤️";
    }
  } finally {
    weatherLoading = false;
  }
}

updateWeather();
setInterval(updateWeather, 15 * 60 * 1000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) updateWeather();
});


// ===== Espectro real de La Roca Online: tres estilos, sin animación simulada =====
const spectrumControl = document.getElementById("spectrumControl");
const spectrumCanvas = document.getElementById("spectrumCanvas");
const spectrumCtx = spectrumCanvas?.getContext("2d");
const spectrumNames = ["barras clásicas", "espejo", "onda"];
let spectrumMode = 0;
let spectrumAudioContext = null;
let spectrumAnalyser = null;
let spectrumFrequency = null;
let spectrumWave = null;
let spectrumFrame = 0;
let spectrumFailed = false;
let spectrumHeights = new Float32Array(15);

try {
  const storedMode = Number(localStorage.getItem("laRocaSpectrumMode"));
  if (Number.isInteger(storedMode) && storedMode >= 0 && storedMode < 3) spectrumMode = storedMode;
} catch (_) { /* La configuración local puede estar restringida. */ }

function updateSpectrumLabel() {
  if (!spectrumControl) return;
  spectrumControl.setAttribute("aria-label", "Cambiar visualización del espectro: " + spectrumNames[spectrumMode]);
  spectrumControl.title = "Espectro: " + spectrumNames[spectrumMode] + ". Clic para cambiar";
}

function switchSpectrumMode() {
  spectrumMode = (spectrumMode + 1) % 3;
  spectrumHeights.fill(0);
  updateSpectrumLabel();
  try { localStorage.setItem("laRocaSpectrumMode", String(spectrumMode)); } catch (_) {}
  drawSpectrumFrame();
}

spectrumControl?.addEventListener("click", switchSpectrumMode);
spectrumControl?.addEventListener("keydown", event => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    switchSpectrumMode();
  }
});
updateSpectrumLabel();

async function prepareSpectrumAudio() {
  if (spectrumAudioContext) {
    if (spectrumAudioContext.state === "suspended") {
      await spectrumAudioContext.resume();
    }
    return;
  }
  if (!spectrumCtx || spectrumFailed) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error("Web Audio API no disponible");
    const context = new AudioContextClass();
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.72;
    const source = context.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(context.destination);
    spectrumAudioContext = context;
    spectrumAnalyser = analyser;
    spectrumFrequency = new Uint8Array(analyser.frequencyBinCount);
    spectrumWave = new Uint8Array(analyser.fftSize);
    spectrumControl?.classList.add("spectrum-ready");
    await context.resume();
  } catch (error) {
    // No simular espectro: conservar registro del fallo para diagnóstico.
    spectrumFailed = true;
    console.warn("Espectro real no disponible:", error);
  }
}

function spectrumDimensions() {
  if (!spectrumCanvas || !spectrumCtx) return null;
  const rect = spectrumCanvas.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (spectrumCanvas.width !== width || spectrumCanvas.height !== height) {
    spectrumCanvas.width = width;
    spectrumCanvas.height = height;
  }
  spectrumCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width: rect.width, height: rect.height };
}

function drawSpectrumFrame() {
  if (!spectrumAnalyser || !spectrumCtx || !spectrumFrequency) return;
  const dim = spectrumDimensions();
  if (!dim) return;
  const { width: w, height: h } = dim;
  spectrumCtx.clearRect(0, 0, w, h);
  if (!poweredOn || audio.paused || audio.muted || audio.volume === 0 || getCastSession()) return;

  const count = spectrumHeights.length;
  if (spectrumMode === 2) {
    spectrumAnalyser.getByteTimeDomainData(spectrumWave);
    spectrumCtx.beginPath();
    spectrumCtx.lineWidth = 2.4;
    spectrumCtx.lineJoin = "round";
    spectrumCtx.strokeStyle = "#55ed42";
    spectrumCtx.shadowBlur = 7;
    spectrumCtx.shadowColor = "#25e05a";
    for (let x = 0; x <= w; x += 2) {
      const i = Math.min(spectrumWave.length - 1, Math.floor(x / w * spectrumWave.length));
      const y = (spectrumWave[i] / 255) * h;
      if (x === 0) spectrumCtx.moveTo(x, y);
      else spectrumCtx.lineTo(x, y);
    }
    spectrumCtx.stroke();
    spectrumCtx.shadowBlur = 0;
    return;
  }

  spectrumAnalyser.getByteFrequencyData(spectrumFrequency);
  const gap = w < 150 ? 2 : 4;
  const barW = (w - gap * (count - 1)) / count;
  const grad = spectrumCtx.createLinearGradient(0, h, 0, 0);
  grad.addColorStop(0, "#25e05a");
  grad.addColorStop(.35, "#55ed42");
  grad.addColorStop(.65, "#f4e83b");
  grad.addColorStop(.82, "#ff9d28");
  grad.addColorStop(1, "#f44336");
  spectrumCtx.fillStyle = grad;
  for (let b = 0; b < count; b++) {
    // Distribución logarítmica aproximada: graves a la izquierda, agudos a la derecha.
    const minHz = 55, maxHz = 12000;
    const hz1 = minHz * Math.pow(maxHz / minHz, b / count);
    const hz2 = minHz * Math.pow(maxHz / minHz, (b + 1) / count);
    const nyquist = spectrumAudioContext.sampleRate / 2;
    const first = Math.min(spectrumFrequency.length - 1, Math.floor(hz1 / nyquist * spectrumFrequency.length));
    const last = Math.min(spectrumFrequency.length - 1, Math.max(first, Math.ceil(hz2 / nyquist * spectrumFrequency.length)));
    let sum = 0;
    for (let k = first; k <= last; k++) sum += spectrumFrequency[k];
    const level = sum / (last - first + 1) / 255;
    const target = Math.min(1, level * 1.0);
    spectrumHeights[b] += (target - spectrumHeights[b]) * (target > spectrumHeights[b] ? .4 : .18);
    const amplitude = spectrumHeights[b];
    const barX = b * (barW + gap);
    if (spectrumMode === 0) {
      const barH = amplitude * h;
      spectrumCtx.fillRect(barX, h - barH, barW, barH);
    } else {
      const halfH = amplitude * h * .48;
      spectrumCtx.fillRect(barX, h / 2 - halfH, barW, 2 * halfH);
    }
  }
}

function animateSpectrum() {
  spectrumFrame = 0;
  if (!poweredOn || audio.paused || document.hidden || getCastSession()) {
    drawSpectrumFrame();
    return;
  }
  drawSpectrumFrame();
  spectrumFrame = requestAnimationFrame(animateSpectrum);
}

function refreshSpectrumAnimation() {
  if (spectrumFrame) cancelAnimationFrame(spectrumFrame);
  spectrumFrame = 0;
  if (poweredOn && !audio.paused && !document.hidden && !getCastSession()) {
    spectrumFrame = requestAnimationFrame(animateSpectrum);
  } else {
    drawSpectrumFrame();
  }
}

audio.addEventListener("playing", refreshSpectrumAnimation);
audio.addEventListener("pause", refreshSpectrumAnimation);
audio.addEventListener("volumechange", drawSpectrumFrame);
document.addEventListener("visibilitychange", refreshSpectrumAnimation);
powerBtn.addEventListener("click", () => setTimeout(refreshSpectrumAnimation, 0));
if (typeof ResizeObserver !== "undefined" && spectrumCanvas) {
  new ResizeObserver(drawSpectrumFrame).observe(spectrumCanvas);
}
