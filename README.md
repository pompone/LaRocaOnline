# La Roca Online

Proyecto web/PWA inspirado en la estructura de Radios_VR.

## Stream configurado

`https://ssl.radiosnethosting.com/index.php?port=8016`

## Funciones

- Reproducción del stream MP3.
- Play/Pausa.
- Encendido/apagado.
- Volumen y mute.
- Interfaz responsive para celular/escritorio/TV con logo, parlantes y luces animadas al reproducir.
- Animaciones CSS decorativas; no representan el nivel real del audio.
- PWA con `manifest.json` y `service-worker.js`.
- Google Cast/Chromecast usando Default Media Receiver.
- El botón Cast aparece cuando el navegador/SDK detecta disponibilidad.

## Archivos

- `index.html`
- `style.css`
- `script.js`
- `manifest.json`
- `service-worker.js`
- `icons/icon-192.png`
- `icons/icon-512.png`
- `icons/logo-la-roca.png`

## Personalización rápida

En `script.js`:

```js
const STREAM_URL = "https://ssl.radiosnethosting.com/index.php?port=8016";
const STATION_NAME = "La Roca Online";
```

Cambiar `STATION_NAME` por el nombre real de la emisora.

También se puede cambiar el título en `index.html`.

## Publicación en GitHub Pages

Subir el contenido de esta carpeta a un repositorio y activar GitHub Pages.

La PWA funciona correctamente sobre HTTPS, como GitHub Pages.

## Nota sobre Cast

El receptor Google Cast es quien intenta abrir directamente la URL del stream.
Por eso el stream debe ser accesible públicamente desde Internet y compatible
con el dispositivo receptor.


## Corrección de compatibilidad del stream

El `<audio>` NO usa `crossorigin="anonymous"`, porque este servidor de radio entrega
`audio/mpeg` directamente pero puede no enviar cabeceras CORS. Para reproducción
normal no hace falta CORS y agregar ese atributo puede hacer que el navegador
rechace el audio.

## Cómo probarlo

Para la PWA y Cast conviene servir el proyecto por HTTP/HTTPS, no abrir `index.html`
con doble clic (`file://`).

Ejemplo rápido con Python:

```bash
python -m http.server 8080
```

y luego abrir:

`http://localhost:8080`
