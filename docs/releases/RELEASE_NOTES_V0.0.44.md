# LATEX V0.0.44

**Fecha de publicación:** 18 de octubre de 2026.

[← Historial de versiones](README.md)

## Resumen

Versión de corrección sobre `V0.0.43` para que la validación del backend en GitHub Actions use sin errores el formato exigido por la versión de Prettier fijada en `package-lock.json`. Incluye íntegramente las funcionalidades y la documentación Woojin descritas en [V0.0.43](RELEASE_NOTES_V0.0.43.md).

## Correcciones

- Se ajusta el formato de dos uniones de tipos en el DTO de telemetría de inyectoras. No cambia el contrato HTTP ni el comportamiento en ejecución.

## Base de datos

Sin migraciones de Prisma ni cambios en PostgreSQL. El historial opcional de ENVASES continúa requiriendo un bucket InfluxDB dedicado, según las notas de `V0.0.43`.

## Variables de entorno y configuración

Sin cambios adicionales respecto de `V0.0.43`. `INFLUXDB_ENVASES_BUCKET` sigue siendo opcional y deshabilitado cuando está vacío.

## Actualización

Tag objetivo: `V0.0.44`. Para actualizar una instalación existente, seguir [ACTUALIZACION_SERVIDOR.md](../ACTUALIZACION_SERVIDOR.md) y reconstruir backend y frontend para incorporar también los cambios de `V0.0.43`. La publicación en GitHub no actualiza el servidor ni el Node-RED industrial externo.

## Verificaciones realizadas

- Prettier `3.8.1`, la versión fijada para CI: DTO corregido aprobado.
- Las verificaciones funcionales de `V0.0.43` siguen siendo aplicables porque sólo cambió el formato de dos tipos: 17 suites y 131 pruebas de backend, builds de backend/frontend y pruebas del flujo externo y simulador aprobados localmente.
- El fallo observado en la CI de `V0.0.43` se limitó al lint de esas dos líneas; los jobs de frontend, Compose, configuración E2E y verificación de tag aprobaron. La CI de este nuevo tag se informa por separado cuando termine.

## Limitaciones conocidas

Continúan las limitaciones industriales y de puesta en marcha detalladas en `V0.0.43`: no se validó la integración productiva con CMS, Node-RED externo o InfluxDB de planta.
