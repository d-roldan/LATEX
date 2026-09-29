# DISAL Planta de Látex · V0.0.34

[← Índice de versiones](README.md)

Fecha: 29 de septiembre de 2026.

## Resumen

Esta versión incorpora una lectura consolidada y cacheada de los estados vigentes de todas las
plantas para tableros Grafana. La actualización reduce la cantidad de consultas que llegan al
backend cuando varios usuarios visualizan simultáneamente los mismos paneles y conserva los
endpoints públicos existentes por planta.

## Integración con Grafana

- Se agrega `GET /api/plants/tv`, que entrega una lista plana con los equipos de todas las plantas
  activas.
- Cada fila incorpora `plantCode` y `plantName`, además del estado, lote activo, OF, material,
  descripción, telemetría y marcas horarias del equipo.
- Se mantienen `GET /api/plants/:plantCode/tv` y el endpoint heredado de Látex para conservar la
  compatibilidad con paneles existentes.
- La documentación incluye los selectores recomendados para Infinity y el filtrado por planta.

## Rendimiento y protección

- Nginx aplica un microcaché compartido de dos segundos a la consulta consolidada y a las consultas
  públicas por planta, tanto en HTTP como en HTTPS.
- `proxy_cache_lock` agrupa las solicitudes simultáneas: una sola recarga llega al backend y el
  resto de los usuarios recibe la misma respuesta cacheada.
- Ante una actualización o un fallo transitorio se puede servir brevemente la última respuesta
  válida mediante `UPDATING` o `STALE`.
- La cabecera `X-Plant-TV-Cache` permite diagnosticar respuestas `MISS`, `HIT`, `UPDATING` y
  `STALE`.
- Las rutas de visualización tienen un límite específico de 100 solicitudes por segundo, con una
  ráfaga de 200 por IP. Los demás endpoints conservan el límite general existente.
- El backend declara una vigencia pública de dos segundos y mantiene un límite defensivo propio de
  600 solicitudes por minuto para estas lecturas.

## Base de datos y actualización

- No se agregan migraciones ni se modifica el esquema Prisma.
- No corresponde ejecutar seeds, resets ni operaciones sobre volúmenes de PostgreSQL.
- La actualización requiere reconstruir `disal-backend` y recargar o reiniciar `disal-nginx`.
- El reinicio del backend descarta únicamente las últimas lecturas de peso mantenidas en memoria;
  Node-RED las repone en su siguiente ciclo. Los estados, lotes, usuarios e históricos permanecen
  en PostgreSQL.

## Verificación realizada

- Los 14 suites y 75 tests unitarios del backend finalizaron correctamente.
- El backend compiló correctamente con NestJS.
- Los archivos TypeScript modificados superaron ESLint y Prettier.
- `git diff --check` no detectó errores de espacios en el cambio.
- La validación `nginx -t` queda como comprobación previa al despliegue porque el ejecutable de
  Docker/Nginx no estaba disponible en el entorno de desarrollo usado para preparar la versión.

## Consideraciones de actualización

- Antes de reiniciar Nginx, ejecutar `docker compose run --rm --no-deps disal-nginx nginx -t`.
- Después del despliegue, consultar dos veces `/api/plants/tv` y verificar primero
  `X-Plant-TV-Cache: MISS` y luego `X-Plant-TV-Cache: HIT`.
- Configurar Grafana contra `/api/plants/tv` cuando un tablero necesite varias plantas y filtrar por
  `plantCode` para evitar consultas redundantes.
