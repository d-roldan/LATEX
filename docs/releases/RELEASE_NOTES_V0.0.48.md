# LATEX V0.0.48

**Fecha de publicación:** 21 de octubre de 2026.

[← Historial de versiones](README.md)

## Resumen

Corrige la identificación de las cinco inyectoras de ENVASES para que las lecturas de Node-RED vuelvan a aparecer en las tarjetas. Mejora la presentación decimal de tiempos en la pantalla de inyectoras.

## Mejoras

- Los tiempos de ciclo y de etapas se muestran en segundos con al menos un decimal.

## Correcciones

- `INY01` corresponde a `172.16.0.145` y `TB200G5`; `INY02` a `.144`; `INY03` a `.143`; `INY04` a `.146`; `INY05` a `.141`. El catálogo del backend, los flujos de ejemplo, el simulador local y su documentación usan el mismo mapa.
- El backend deja de rechazar por código incorrecto los lotes enviados con la nueva numeración de Node-RED.

## Cambios técnicos

- Se actualizaron pruebas de recepción HTTP, servicio y flujos Node-RED para la nueva correspondencia entre IP y código.

## Base de datos

Sin migraciones ni cambios de esquema. Los puntos históricos de InfluxDB escritos con los códigos anteriores conservan su significado original; no se migran automáticamente.

## Variables de entorno y configuración

Sin cambios. El Node-RED externo debe enviar el mismo `equipment_code` para cada IP; los flujos del repositorio son ejemplos y no actualizan por sí solos el flujo externo.

## Actualización

Tag objetivo: `V0.0.48`. Seguir [ACTUALIZACION_SERVIDOR.md](../ACTUALIZACION_SERVIDOR.md) y reconstruir backend y frontend. No ejecutar migraciones. Confirmar en la respuesta del POST de Node-RED `accepted: 5`, `rejected: 0`, y en la consulta de TV cinco lecturas frescas con códigos coincidentes. Publicar en GitHub no actualiza el servidor productivo ni el Node-RED externo.

## Verificaciones realizadas

- Herramientas alineadas con lockfiles: `node scripts/check-release-toolchain.mjs`.
- Backend: 2 suites enfocadas, 20 pruebas aprobadas; lint, formato y compilación NestJS aprobados.
- Frontend: lint y formato del componente cambiado, TypeScript y build Vite aprobados.
- Node-RED: pruebas enfocadas DBS (8), flujo externo y simulador aprobadas.
- Docker local: backend reconstruido y saludable; TV respondió con cinco códigos correctos y cinco lecturas frescas. `git diff --check` aprobado.

## Limitaciones conocidas

- No se probó la publicación contra el Node-RED externo ni se actualizó producción.
- Las series históricas anteriores al cambio pueden mezclar equipos si se consultan únicamente por código; requieren correspondencia IP/código y fecha de corte verificada antes de una migración.
