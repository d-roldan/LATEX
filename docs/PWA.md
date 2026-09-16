# Aplicación instalable (PWA)

El frontend React/Vite se publica como una Progressive Web App sin modificar la navegación ni las pantallas existentes.

## Requisitos de instalación

- Chrome o Edge actualizados.
- Acceso mediante `https://disal-industria.local` con el certificado local confiado por el dispositivo.
- Para pruebas en la misma computadora, Chrome también considera seguro `http://localhost`.
- El manifiesto y el service worker deben responder correctamente desde la raíz del sitio.

En Android, abrir la aplicación en Chrome y usar **Instalar aplicación** o **Agregar a pantalla principal**. En escritorio, usar el icono de instalación de la barra de direcciones. La aplicación instalada utiliza `display: standalone`, por lo que se abre sin la barra del navegador.

## Alcance offline

Se almacenan únicamente la carcasa de la aplicación, el manifiesto, los iconos y recursos estáticos visitados. Las llamadas `/api` y los datos autenticados nunca se guardan en caché. Si no hay red, la aplicación usa la carcasa disponible y las llamadas al servidor responden `503` con un mensaje de desconexión; si la carcasa no está disponible se muestra `offline.html`.

## Actualizaciones

El HTML usa red primero y los bundles Vite tienen nombres versionados. El navegador consulta actualizaciones del service worker al cargar y cada hora. Una versión nueva usa `skipWaiting`, toma control de las ventanas abiertas y provoca una única recarga automática cuando cambia el controlador, evitando que permanezcan formularios o bundles anteriores en uso.

## Producción HTTPS

Seguir [HTTPS_LOCAL.md](HTTPS_LOCAL.md), configurar `CORS_ORIGIN=https://disal-industria.local` y levantar:

```powershell
docker compose -f docker-compose.yml -f docker-compose.https.yml up -d --build
```

Una dirección HTTP de la red local, por ejemplo `http://192.168.x.x`, no es un contexto seguro y Android no habilitará todas las funciones PWA.
