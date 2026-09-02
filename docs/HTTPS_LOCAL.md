# HTTPS en la red local

El perfil HTTPS está preparado, pero no se activa hasta crear y confiar un certificado local. Un certificado autofirmado no confiado provoca advertencias y no debe distribuirse copiando su clave privada.

## Opción recomendada: `mkcert`

En el servidor, instalar `mkcert`, crear una CA local y generar el certificado:

```powershell
New-Item -ItemType Directory -Force infra/nginx/certs
mkcert -install
mkcert -cert-file infra/nginx/certs/disal-industria.local.crt -key-file infra/nginx/certs/disal-industria.local.key disal-industria.local DISAL-industria localhost 127.0.0.1
```

La CA raíz creada por `mkcert` debe instalarse como confiable en cada equipo autorizado de la planta. Nunca copiar `disal-industria.local.key` fuera del servidor.

Configurar `CORS_ORIGIN=https://disal-industria.local` y levantar el perfil:

```powershell
docker compose -f docker-compose.yml -f docker-compose.https.yml up -d --build
```

El puerto HTTP redirige a HTTPS. El perfil habilita TLS 1.2/1.3 y HSTS; no usar HSTS antes de que todos los equipos confíen el certificado.

## PWA en Android y escritorio

La instalación desde otros equipos de la red requiere que `https://disal-industria.local` abra sin advertencias de certificado. Comprobar desde cada dispositivo que `/site.webmanifest` y `/sw.js` respondan `200`; una URL HTTP por IP no habilita el service worker ni la instalación completa en Chrome.
