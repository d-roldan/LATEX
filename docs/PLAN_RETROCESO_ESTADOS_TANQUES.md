# Retroceso administrativo de estados de tanques

## Alcance de la primera entrega

Una acción **Retroceder estado** permite corregir el último avance verificable del lote activo. Sólo el rol `ADMIN` puede consultar la vista previa y ejecutar la corrección. La asignación a la planta y la empresa sigue siendo obligatoria.

| Estado actual | Destino | Condición | Registro afectado |
| --- | --- | --- | --- |
| `LABORATORIO` | `FABRICANDO` o `AJUSTE`, según el estado anterior real | La muestra vigente pertenece al lote y todavía no tiene una decisión de calidad vinculada | La muestra queda anulada aunque haya sido recibida o esté en análisis |
| `FABRICANDO` al inicio del lote | `VACIO` | Todos los avances posteriores del lote ya fueron retrocedidos | El lote queda anulado y deja de ser el lote activo |
| `ENVASANDO` o `TRASVASANDO` | `APROBADO` | Existe una operación vigente del lote | Las OE o el trasvase quedan anulados con auditoría |
| `VACIO` tras finalizar un lote | `ENVASANDO`, `TRASVASANDO` o `RECHAZADO` | El lote terminado corresponde al último período real | El lote vuelve a estar activo y se reabre la operación final si corresponde |
| `FUERA_DE_SERVICIO` o `VACIO` tras un cambio de servicio | `VACIO` o `FUERA_DE_SERVICIO`, respectivamente | El historial permite identificar el cambio anterior | Se recupera el estado de servicio anterior |
| `APROBADO`, `AJUSTE` o `RECHAZADO` | `LABORATORIO` | La decisión vigente corresponde a la última muestra y no hay envasado ni trasvase posterior | La decisión queda anulada, el análisis vuelve a curso y se quita la tarjeta de planificación si existe, aunque figure conectada |
| Los mismos estados en un lote anterior sin registros de muestras | `LABORATORIO` | La decisión vigente se creó durante el período de Laboratorio inmediatamente anterior y el lote nunca tuvo muestras registradas | Se anula la decisión y se solicita una muestra nueva |

Cada confirmación retrocede un paso efectivo. El cálculo descuenta los retrocesos previos del historial, por lo que se puede repetir la acción hasta volver de `FABRICANDO` a `VACIO`. También se pueden deshacer el inicio y el cierre de envasado o trasvase, el vaciado de un lote rechazado y los cambios de servicio. Un tanque vacío sin un paso anterior verificable no ofrece un destino de retroceso. La confirmación exige comprobar físicamente el tanque, especialmente si la muestra ya fue recibida, hay producción envasada o la tarjeta indica conexión a una dosificadora.

## Contrato y garantías

1. La vista previa indica origen, destino, versión y registro que se anulará. No modifica datos.
2. La confirmación exige motivo. El servidor vuelve a leer todo dentro de una transacción serializable y comprueba versión, estado, lote, historial, permisos y dependencias posteriores.
3. El cambio incrementa la versión del tanque, cierra el período vigente, abre uno nuevo y escribe auditoría `ROLLBACK`. La decisión o muestra anulada conserva su identidad y fecha de anulación en la trazabilidad. La excepción para lotes anteriores sin muestras nunca inventa una recepción o un análisis previo: crea una solicitud nueva pendiente de recepción.
4. La operación notifica al sector al que vuelve el tanque. Las pantallas operativas excluyen decisiones y muestras anuladas; la trazabilidad las muestra marcadas. Si elimina una tarjeta de planificación, guarda sus datos en la auditoría y compacta las posiciones restantes en la misma transacción.
5. Ante un cambio concurrente o una condición incumplida, la API rechaza la solicitud sin aplicar un retroceso parcial.

## Verificación

- Rol `ADMIN` autorizado y demás roles denegados, incluso ante la excepción general de `isSystemOwner`.
- Transiciones permitidas y rechazadas, con motivo y versión obligatorios.
- Conservación de historial y auditoría; exclusión de registros anulados de la operación vigente.
- Compilación de backend y frontend, validación de Prisma y migración local.
- Reconstrucción dirigida de backend y frontend en Docker local, salud de contenedores y comprobación HTTP de los endpoints.

El operador debe comprobar el estado físico del tanque antes de confirmar. La aplicación no puede inferir por sí sola si la muestra fue efectivamente enviada o si hubo trabajo físico no registrado.

## Resultado de esta implementación local

- Prisma validó el esquema y la migración `20261027120000_tank_state_rollback` se aplicó en el PostgreSQL del Compose local.
- Las 48 pruebas del servicio de planta pasaron, incluidos retrocesos consecutivos, muestras, decisiones, OE, trasvases, cierres de lote, cambios de servicio y anulación del lote al volver a vacío. Backend y frontend compilaron y los archivos modificados pasaron lint.
- Backend y frontend se reconstruyeron en Docker; ambos responden y el backend está saludable.
- En HTTP local se verificaron `401` sin sesión, vista previa de `AJUSTE → LABORATORIO` con Administrador y `409` para una versión desactualizada, sin cambio del estado ni de la versión. Después de esta ampliación, las vistas previas ofrecen TK101 `LABORATORIO → AJUSTE` tras un primer retroceso, TK102 `VACIO → ENVASANDO`, TK103 `ENVASANDO → APROBADO` y TK104 `FABRICANDO → VACIO`.
- No se ejecutó un retroceso exitoso sobre un tanque operativo local: la validación de escritura se hizo en pruebas transaccionales con datos simulados. El entorno E2E descartable del proyecto no estaba disponible en este host mientras el Compose local seguía activo.

## Compatibilidad con lotes anteriores

TK101 y TK108 de Látex conservan decisiones de aprobación creadas en su último período de Laboratorio, pero no tienen registros de muestras. La vista previa admite ahora ese patrón histórico y, si se ejecuta el retroceso, crea una solicitud de muestra pendiente de recepción. Ambos tanques tienen tarjetas de planificación de envasado; la confirmación del retroceso indica que las quitará, con auditoría. La marca de conexión en una tarjeta no bloquea la corrección administrativa.
