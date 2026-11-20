// La Roca Online — consulta pública de mantenimiento (solo lectura).
// JSONP evita los bloqueos CORS habituales de Google Apps Script.
(() => {
  "use strict";
  const ENDPOINT = "https://script.google.com/macros/s/AKfycbx0-d8po6vpmYUR62a36cSUv1dWK_cEFmFVp6CwUE6h3yPJcEVzoB_HOIGk-P7rOd6tlw/exec";
  const INTERVAL_MS = 15000;
  const TIMEOUT_MS = 10000;
  const message = document.getElementById("maintenanceMessage");
  const hint = document.getElementById("maintenanceHint");
  const signal = document.getElementById("signalText");
  let active = false;
  let sequence = 0;
  window.laRocaMaintenanceBlocked = true; // No reproducir antes de consultar.
  function requestState() {
    return new Promise((resolve, reject) => {
      const callback = "laRocaMaintenanceCb" + (++sequence);
      const node = document.createElement("script");
      let settled = false;
      const finish = (error, result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        node.remove();
        delete window[callback];
        error ? reject(error) : resolve(result);
      };
      window[callback] = data => finish(null, data);
      node.onerror = () => finish(new Error("No se pudo consultar el estado"));
      const timer = setTimeout(() => finish(new Error("Consulta agotada")), TIMEOUT_MS);
      node.src = ENDPOINT + "?accion=estadoMantenimiento&callback=" + callback + "&t=" + Date.now();
      document.head.appendChild(node);
    });
  }
  async function check() {
    try {
      const result = await requestState();
      if (!result || result.ok !== true || typeof result.mantenimiento !== "boolean") {
        throw new Error("Respuesta inválida");
      }
      const nowActive = result.mantenimiento;
      if (nowActive) {
        window.laRocaMaintenanceBlocked = true;
        document.body.classList.add("maintenance-active");
        document.body.classList.remove("maintenance-checking");
        signal.textContent = "LA ROCA ONLINE · EN MANTENIMIENTO";
        message.textContent = String(result.mensaje || "Estamos realizando tareas de mantenimiento. Volveremos pronto.");
        hint.textContent = "Esta pantalla se actualizará automáticamente.";
        if (typeof window.laRocaStopForMaintenance === "function") {
          await window.laRocaStopForMaintenance();
        } else {
          const audio = document.getElementById("radioAudio");
          audio?.pause();
        }
      } else {
        const wasBlocked = window.laRocaMaintenanceBlocked;
        window.laRocaMaintenanceBlocked = false;
        document.body.classList.remove("maintenance-active", "maintenance-checking");
        if (wasBlocked && typeof window.laRocaRestoreAfterMaintenance === "function") {
          window.laRocaRestoreAfterMaintenance();
        }
      }
      active = nowActive;
    } catch (error) {
      console.warn("Estado de mantenimiento:", error);
      if (document.body.classList.contains("maintenance-checking")) {
        message.textContent = "No pudimos verificar el estado de la radio. Estamos intentando nuevamente.";
        hint.textContent = "Comprobando la conexión...";
      }
      // Si ya se conoce el estado, se conserva ante fallas temporales.
    }
  }
  void check();
  setInterval(() => { if (!document.hidden) void check(); }, INTERVAL_MS);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void check();
  });
})();
