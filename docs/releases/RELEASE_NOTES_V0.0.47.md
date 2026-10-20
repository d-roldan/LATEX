# LATEX V0.0.47

**Fecha de publicación:** 20 de octubre de 2026.

[← Historial de versiones](README.md)

## Resumen

Mejoras de las pantallas TV de Látex y ENVASES, y ampliación del historial de las inyectoras Woojin con estados operativos y disparos CMS consultados por archivo actual. La versión también incorpora los cambios de monitoreo ENVASES y del espejo DBS local acumulados desde `V0.0.46`.

## Nuevas funcionalidades

- El popup autenticado de cada inyectora muestra una línea histórica de estados: verde para producción en `AUTO`, rojo para `MANUAL`/`PARO`/`STOP` y gris cuando faltan lecturas recientes. Los cambios y latidos se registran en el bucket InfluxDB dedicado de ENVASES desde su activación.
- El popup permite consultar por páginas los disparos de `shot_data` y parámetros vinculados de `shot_data_rec` del archivo actual informado por DBS. La coincidencia es por nombre de archivo y **no atribuye** los disparos antiguos a una IP.
- El contrato de telemetría admite una descripción opcional de alarma. Cuando la fuente sólo entrega el código, la interfaz indica que la descripción no está disponible.
- El flujo DBS local incorpora el nombre del archivo actual de cada inyectora, conservando vacíos y rechazando nombres inválidos. Se incluyen ejemplos de flujo y un script de diagnóstico CMS de solo lectura.

## Mejoras

- La TV de Látex muestra el peso específico en los tanques aprobados y unifica los campos de las tarjetas secundarias en recuadros. Se ajustó la distribución para pantallas Full HD y tamaños menores, sin cambiar la tarjeta destacada del tanque en envasado.
- La TV de ENVASES muestra el modo **Operación**, el tiempo de producción reportado y la **Velocidad promedio · envases/h**. Se quitaron de las tarjetas los campos sin valor para la vista pública: último disparo, cavidades y total reportado CMS.
- La lectura operativa vigente en `AUTO` se rotula **Produciendo**; `MANUAL`, `PARO` y `STOP` se rotulan **Detenida**. Una alarma conserva su indicación separada y no sustituye el modo.

## Cambios técnicos

- El backend agrega `mysql2` y un endpoint autenticado para consultar CMS con acceso a ENVASES, SQL parametrizado, transacción de solo lectura y paginación acotada.
- El historial ENVASES puede usar `INFLUXDB_ENVASES_TOKEN` para el bucket dedicado; si falta, conserva el token general configurado.
- Se actualizaron documentación, ejemplos y pruebas del contrato Woojin y del flujo Node-RED local.

## Base de datos

Sin migraciones de Prisma ni cambios de esquema PostgreSQL. La serie nueva de estados requiere un bucket InfluxDB dedicado de ENVASES para persistir datos nuevos. La lectura de disparos consulta tablas CMS existentes y no escribe en ellas.

## Variables de entorno y configuración

- Nuevas variables opcionales del backend: `INFLUXDB_ENVASES_TOKEN`, `CMS_DB_HOST`, `CMS_DB_PORT`, `CMS_DB_USER`, `CMS_DB_PASSWORD` y `CMS_DB_NAME`. Están documentadas en `.env.example` y propagadas por `docker-compose.yml`.
- Para activar CMS fuera del entorno local, usar una cuenta con permiso `SELECT` limitado a `disal_cms`; la cuenta disponible durante el diagnóstico tenía privilegios más amplios. Sin conexión CMS configurada, el popup informa que está pendiente y la TV sigue operando.
- La serie de estados comienza al habilitar el bucket histórico. Revisar retención y respaldo del bucket antes de activarlo en el servidor.

## Actualización

Tag objetivo: `V0.0.47`. Para actualizar un servidor existente, seguir [ACTUALIZACION_SERVIDOR.md](../ACTUALIZACION_SERVIDOR.md) y reconstruir backend y frontend. No aplicar migraciones Prisma para esta versión. Configurar CMS e InfluxDB sólo si se desean los nuevos historiales. El flujo Node-RED externo se importa y activa manualmente según [INTEGRACION_ENVASES_DBS_API.md](../INTEGRACION_ENVASES_DBS_API.md); el `flows.json` incluido es local/demo y no sustituye al Node-RED externo compartido. Publicar esta versión en GitHub no actualiza el servidor.

## Verificaciones realizadas

- `node scripts/check-release-toolchain.mjs`: herramientas locales alineadas con ambos lockfiles luego de `npm ci` en backend y frontend.
- Backend: lint y formato de los archivos modificados, 3 suites enfocadas con 28 pruebas, suite completa de 17 suites y 138 pruebas, y compilación NestJS.
- Frontend: lint y formato de los componentes modificados, 5 pruebas de estado/línea temporal, y build de producción.
- Node-RED: 10 pruebas enfocadas del flujo DBS y comprobaciones de estructura de las ramas TCP y externa; los escenarios relevantes aprobaron.
- `docker compose config -q`: configuración Compose válida.
- Revisión de las pantallas TV locales en Full HD (1920 × 1080) y 1280 × 720, y reconstrucción previa del frontend Docker local.
- `git diff --check` y `node scripts/verify-release.mjs V0.0.47` antes de publicar.

## Limitaciones conocidas

- La conexión CMS y el bucket InfluxDB son opcionales y no se validaron contra el servidor productivo. El histórico de estados comienza desde su activación; los disparos anteriores por archivo no demuestran qué máquina los produjo.
- La edad interna de adquisición DBS y la unidad física de las temperaturas siguen pendientes de verificación industrial. La prueba del simulador Node-RED local requiere la ruta `/data` de su contenedor y no se ejecutó en Windows.
