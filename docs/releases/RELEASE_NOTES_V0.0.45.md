# LATEX V0.0.45

**Fecha de publicación:** 19 de octubre de 2026.

[← Historial de versiones](README.md)

## Resumen

Integra la lectura de solo consulta de las cinco inyectoras Woojin desde la API TCP de DBS con la telemetría de ENVASES. El flujo importable de Node-RED identifica cada máquina por IP y prepara estados, producción, ciclos y pares de temperatura actual/consigna. La activación del Node-RED externo y la actualización del servidor de ApiDisal son pasos operativos separados de esta publicación.

## Nuevas funcionalidades

- El contrato HTTP de ENVASES acepta `telemetry_origin=DBS_API`, cantidad objetivo, cantidad defectuosa y ocho zonas con temperatura actual y consigna. El panel identifica el origen DBS y muestra estos valores con indicación de antigüedad.
- Cuando se configura `INFLUXDB_ENVASES_BUCKET`, el backend guarda estados y temperaturas DBS en mediciones históricas separadas.
- Se entrega un flujo Node-RED importable y deshabilitado por defecto que consulta `0,<IP>`, `8,<IP>` y `2,<IP>` a DBS, valida firma, longitud e IP y publica una lectura por máquina en ApiDisal. Incluye diagnóstico acotado de respuestas y errores HTTP.

## Mejoras

- El flujo SQL Woojin anterior distingue filas `real_data` obsoletas y evita presentar las detenidas el 17/10/2026 como estado actual. Sus ramas opcionales de InfluxDB permanecen deshabilitadas y sólo atribuyen disparos cuando CMS proporciona una identidad de máquina inequívoca.
- Se documentan las evidencias de DBS, la correspondencia de modelos e IP, el incidente de bloqueo del cliente Node-RED y el rechazo HTTP `400` observado en la versión anterior del backend.

## Base de datos

No hay migraciones de Prisma ni cambios en PostgreSQL. Para el historial opcional se requiere un bucket InfluxDB dedicado mediante `INFLUXDB_ENVASES_BUCKET`; sin esa configuración, la visualización actual puede funcionar, pero el histórico no se escribe.

## Variables de entorno y configuración

- En Node-RED externo: `DISAL_API_BASE_URL` debe terminar en `/api` y `DISAL_ENVASES_INTEGRATION_KEY` debe corresponder a la integración `NODE_RED_ENVASES` de ApiDisal. El JSON no contiene claves.
- En el backend: `INFLUXDB_ENVASES_BUCKET` es opcional para el histórico.
- Las variables `DISAL_ENVASES_INFLUX_*` pertenecen sólo a las ramas opcionales y deshabilitadas del flujo SQL alternativo. No son necesarias para el nuevo flujo DBS, cuyo histórico lo escribe el backend.

## Actualización

Tag objetivo: `V0.0.45`. Seguir [ACTUALIZACION_SERVIDOR.md](../ACTUALIZACION_SERVIDOR.md), reconstruir backend y frontend y verificar el contrato HTTP antes de reactivar el flujo externo. La versión instalada antes de esta release rechaza los cuatro campos nuevos con `400 Bad Request`. La pestaña Node-RED compartida se importa y habilita manualmente conforme a [INTEGRACION_ENVASES_DBS_API.md](../INTEGRACION_ENVASES_DBS_API.md); no se modifica el contenedor externo desde el Compose de LATEX. Desactivar el publicador SQL anterior para evitar dos fuentes simultáneas. Comprobar `API_ACEPTADA` para las cinco IP, la pantalla ENVASES y el envejecimiento al perder señal.

## Verificaciones realizadas

- Backend local: 17 suites y 133 pruebas aprobadas; incluye recepción HTTP de los cuatro campos DBS y rechazo de una zona inválida. Compilación NestJS aprobada.
- Frontend local: TypeScript sin errores y build Vite aprobado; lint y formato del archivo modificado aprobados.
- Node-RED: 13 pruebas de flujos DBS, diagnósticos y flujo SQL alternativo aprobadas. La lectura real desde `10.1.2.44` completó `0 → 8 → 2` para las cinco IP, según Debug del operador el 19/10/2026.
- Lint y Prettier enfocados del backend aprobados. El lint global de este checkout Windows falla por finales de línea `CRLF` de archivos no modificados; no se reformateó el resto del repositorio para esta release.

## Limitaciones conocidas

- No se actualizó ApiDisal productivo ni se verificó aceptación HTTP con el backend nuevo en ese servidor. Antes de la actualización, los lotes reales recibieron `400` y no hay confirmación de persistencia ni de visualización.
- DBS responde a consultas actuales, pero la edad de su adquisición industrial interna y la escala física de temperatura aún no están comprobadas. No se atribuyen los disparos históricos cuyo `Machine_Name` es `-`.
- El archivo `infra/node-red/data/flows.json` del entorno local/demo conserva cambios de trabajo y no forma parte de esta release ni del Node-RED productivo compartido.
