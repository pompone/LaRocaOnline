# Contador de personas online

Cuenta sesiones con la app abierta. Dos pestañas abiertas cuentan como dos sesiones. No mide la audiencia del servidor de streaming ni a quienes escuchan por otra app.

El proyecto Firebase `la-roca-online` usa Realtime Database en Estados Unidos (us-central1), Authentication anónima y las reglas de `database.rules.json`. La URL de la base y la configuración de la app web están en `firebase-config.js`.

Para probarlo, abrí la radio en dos dispositivos: el contador debería subir. Al cerrar uno, puede tardar unos segundos en bajar porque el servidor elimina la presencia mediante `onDisconnect`.
