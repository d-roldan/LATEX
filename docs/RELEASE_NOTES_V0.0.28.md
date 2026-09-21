# DISAL Planta de Látex · V0.0.28

Fecha: 21 de septiembre de 2026.

## Resumen

Esta versión mejora la coordinación entre Fabricación y Laboratorio, incorpora métricas específicas del ciclo de muestras, formaliza la asignación de usuarios por planta y prepara una entrada durable e idempotente para futuras integraciones PLC/SCADA. También amplía la documentación operativa del despliegue Docker y de la arquitectura industrial.

## Recepción de muestras de Laboratorio

- Cada envío desde Fabricación abre una nueva iteración de muestra en estado `AWAITING_RECEIPT`.
- La pantalla de Laboratorio muestra **Recibí la muestra** antes de habilitar la decisión de calidad.
- La confirmación registra usuario y horario, incrementa la versión operativa y cambia el subestado a `RECEIVED` sin modificar el estado físico `LABORATORIO` del tanque.
- El backend impide aprobar, solicitar ajuste o rechazar mientras la recepción física no haya sido confirmada.
- Aprobar, ajustar o rechazar resuelve la muestra y la vincula con su `QualityDecision`.
- Un reenvío posterior a un ajuste crea otra iteración y conserva las anteriores.
- Los tanques que ya estaban en Laboratorio al aplicar la migración reciben un ciclo pendiente compatible, tomando como inicio el período abierto cuando está disponible.

## Indicadores y trazabilidad

- Las tarjetas distinguen **Esperando recepción de muestra** y **Muestra recibida · En análisis**, con tiempo transcurrido en vivo.
- La trazabilidad de una OF muestra solicitud, recepción, resolución, responsables y duración de cada ciclo.
- Jefatura dispone de cantidades separadas para muestras esperando recepción y muestras en análisis.
- El resumen diario calcula el promedio envío–recepción y recepción–resultado usando los hitos del período consultado.
- La reconstrucción histórica determina correctamente qué muestras estaban pendientes al cierre de la fecha seleccionada, sin mezclarlas con pendientes actuales.
- Las exportaciones PDF y Excel incorporan los indicadores de Laboratorio.

## Usuarios y acceso por planta

- Crear un usuario exige seleccionar al menos una planta habilitada.
- Administración puede consultar las plantas activas, ver las asignaciones vigentes y modificarlas desde la pantalla de usuarios.
- El backend valida que todas las plantas seleccionadas pertenezcan a la misma empresa y estén activas.
- Las altas y bajas de membresías se realizan de forma transaccional, conservando las asignaciones que no cambiaron.
- Cada modificación de plantas queda registrada en Auditoría con los valores anteriores y posteriores.
- Los usuarios protegidos y el Super Usuario mantienen las restricciones administrativas existentes.

## Integración PLC / SCADA / Node-RED

- Se agregó `IntegrationInbox`, una bandeja PostgreSQL durable para eventos industriales.
- La unicidad por planta, fuente y `eventId` permite reintentar sin duplicar eventos.
- El contrato conserva por separado `occurredAt` y `receivedAt`, junto con tipo, secuencia y payload original.
- Las credenciales continúan asociadas a `PlantIntegration` y se comparan mediante su hash.
- La recepción admite lotes de hasta 100 eventos y devuelve cantidades aceptadas y duplicadas.
- Esta versión sólo recibe eventos en estado `RECEIVED`: no ejecuta automáticamente transiciones productivas.
- Se documentó la matriz de responsabilidades entre PLC, SCADA, Node-RED, InfluxDB y PostgreSQL, incluyendo los mapeos físicos que continúan pendientes.

## Base de datos y despliegue

- La migración `20260920090000_add_integration_inbox` crea la bandeja idempotente y sus índices.
- La migración `20260920100000_add_laboratory_sample_cycles` crea los ciclos de muestra y realiza el backfill de tanques que ya estén en Laboratorio.
- Se documentaron la función, comunicación, puertos, persistencia y límites de cada contenedor Docker.
- Se aclaró que `disal-migrate` y `disal-uploads-init` son trabajos de inicialización que deben finalizar con código `0`, no servicios permanentes.
- El simulador Node-RED permanece deshabilitado salvo configuración explícita mediante `DISAL_ENABLE_WEIGHT_SIMULATOR=true`.

## Verificación realizada

- El esquema Prisma fue validado y el cliente se generó correctamente.
- Backend compilado y 65 pruebas automatizadas aprobadas en 13 suites.
- Frontend validado con TypeScript y build productivo de Vite.
- Las imágenes Docker de backend, migrador y frontend se construyeron correctamente.
- Las dos migraciones se aplicaron mediante `prisma migrate deploy` sobre la instalación Docker local, con respaldo previo verificado mediante `pg_restore`.
- El inventario posterior conservó 1 empresa, 4 plantas, 17 equipos, 9 lotes activos y 82 períodos históricos.
- Backend, PostgreSQL y Node-RED quedaron saludables; Nginx respondió HTTP 200 y Látex devolvió sus 9 tanques.
- Se comprobó que el frontend servido contiene la acción **Recibí la muestra**.

## Consideraciones de actualización

- Antes de actualizar otra instalación se debe respaldar PostgreSQL, adjuntos, `.env` y runtime de Node-RED.
- Aplicar las migraciones con `disal-migrate` o `prisma migrate deploy`; no ejecutar seeds, `db push` ni resets.
- Laboratorio debe revisar los tanques que estaban en ese estado durante el despliegue y confirmar las muestras que ya haya recibido físicamente.
- Los procesadores de eventos industriales deben diseñarse y probarse por tipo antes de permitir que un evento del inbox cambie estados productivos.
- La construcción de la imagen informó 6 vulnerabilidades npm moderadas y 2 altas. No se aplicaron actualizaciones forzadas porque requieren una revisión de compatibilidad separada.
