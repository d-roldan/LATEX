# LATEX V0.0.39

**Fecha de publicación:** 16 de octubre de 2026

## Resumen

Esta versión amplía la información operativa y el historial de Látex, incorpora un ajuste de Laboratorio sin materiales y agrega procedimientos de validación y publicación para las próximas entregas.

## Nuevas funcionalidades

- La tarjeta destacada del tanque envasando en la TV de LATEX muestra la OF además de la OE, con una fila adicional para conservar visibles todos los datos.
- El historial contraído por OF muestra el semielaborado y permite descargar un PDF con todas las páginas de estados que coinciden con los filtros y la búsqueda. El detalle de la OF muestra el peso específico, que también figura en su PDF de trazabilidad.
- Laboratorio puede solicitar o corregir un ajuste cuyo único motivo sea «Agitación/Recirculación» sin indicar materiales. Cuando se informan materiales, conservan sus validaciones; los demás motivos siguen requiriendo al menos uno.

## Mejoras

- La consulta paginada del historial ordena de manera estable y descarta valores de `offset` inválidos.
- El flujo de simulación Node-RED incluido en el repositorio queda habilitado y enlaza la salida de pesos de Látex. Es un flujo local de demostración; el Node-RED externo de producción se administra por separado.

## Cambios técnicos

- Se incorporan workflows de CI para validar los paquetes afectados por cada cambio y un workflow manual para E2E industrial en un Compose descartable, con preflight que impide apuntar al stack operativo.
- Se agregan instrucciones de migraciones por entorno, el procedimiento de release, la plantilla de notas, el verificador de tags y ajustes a las instrucciones y skills del proyecto.
- `prisma:migrate` pasa a ser un alias de `prisma migrate deploy`; deja de ejecutar `db push` sobre bases persistentes.

## Base de datos

No se agregan migraciones ni cambios de esquema. La modificación de `prisma:migrate` cambia el comando disponible, no aplica una migración nueva.

## Variables de entorno y configuración

La aplicación no requiere variables nuevas. El workflow E2E manual necesita un runner y credenciales/variables de prueba para el entorno aislado `latex-e2e`, según `e2e/README.md`.

## Actualización

Para una instalación existente, usar el tag `V0.0.39` y seguir `docs/ACTUALIZACION_SERVIDOR.md`. Reconstruir backend y frontend; comprobar el estado del migrador sin ejecutar seeds ni `db push`. No iniciar ni recrear el Node-RED externo de producción desde este proyecto. Si se usa el Node-RED local de demostración, revisar que el flujo habilitado sea apropiado para ese entorno.

Esta publicación actualiza los repositorios Git. No actualiza el servidor productivo.

## Verificaciones realizadas

- Backend: 14 suites y 108 pruebas correctas; lint y formato de los archivos afectados correctos; compilación y reconstrucción local de Docker correctas.
- Frontend: lint y formato de los archivos afectados correctos; compilación TypeScript/Vite y reconstrucción local de Docker correctas. La tarjeta TV se comprobó en 1920×1080 y 1366×768 con OF y OE visibles y sin desbordes.
- El generador del PDF resumido produjo un PDF válido con datos de prueba. La suite E2E nueva enumeró cuatro escenarios; los archivos JavaScript, el JSON de Node-RED y la configuración Compose se validaron. Backend y frontend locales respondieron por HTTP.
- `scripts/verify-release.mjs` se comprobó con `V0.0.38`; el tag de esta versión se verificará después de crearlo y antes de publicarlo.

## Limitaciones conocidas

- Los cuatro escenarios E2E industriales no se ejecutaron: requieren un runner y una base `latex-e2e` descartables, ajenos al stack local en uso. El workflow manual queda preparado.
- El lint general del backend en esta copia de Windows marca CRLF en archivos no modificados; la comprobación enfocada de esta versión pasó. La CI sobre checkout Linux queda pendiente del push.
