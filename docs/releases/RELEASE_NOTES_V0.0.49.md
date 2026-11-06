# LATEX V0.0.49

**Fecha de publicación:** 6 de noviembre de 2026.

[← Historial de versiones](README.md)

## Resumen

Incorpora Reportería industrial de solo lectura para las plantas autorizadas, mejora el resumen de HISTORIAL y agrega una corrección administrativa auditada para retroceder estados de tanques. Los informes de Laboratorio se pueden descargar en PDF con identidad de Grupo DISAL y en Excel.

## Nuevas funcionalidades

- Pantalla **Reportería** con resumen general, análisis de Laboratorio, Producción y centro de informes. Permite filtrar por mes o rango de fechas y seleccionar una, varias o ninguna de las plantas autorizadas. El backend vuelve a aplicar el alcance de empresa, rol y planta.
- Indicadores de OF, muestras, decisiones y ajustes; Pareto de motivos y de materiales de la OF, con cruce material–motivo y detalle de las solicitudes. Los indicadores muestran su población y los datos insuficientes se señalan expresamente.
- Informe de Laboratorio en PDF de Grupo DISAL y libro Excel. Pantalla, PDF y Excel comparten filtros y datos de origen; los rangos personalizados se identifican en el archivo descargado.
- Acción **Retroceder estado** exclusiva de `ADMIN`, con vista previa, motivo obligatorio, control de versión y transacción auditada. La corrección conserva trazabilidad y marca los registros operativos anulados, en lugar de borrarlos.

## Mejoras y correcciones

- HISTORIAL dispone de un resumen por OF paginado y ordenado en backend. El PDF resumido usa el producto del lote, cuenta solicitudes de ajuste y deja de mostrar «Estados en el período»; la trazabilidad individual permanece disponible.
- Desde Reportería se puede abrir la OF correspondiente en HISTORIAL. Los estados y las muestras anulados por un retroceso se identifican en la trazabilidad y se excluyen de los totales vigentes.
- La interfaz de Reportería adopta los botones y controles del sistema, elimina la navegación interna y los acentos laterales de las tarjetas, y evita la superposición del título con los controles superiores. Las casillas de plantas tienen tamaño uniforme y el botón alterna entre «Seleccionar todo» y «Deseleccionar todo».
- Las pantallas TV sincronizan su hora con el servidor y evitan reutilizar contenido local antiguo; estos cambios ya estaban en `main` después de `V0.0.48` y forman parte del diff acumulado de esta versión.

## Cambios técnicos

- Nuevo módulo NestJS `reporting` con consultas acotadas por empresa y plantas autorizadas; contratos para resumen, Laboratorio, ajustes, Producción y OF.
- Nueva dependencia frontend `exceljs` para el libro de Laboratorio. Se agrega un importador de datos históricos **solo para entorno local**, sin ejecución automática ni datos industriales en Git.
- Se documentan la auditoría, los indicadores, la arquitectura, la experiencia de informes y el plan de implementación en `docs/reporteria/`.

## Base de datos

Tres migraciones agregan `cancelledAt` a `QualityDecision`, `LaboratorySample`, `ProductionLot`, `PackagingOrder` y `TransferOperation`. Son necesarias para distinguir los registros anulados mediante retroceso de los vigentes. **No se ejecutaron en producción** como parte de esta publicación. No se modifican automáticamente datos históricos.

## Variables de entorno y configuración

Sin variables nuevas. La importación histórica local requiere un archivo NDJSON externo, respaldo previo y una ejecución deliberada; el archivo de datos no forma parte de la versión.

## Actualización

Tag objetivo: `V0.0.49`. Seguir [ACTUALIZACION_SERVIDOR.md](../ACTUALIZACION_SERVIDOR.md): respaldar, revisar y aplicar las tres migraciones en la ventana autorizada, y reconstruir **backend y frontend**. Confirmar permisos por planta, consultas de Reportería, descarga de informes y vista previa del retroceso antes de habilitar su uso. La confirmación de un retroceso exige cotejar el estado físico del tanque. Publicar en GitHub no actualiza el servidor ni el Node-RED externo.

## Verificaciones realizadas

- `node scripts/check-release-toolchain.mjs`: herramientas alineadas con lockfiles.
- Backend: build Docker; 20 suites y 173 pruebas aprobadas; lint y Prettier de los archivos modificados aprobados. El lint completo ejecutado sobre el checkout Windows marcó finales de línea CRLF en archivos ajenos al cambio; la CI valida los TypeScript modificados.
- Frontend: build Docker, lint completo y Prettier de los archivos modificados aprobados.
- Prisma: esquema válido. Sobre un esquema descartable de `V0.0.48`, las tres migraciones aplicaron y `prisma migrate diff` no encontró diferencias con el esquema vigente. `prisma migrate status` indicó 31 migraciones al día en el Compose local.
- En el navegador local se comprobaron selección y deselección de plantas, rango 01/11/2026–04/11/2026, actualización de totales, descarga PDF y distribución móvil de Reportería. La vista previa del retroceso y el rechazo de una versión obsoleta se comprobaron por HTTP local; las escrituras de retroceso se verificaron con pruebas transaccionales simuladas.

## Limitaciones conocidas

- No hay una fuente validada de kg efectivamente fabricados por OF. La cantidad planificada no se presenta como producción real; tampoco se calcula OEE.
- Los datos históricos pueden tener cobertura incompleta o descripciones de producto incorrectas. No se reparan automáticamente. Las decisiones corregidas se informan según su valor vigente y la auditoría disponible.
- La instalación desde una base completamente vacía sigue el procedimiento de baseline del repositorio: la cadena histórica de migraciones no se probó como instalación nueva y una migración anterior a esta versión espera `OrderStage`. Sí se verificó la actualización del esquema desde `V0.0.48`.
- No se desplegó en producción ni se ejecutó un retroceso real sobre un tanque operativo durante esta validación. Las plantillas de informes adicionales previstas en el plan maestro permanecen pendientes.
