import { firebaseConfig } from "./firebase-config.js";

async function startPresence() {
  try {
    const [
      { initializeApp },
      { getAuth, signInAnonymously },
      { getDatabase, ref, push, set, remove, onValue, onDisconnect, serverTimestamp }
    ] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js")
    ]);

const onlineCount = document.getElementById("onlineCount");

if (!firebaseConfig.apiKey || !firebaseConfig.databaseURL || !firebaseConfig.appId) {
  console.info("El contador online espera la configuración de Firebase.");
} else {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getDatabase(app);
  const sessionsRef = ref(db, "presence/larocaonline");
  const connectedRef = ref(db, ".info/connected");

  onValue(
    sessionsRef,
    (snapshot) => {
      const users = snapshot.val() || {};
      const count = Object.values(users).reduce(
        (total, sessions) => total + Object.keys(sessions || {}).length,
        0
      );
      onlineCount.textContent = String(count);
    },
    (error) => {
      console.error("No se pudo leer el contador online:", error);
      onlineCount.textContent = "—";
    }
  );

  let activeSession = null;
  let connectionEpoch = 0;

  onValue(connectedRef, async (snapshot) => {
    const epoch = ++connectionEpoch;

    if (snapshot.val() !== true) {
      activeSession = null;
      return;
    }

    if (activeSession) return;

    try {
      const { user } = await signInAnonymously(auth);
      if (epoch !== connectionEpoch) return;

      const mySession = push(ref(db, `presence/larocaonline/${user.uid}`));
      await onDisconnect(mySession).remove();
      if (epoch !== connectionEpoch) return;

      await set(mySession, { since: serverTimestamp() });
      if (epoch !== connectionEpoch) {
        await remove(mySession);
        return;
      }

      activeSession = mySession;
    } catch (error) {
      console.error("No se pudo registrar la sesión online:", error);
    }
  });
}

  } catch (error) {
    console.warn("El contador online no está disponible:", error);
  }
}

void startPresence();
