# LATEX V0.0.46

**Fecha de publicación:** 19 de octubre de 2026.

[← Historial de versiones](README.md)

## Resumen

Versión de corrección sobre `V0.0.45`. Incluye íntegramente la integración DBS de cinco inyectoras Woojin con ENVASES descrita en [V0.0.45](RELEASE_NOTES_V0.0.45.md) y ajusta dos uniones de tipos del DTO al formato de Prettier fijado en la CI.

## Correcciones

- Se restaura el formato de `delta_contador_observado` y `source` en el DTO de inyectoras. No cambia el contrato HTTP ni el comportamiento en ejecución.
- La CI de `V0.0.45` falló sólo en el paso de lint del backend por estas dos líneas; los jobs de frontend, Compose y configuración E2E aprobaron.

## Base de datos

Sin migraciones de Prisma ni cambios en PostgreSQL. El bucket InfluxDB dedicado de ENVASES continúa siendo opcional.

## Variables de entorno y configuración

Sin cambios adicionales respecto de `V0.0.45`. Se mantienen `DISAL_API_BASE_URL` y `DISAL_ENVASES_INTEGRATION_KEY` en el Node-RED externo y `INFLUXDB_ENVASES_BUCKET` opcional en el backend.

## Actualización

Tag objetivo: `V0.0.46`. Para actualizar ApiDisal en un servidor existente, seguir [ACTUALIZACION_SERVIDOR.md](../ACTUALIZACION_SERVIDOR.md) y reconstruir backend y frontend. El flujo Node-RED externo se activa manualmente según [INTEGRACION_ENVASES_DBS_API.md](../INTEGRACION_ENVASES_DBS_API.md). Publicar en GitHub no actualiza el servidor ni el Node-RED compartido.

## Verificaciones realizadas

- Antes de esta corrección de formato, las 17 suites y 133 pruebas del backend aprobaron localmente; también aprobaron la compilación NestJS, el build frontend y 13 pruebas de flujos Node-RED.
- La CI de `V0.0.45` identificó exactamente dos errores de formato en el DTO; ambas líneas se devolvieron a la disposición que ya aprobaba la CI en `V0.0.44`. La CI de este nuevo tag se verifica por separado.

## Limitaciones conocidas

Continúan las limitaciones de puesta en marcha de `V0.0.45`: el servidor ApiDisal aún no se actualizó y los lotes reales fueron rechazados por su contrato anterior. La edad interna de adquisición DBS y la escala física de las temperaturas siguen sin comprobarse. `infra/node-red/data/flows.json` local/demo conserva cambios de trabajo fuera de esta release.
