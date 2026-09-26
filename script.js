const STREAM_URL =
  "https://ssl.radiosnethosting.com/index.php?port=8016";
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

let poweredOn = false;
let castReady = false;
let castContext = null;
let isRemotePlaying = false;

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
  playIcon.textContent = isPlaying ? "❚❚" : "▶";
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
      setStreamError();
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

  try {
    setStatus("Conectando...");
    await audio.play();

    if (poweredOn && !getCastSession()) {
      setPlayingUI(true, "Reproduciendo");
    } else {
      audio.pause();
    }
  } catch (error) {
    console.error("Error al reproducir:", error);
    if (poweredOn) {
      setStreamError();
    }
  }
}

function pauseLocal() {
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

  if (value === 0) {
    muteIcon.textContent = "🔇";
  } else if (value < 50) {
    muteIcon.textContent = "🔉";
  } else {
    muteIcon.textContent = "🔊";
  }
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
    setPlayingUI(true, "Reproduciendo");
  }
});

audio.addEventListener("waiting", setBuffering);
audio.addEventListener("stalled", setBuffering);

audio.addEventListener("error", () => {
  console.error("MediaError:", audio.error);

  if (!getCastSession() && poweredOn) {
    setStreamError();
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
