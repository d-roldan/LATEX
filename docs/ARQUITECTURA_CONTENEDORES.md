# Arquitectura y función de los contenedores

Este documento explica qué función cumple cada servicio definido en `docker-compose.yml`, qué tecnología utiliza, cómo se relaciona con los demás y qué datos conserva. Describe el stack vigente del proyecto; no reemplaza los procedimientos de despliegue, backup o recuperación.

## Conceptos básicos

- **Servicio**: definición declarativa de Compose, por ejemplo `disal-backend`.
- **Imagen**: plantilla inmutable con el sistema y la aplicación necesarios para ejecutar un servicio.
- **Contenedor**: instancia en ejecución de una imagen.
- **Servicio permanente**: debe permanecer activo durante la operación normal.
- **Trabajo de una sola ejecución**: realiza una preparación, termina con código `0` y queda en estado `Exited`. Ese estado es correcto si finalizó sin errores.

El stack tiene cinco servicios permanentes (`disal-db`, `disal-backend`, `disal-frontend`, `disal-nginx` y `disal-node-red`) y dos trabajos de preparación (`disal-uploads-init` y `disal-migrate`).

## Vista general del recorrido de datos

```text
Navegador / PWA
       |
       | HTTP o HTTPS
       v
 disal-nginx ---------------> disal-frontend
       |                      React compilado servido por Nginx
       |
       +---- /api/* --------> disal-backend --------> disal-db
                                  ^                   PostgreSQL
                                  |
                                  | lotes de pesos
                                  |
                            disal-node-red
```

Todos los servicios comparten la red privada que Docker Compose crea de forma predeterminada, salvo `disal-uploads-init`, que no necesita red. Dentro de esa red los servicios se encuentran por su nombre, por ejemplo `disal-db`, `disal-backend` o `disal-nginx`. Esos nombres no son direcciones válidas fuera de Docker.

El único punto de entrada de la aplicación para otros equipos es `disal-nginx`. La base de datos y el editor de Node-RED se publican únicamente en `127.0.0.1`, por lo que de forma predeterminada sólo son accesibles desde el host.

## Resumen de servicios

| Servicio | Tecnología principal | Tipo | Función |
| --- | --- | --- | --- |
| `disal-db` | PostgreSQL 16 Alpine | Permanente | Persistencia transaccional de usuarios, plantas, lotes, estados, auditoría y demás datos del sistema. |
| `disal-uploads-init` | Nginx 1.27 Alpine usado como utilidad mínima | Una ejecución | Prepara propietario y permisos del volumen compartido de archivos. |
| `disal-migrate` | Node.js 20, NestJS/Prisma CLI | Una ejecución | Aplica migraciones Prisma pendientes antes de iniciar la API. |
| `disal-backend` | Node.js 20, NestJS 10, Prisma 5 | Permanente | Expone la API, aplica reglas operativas, autenticación, autorización y acceso a datos. |
| `disal-frontend` | React 18, TypeScript, Vite y Nginx 1.27 | Permanente | Sirve la interfaz web/PWA ya compilada. |
| `disal-nginx` | Nginx 1.27 Alpine | Permanente | Es el proxy inverso y punto de entrada; dirige interfaz y API, limita tráfico y agrega cabeceras. |
| `disal-node-red` | Node-RED 4.0.9 | Permanente | Integra o simula las lecturas de peso y las envía a la API. |

## `disal-db`: base de datos

### Para qué sirve

Es la fuente persistente de verdad del sistema. Conserva la información de negocio y seguridad que debe sobrevivir a reinicios y recreaciones: empresas, usuarios, permisos, plantas, equipos, OF/OE, estados, eventos, cierres y auditoría.

Las muestras continuas de peso recibidas desde Node-RED **no se guardan como telemetría histórica** en PostgreSQL. El backend las mantiene en memoria y sólo persiste las fotografías de peso que forman parte de eventos operativos definidos por la aplicación.

### Tecnología y funcionamiento

- Imagen oficial `postgres:16-alpine`.
- Recibe `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` y `TZ` desde `.env`.
- El backend se conecta mediante `DATABASE_URL`, usando `disal-db:5432` como host interno.
- El healthcheck ejecuta `pg_isready` cada 10 segundos. Los servicios que requieren datos esperan a que PostgreSQL esté saludable.
- Tiene límites configurables de memoria y CPU, además de un máximo de procesos.

### Puertos y datos

- Contenedor: `5432`.
- Host: `127.0.0.1:${POSTGRES_PORT}`. No se publica en todas las interfaces de red.
- Volumen: `postgres_data` montado en `/var/lib/postgresql/data`.

Recrear el contenedor no borra la base mientras se conserve `postgres_data`. Ejecutar `docker compose down -v` sí elimina los volúmenes y, por lo tanto, es destructivo.

## `disal-uploads-init`: preparación del volumen de archivos

### Para qué sirve

Prepara `uploads_data` antes de que arranque el backend. Ajusta su propietario a `1000:1000` —el usuario `node` de la imagen del backend— y aplica permisos `0750` para que la API pueda escribir sin ejecutarse como `root`.

### Tecnología y funcionamiento

- Usa `nginx:1.27-alpine` porque aporta un entorno Alpine pequeño con las utilidades necesarias; no levanta un servidor web.
- Se ejecuta temporalmente como `root` sólo para cambiar propietario y permisos.
- No tiene acceso a la red (`network_mode: none`).
- Descarta todas las capacidades Linux y recupera únicamente `CHOWN` y `FOWNER`.
- Activa `no-new-privileges` y no se reinicia automáticamente.
- Monta `uploads_data` en `/uploads` y finaliza al terminar la preparación.

Un estado `Exited (0)` es el resultado esperado. Si termina con otro código, `disal-backend` no inicia porque depende de su finalización correcta.

## `disal-migrate`: migraciones de base de datos

### Para qué sirve

Aplica de forma automática y controlada las migraciones Prisma que estén pendientes. Su objetivo es que el esquema de PostgreSQL sea compatible con el código que se va a ejecutar.

### Tecnología y funcionamiento

- Se construye con el mismo `Dockerfile` y el mismo código que `disal-backend`.
- Espera a que `disal-db` esté saludable.
- Ejecuta `npm run prisma:deploy`, que invoca `prisma migrate deploy`.
- Recibe únicamente `DATABASE_URL` porque no necesita iniciar la API.
- Tiene `restart: "no"`: corre una vez por arranque/recreación del proyecto y termina.

El backend espera que este trabajo finalice correctamente. `Exited (0)` es normal; no debe forzarse a permanecer activo. Este servicio no ejecuta seeds, no borra datos y no reemplaza el backup previo a una actualización.

## `disal-backend`: API y reglas de negocio

### Para qué sirve

Centraliza la lógica del sistema. Entre otras responsabilidades:

- autentica usuarios y emite/valida JWT;
- aplica roles y acceso por empresa y planta;
- valida los DTO de entrada;
- controla transiciones de estado y concurrencia;
- consulta y actualiza PostgreSQL mediante Prisma;
- recibe telemetría de Node-RED;
- mantiene las lecturas actuales de peso en memoria;
- registra eventos y auditoría;
- expone el estado de salud en `/api/auth/status`.

### Tecnología y construcción

- Node.js 20 sobre Debian Slim.
- NestJS 10 y TypeScript.
- Prisma 5 como ORM y cliente de PostgreSQL.
- Passport/JWT y `bcrypt` para autenticación.
- `class-validator` para validar y filtrar entradas.
- Imagen multi-stage:
  1. instala dependencias;
  2. genera el cliente Prisma;
  3. compila NestJS;
  4. copia sólo lo necesario al runtime y elimina dependencias de desarrollo.
- Incluye OpenSSL, requerido por Prisma en tiempo de ejecución.

### Cómo funciona dentro del stack

Escucha en el puerto configurado por `BACKEND_PORT` —normalmente `3000`— y aplica el prefijo global `/api`. No publica ese puerto en el host: las solicitudes llegan a través de `disal-nginx`.

Antes de iniciar espera tres condiciones:

1. PostgreSQL saludable.
2. Volumen de archivos preparado por `disal-uploads-init`.
3. Migraciones terminadas correctamente por `disal-migrate`.

El healthcheck solicita `http://localhost:3000/api/auth/status` desde el propio contenedor y exige una respuesta HTTP 200.

### Seguridad, recursos y persistencia

- Se ejecuta como usuario no privilegiado `node`.
- El sistema de archivos raíz es de sólo lectura.
- `/tmp` se crea como `tmpfs` para escrituras temporales.
- Descarta todas las capacidades Linux y activa `no-new-privileges`.
- Rechaza el arranque en producción si `JWT_SECRET` es débil o demasiado corto.
- Usa límites configurables de memoria, CPU y procesos.
- Monta `uploads_data` en `/app/data/uploads`.

Actualmente el proxy bloquea el acceso público a `/api/uploads/`. El volumen deja preparada la persistencia de archivos para las funciones que la utilicen, pero no constituye por sí solo un servidor público de archivos.

## `disal-frontend`: interfaz web y PWA

### Para qué sirve

Entrega al navegador la aplicación de operación y monitoreo. El código React se ejecuta en el navegador del usuario; el contenedor sólo sirve archivos estáticos HTML, CSS, JavaScript, íconos y manifiesto PWA.

### Tecnología y construcción

- React 18 y TypeScript.
- Vite 6 para compilar y optimizar la aplicación.
- TanStack Query para estado remoto y caché de consultas.
- Nginx 1.27 Alpine como servidor estático de producción.
- Imagen multi-stage:
  1. Node.js 20 Alpine instala dependencias y ejecuta `npm run build`;
  2. la etapa final copia `dist` a Nginx y no incluye Node.js ni el código fuente.

`VITE_API_BASE_URL` se pasa como argumento de construcción. Al ser una variable de Vite, su valor queda incorporado en los archivos compilados; cambiarla requiere reconstruir la imagen, no sólo reiniciar el contenedor.

### Cómo sirve la aplicación

- Escucha internamente en el puerto `80` y no publica un puerto en el host.
- `disal-nginx` reenvía aquí todas las rutas que no comienzan con `/api/`.
- Su configuración Nginx aplica fallback a `index.html` para que React Router resuelva rutas como `/fabricacion` o `/tv`.
- Los assets versionados usan caché larga e inmutable.
- `sw.js`, `site.webmanifest` y `offline.html` evitan caché prolongada para que las actualizaciones de la PWA se detecten correctamente.

Este Nginx interno sirve archivos; no debe confundirse con `disal-nginx`, que es el proxy de entrada del sistema completo.

## `disal-nginx`: puerta de entrada y proxy inverso

### Para qué sirve

Es el único acceso normal a la aplicación. Oculta los puertos internos y presenta frontend y backend bajo un mismo origen, evitando que el navegador necesite conocer la topología de contenedores.

### Tecnología y enrutamiento

- Imagen oficial `nginx:1.27-alpine`.
- Publica `0.0.0.0:${HTTP_PORT}:80`, por lo que acepta conexiones en las interfaces del host.
- `/api/auth/login` se dirige al backend con un límite específico para intentos de acceso.
- `/api/ai-assistant/` se dirige al backend con tiempos de espera mayores y un límite específico.
- El resto de `/api/` se dirige a `disal-backend:3000`.
- `/api/uploads/` devuelve 404 y no expone directamente el volumen de archivos.
- El resto de las rutas se dirige a `disal-frontend:80`.

También propaga `Host`, IP real, cadena de proxies y protocolo original. Utiliza el resolvedor DNS interno de Docker para volver a resolver los nombres de servicio cuando un contenedor se recrea.

### Protección aplicada

- límites de solicitudes y conexiones por IP;
- tamaño máximo de solicitud de 10 MB;
- tiempos máximos de conexión, envío y respuesta;
- ocultamiento de la versión de Nginx;
- cabeceras CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` y `Permissions-Policy`;
- límites configurables de memoria, CPU y procesos;
- `no-new-privileges`.

El proxy espera que backend y frontend hayan iniciado, aunque la condición `service_started` no equivale a que toda la aplicación ya esté lista. Para comprobar disponibilidad se debe consultar `/api/auth/status` a través del puerto publicado.

## `disal-node-red`: integración de pesos

### Para qué sirve

Representa la capa de integración con las balanzas y equipos de planta. Construye lotes de lecturas y los envía por HTTP al backend, incluyendo una clave compartida en `X-Node-Red-Key`.

### Tecnología y funcionamiento

- Imagen `nodered/node-red:4.0.9`.
- Editor/runtime interno en el puerto `1880`.
- Puerto del host: `127.0.0.1:${NODE_RED_PORT:-1880}`.
- Directorio persistente: bind mount `./infra/node-red/data:/data`.
- Lee `NODE_RED_API_KEY`, `TZ` y `DISAL_ENABLE_WEIGHT_SIMULATOR` desde el entorno.
- Espera que `disal-nginx` haya iniciado y envía a direcciones internas como `http://disal-nginx/api/plants/LATEX/telemetry/weights`.
- Tiene límites configurables de memoria y CPU, además de un máximo de procesos.

El flujo incluido puede simular Látex, Terplast y Slurry; Enduido se declara sin sensores. La simulación sólo transmite cuando `DISAL_ENABLE_WEIGHT_SIMULATOR=true`. El valor predeterminado es `false`, por lo que no debe habilitarse en un entorno conectado a señales reales.

Las modificaciones realizadas desde el editor pueden cambiar archivos de `infra/node-red/data`. Antes de desplegar un flujo debe revisarse que no contenga credenciales, direcciones privadas no deseadas o nodos de prueba habilitados.

## Red, puertos y exposición

| Componente | Puerto interno | Publicación predeterminada | Alcance |
| --- | ---: | --- | --- |
| PostgreSQL | `5432` | `127.0.0.1:${POSTGRES_PORT}` | Sólo host |
| Backend | `${BACKEND_PORT}` / normalmente `3000` | Sin publicación | Sólo red Compose |
| Frontend | `80` | Sin publicación | Sólo red Compose |
| Proxy HTTP | `80` | `0.0.0.0:${HTTP_PORT}` | Red accesible al host |
| Proxy HTTPS opcional | `443` | `0.0.0.0:${HTTPS_PORT:-443}` | Red accesible al host |
| Node-RED | `1880` | `127.0.0.1:${NODE_RED_PORT:-1880}` | Sólo host |

Los puertos concretos se obtienen de `.env`; no debe asumirse que `HTTP_PORT` es siempre `80` o `8081`.

## Volúmenes y persistencia

| Volumen o montaje | Consumidor | Contenido | Consideración |
| --- | --- | --- | --- |
| `postgres_data` | `disal-db` | Archivos de PostgreSQL | Es el dato persistente principal; requiere backup. |
| `uploads_data` | `disal-uploads-init`, `disal-backend` | Archivos cargados por funciones de la API | El inicializador ajusta permisos antes del backend. |
| `./infra/node-red/data:/data` | `disal-node-red` | Flujos y configuración de Node-RED | Es una carpeta del repositorio/host, no un volumen nombrado. |
| `./infra/nginx/default.conf` | `disal-nginx` | Configuración HTTP | Montaje de sólo lectura. |
| `./infra/nginx/https.conf` | `disal-nginx` con overlay HTTPS | Configuración TLS | Reemplaza la configuración HTTP dentro del contenedor. |
| `./infra/nginx/certs` | `disal-nginx` con overlay HTTPS | Certificado y clave | Sólo lectura y excluido de Git. |

Un backup completo debe contemplar PostgreSQL, archivos cargados, datos de Node-RED, `.env` y certificados locales cuando corresponda.

## Orden de inicio

Al ejecutar `docker compose up -d --build`, Compose coordina aproximadamente esta secuencia:

1. Construye las imágenes de backend/migrador y frontend si corresponde.
2. Inicia PostgreSQL y espera su healthcheck.
3. Ejecuta `disal-uploads-init` para preparar `uploads_data`.
4. Ejecuta `disal-migrate` cuando PostgreSQL está saludable.
5. Inicia `disal-backend` cuando base, permisos y migraciones están listos.
6. Inicia `disal-frontend`.
7. Inicia `disal-nginx` cuando backend y frontend están iniciados.
8. Inicia `disal-node-red` cuando el proxy está iniciado.

Los pasos independientes pueden solaparse; la lista expresa las dependencias, no una serialización absoluta.

## Variante HTTPS

`docker-compose.https.yml` es un archivo complementario, no un stack separado. Se combina con el Compose principal:

```powershell
docker compose -f docker-compose.yml -f docker-compose.https.yml up -d --build
```

La variante:

- monta `infra/nginx/https.conf` como configuración activa;
- monta certificados desde `infra/nginx/certs` en modo de sólo lectura;
- publica `${HTTPS_PORT:-443}`;
- redirige HTTP a HTTPS;
- habilita TLS 1.2/1.3 y HSTS.

Los certificados y claves privadas no se versionan. La preparación de nombres, certificados y confianza de los clientes está detallada en [HTTPS local](HTTPS_LOCAL.md).

## Variables que conectan los servicios

| Variable | Uso principal |
| --- | --- |
| `DATABASE_URL` | Conexión de backend y migrador con PostgreSQL. |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Inicialización y acceso a PostgreSQL. |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Firma y duración de sesiones del backend. |
| `CORS_ORIGIN` | Orígenes admitidos por la API. |
| `NODE_RED_API_KEY` | Autenticación de Node-RED ante los endpoints de telemetría. |
| `DISAL_ENABLE_WEIGHT_SIMULATOR` | Habilita explícitamente la generación local de pesos simulados. |
| `VITE_API_BASE_URL` | URL base de API incorporada al compilar el frontend. |
| `HTTP_PORT`, `HTTPS_PORT`, `POSTGRES_PORT`, `NODE_RED_PORT` | Puertos publicados en el host. |
| `*_MEMORY_LIMIT`, `*_CPU_LIMIT` | Límites de recursos de los servicios permanentes configurados. |

Los valores sensibles deben residir en `.env`, que está excluido de Git. No deben copiarse contraseñas, JWT, claves de integración ni certificados dentro de Compose o de este documento.

## Comprobación y diagnóstico

Listar servicios definidos y estado de todos los contenedores, incluidos los trabajos terminados:

```powershell
docker compose config --services
docker compose ps -a
```

Consultar logs acotados:

```powershell
docker compose logs --tail 100 disal-db
docker compose logs --tail 100 disal-migrate
docker compose logs --tail 100 disal-backend
docker compose logs --tail 100 disal-nginx
docker compose logs --tail 100 disal-node-red
```

Interpretación esperada:

- servicios permanentes: `Up`;
- `disal-db` y `disal-backend`: `healthy` después del arranque;
- `disal-uploads-init` y `disal-migrate`: `Exited (0)`;
- API: respuesta HTTP 200 en `http://localhost:<HTTP_PORT>/api/auth/status`.

Para detener sin borrar datos:

```powershell
docker compose down
```

No agregar `-v` salvo que exista una decisión explícita y un backup verificado, porque elimina los volúmenes persistentes. Para procedimientos de instalación, actualización y recuperación consultar [Despliegue multiplanta](DESPLIEGUE_MULTIPLANTA.md).
