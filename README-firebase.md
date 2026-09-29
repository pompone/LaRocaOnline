# Contador de personas online

Cuenta sesiones con la app abierta. Dos pestañas abiertas cuentan como dos sesiones.
No mide la audiencia del servidor de streaming ni a quienes escuchan por otra app.

## Configuración del proyecto Firebase de la radio

1. Crear un proyecto Firebase separado para La Roca Online.
2. Registrar una aplicación web y copiar su objeto `firebaseConfig` a `firebase-config.js`.
3. Crear una **Realtime Database** y agregar su URL al campo `databaseURL`.
4. En **Authentication > Sign-in method**, habilitar **Anónimo**.
5. En **Realtime Database > Reglas**, publicar el contenido de `database.rules.json`. Revisar las reglas existentes antes de reemplazarlas si la base contiene otros datos.
6. Publicar los archivos de esta rama. Probar con dos dispositivos: abrir la radio en ambos, verificar que el contador suba; cerrar uno y esperar a que baje.

La presencia se elimina en el servidor con `onDisconnect` si la pestaña se cierra o pierde conexión. El contador puede tardar unos segundos en bajar.
