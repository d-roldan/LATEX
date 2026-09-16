# Plan de implementación multiplanta DISAL

Fecha: 8 de septiembre de 2026. Estado: implementación completada y desplegada en Docker local; verificaciones de producción e integraciones físicas continúan pendientes.

## 1. Instrucción para la sesión ejecutora

Implementar este plan en el repositorio LATEX. Leer primero las instrucciones `AGENTS.md` aplicables, este documento y el código vigente. Ejecutar las etapas en orden, registrar avances y evidencias en este archivo y documentar las decisiones que cambien el diseño. No marcar tareas completas sin verificarlas.

El objetivo es operar Látex, Terplast, Slurry y Enduido desde una aplicación, con selector de planta, datos aislados por planta, flujo de trasvase para Slurry y recepción de pesos multipla​nta. Preservar todos los registros existentes durante la migración y las actualizaciones posteriores.

Trabajar y verificar en desarrollo y en bases de prueba aisladas. La ejecución del plan no autoriza intervenir una base productiva, desplegar en producción ni publicar en GitHub sin un pedido explícito para esas acciones. Preparar los artefactos y el procedimiento de despliegue para que puedan revisarse.

Al redactarse este plan existe una modificación local previa en `infra/node-red/data/flows.json`. Inspeccionarla y preservarla; no sobrescribirla ni incluirla inadvertidamente en un commit. Crear ejemplos de integración en archivos separados cuando sea posible.

## 2. Contexto confirmado y alcance

El flujo de coordinación entre sectores ya funciona desde hace más de seis meses en Sintéticos mediante tres Node-RED. Sintéticos sirve como referencia operativa; no forma parte de las cuatro plantas a incorporar en esta entrega. LATEX continúa por encima del control físico: PLC, SCADA y automatismos mantienen su responsabilidad de operación y seguridad.

| Planta | Fabricación | Operación final | Medición de peso |
|---|---|---|---|
| Látex | 9 tanques TK101–TK109 | Envasado | Existente mediante Node-RED |
| Terplast | 4 tanques | Envasado, 3 líneas | Disponibilidad y mapeo pendientes de confirmar |
| Slurry | 2 dispersoras | Trasvase a tanque exterior; sin envasado | Disponibilidad y mapeo pendientes de confirmar |
| Enduido | 2 tanques | Envasado, 2 líneas | Sin celdas de carga |

Slurry NO tiene una línea de envasado: esta corrección reemplaza cualquier descripción anterior. Su trasvase solamente necesita registrar inicio, fin, responsables y duración. Al finalizar, la dispersora vuelve a `VACIO` y puede iniciar otro lote. El seguimiento del tanque exterior queda fuera del alcance inicial.

Enduido muestra estados, datos productivos y descripción ingresada manualmente. No debe mostrar pesos inventados, medidores ni errores de balanza por ausencia de sensores.

La selección se realiza desde el encabezado superior izquierdo donde actualmente figura la planta Látex. Cada planta conserva sus equipos, configuración, lotes, notificaciones e históricos.

## 3. Reglas funcionales obligatorias

### 3.1 Estados y transiciones

Conservar los valores técnicos actuales y agregar `TRASVASANDO`, con etiqueta visible «Trasvase».

| Origen | Acción | Destino | Responsable |
|---|---|---|---|
| `VACIO` | Iniciar OF | `FABRICANDO` | Fabricación / Admin |
| `FABRICANDO` | Enviar a Laboratorio | `LABORATORIO` | Fabricación / Admin |
| `LABORATORIO` | Aprobar | `APROBADO` | Laboratorio / Admin |
| `LABORATORIO` | Solicitar ajuste | `AJUSTE` | Laboratorio / Admin |
| `AJUSTE` | Enviar nuevamente a Laboratorio | `LABORATORIO` | Fabricación / Admin |
| `LABORATORIO` | Rechazar | `RECHAZADO` | Laboratorio / Admin |
| `RECHAZADO` | Confirmar vaciado | `VACIO` | Fabricación / Admin |
| `APROBADO` | Iniciar OE | `ENVASANDO` | Envasado / Admin; plantas con envasado |
| `ENVASANDO` | Finalizar envasado | `VACIO` | Envasado / Admin; plantas con envasado |
| `APROBADO` | Iniciar trasvase | `TRASVASANDO` | Responsable autorizado de Slurry |
| `TRASVASANDO` | Finalizar trasvase | `VACIO` | Responsable autorizado de Slurry |
| `VACIO` | Sacar de servicio con motivo | `FUERA_DE_SERVICIO` | Fabricación / Admin |
| `FUERA_DE_SERVICIO` | Habilitar equipo | `VACIO` | Fabricación / Admin |

**Fuera de servicio es obligatorio para las cuatro plantas, incluidos los tanques sin peso y las dispersoras de Slurry.** Debe tener motivo, responsable, inicio, fin, duración, historial y presentación en TV e informes. Un equipo fuera de servicio no permite iniciar fabricación. Mantener la regla actual que sólo permite sacarlo de servicio estando vacío; no introducir interrupciones de lotes activos por mantenimiento sin definición funcional adicional.

Todas las escrituras mantienen autorización en backend, validación de versión, transacción y auditoría. Conservar correcciones de lote, ajustes repetidos y cambio/corrección de OE existentes, sin abrir transiciones arbitrarias.

### 3.2 Decisiones pendientes acotadas

Antes de habilitar operaciones reales de nuevas plantas confirmar:

- Nombres y códigos reales de equipos; no asumir tags físicos a partir de nombres provisorios.
- Sensores disponibles en Terplast y Slurry y variables de origen en Node-RED.
- Nombres de líneas, formatos y datos requeridos por planta. Para Látex se informaron 1, 4 y 20 L; revisar discrepancias de la configuración actual sin sobrescribir datos de producción automáticamente.
- Si Slurry conserva el paso por Laboratorio y quién inicia/finaliza trasvases. Usar el flujo con Laboratorio como hipótesis de diseño, documentada; preparar permisos configurables y confirmar la asignación antes de habilitar usuarios reales.
- Usuarios que operan cada planta y si Laboratorio atiende varias plantas.
- Qué datos manuales exige Enduido además de la descripción. Evitar exigir kilogramos medidos cuando no existen; no convertir falta de información en cero.

Estas preguntas no deben impedir construir el modelo, selector, aislamiento y pruebas. Usar fixtures claramente identificados en pruebas; mantener integraciones desconocidas deshabilitadas en producción hasta completar su mapeo.

## 4. Modelo objetivo y compatibilidad

- Conservar `Company` como empresa y su ID existente. Crear `Plant` relacionada con ella, con código estable, nombre, estado activo, orden de visualización y operación final (`PACKAGING` o `TRANSFER`).
- Mantener inicialmente la tabla `Tank` y sus IDs. Agregar pertenencia a planta y tipo de equipo (`TANK` / `DISPERSER`). La interfaz debe usar «Dispersora» en Slurry.
- Hacer opcional la clave de balanza. Configurar por equipo si tiene telemetría automática o no dispone de medición. Un peso manual, si se incorpora, debe conservar origen, hora y responsable; no es un requisito nuevo para esta entrega.
- Configurar equipos y líneas en base de datos. Los códigos de equipo deben ser únicos dentro de la planta, permitiendo el mismo nombre en plantas diferentes.
- Asociar lotes, períodos, calidad, OEs, trasvases, notificaciones, auditoría y cierres con su planta mediante claves y relaciones verificables. Si se duplica `plantId` en entidades hijas, impedir inconsistencias con el equipo/lote padre mediante restricciones y validaciones transaccionales.
- Crear `TransferOperation` asociada con planta, dispersora y lote: inicio, fin, duración y responsables. No crear OEs ficticias ni exigir formato, unidades, peso o destino para trasvasar.
- Al cerrar un trasvase, cerrar el lote y liberar el equipo en la misma transacción, conservando todas las referencias históricas.
- Crear permisos de acceso por usuario y planta; reutilizar roles existentes cuando sea suficiente. La asignación de trasvase debe ser explícita. Mantener los accesos actuales de Látex y no otorgar nuevas plantas automáticamente a todos los usuarios.
- Los cierres diarios deben ser únicos por planta y fecha. Mantener las fotografías JSON existentes sin reescribirlas; asignarlas a Látex mediante su registro contenedor y adaptar la lectura compatible.
- Mover configuración operativa al alcance de planta conservando exactamente los valores efectivos existentes de Látex. No aprovechar esta migración para sustituirlos por defaults nuevos.
- Preferir desactivar plantas, equipos y líneas con historia en vez de borrarlos en cascada.

## 5. Etapas de implementación

### Etapa A — Inventario y protección del punto de partida

- [x] Revisar estado Git e instrucciones locales; identificar cambios ajenos.
- [x] Leer `schema.prisma`, seeds, migraciones, servicio/controlador/DTO de planta, notificaciones, pantallas, Compose y documentación de integración.
- [x] Identificar valores fijos de nueve tanques, denominadores `/9`, nombres de planta, líneas, formatos, estados y claves de caché.
- [x] Identificar volumen real de PostgreSQL, configuración Compose y estrategia actual de despliegue sin mostrar secretos.
- [ ] Preparar una base aislada con datos representativos del esquema anterior: lotes activos, OE abierta, ajustes, rechazados, fuera de servicio, auditoría y cierres.
- [x] Guardar inventario de IDs, cantidades y valores relevantes antes de migrar.

Salida: inventario de cambios, riesgos concretos y conjunto reproducible de datos para probar conservación.

### Etapa B — Migraciones y persistencia antes de ampliar la operación

El comando actual `prisma:migrate` usa `db push`; los archivos de migración existentes no deben suponerse una cadena inicial completa. Auditar el esquema real y `_prisma_migrations` en una copia antes de sustituir el mecanismo.

- [x] Definir y documentar baseline compatible para bases existentes y recorrido de instalación desde cero. Nunca marcar una migración aplicada sin verificar que el esquema ya corresponde a ella.
- [x] Preparar migraciones versionadas y revisables; probar `prisma migrate deploy` con la historia reconciliada.
- [x] Garantizar que la imagen o servicio de migración incluye Prisma CLI: actualmente se declara como dependencia de desarrollo y la imagen runtime ejecuta `npm prune --omit=dev`.
- [x] Crear `Plant` y agregar columnas opcionales primero; crear Látex dentro de la empresa existente.
- [x] Completar la pertenencia de todos los registros actuales a Látex, manteniendo IDs, relaciones, estados, versiones, timestamps, cuentas y configuraciones.
- [x] Adaptar temporalmente la lectura de snapshots antiguos y registros legados que no tengan planta explícita.
- [x] Verificar integridad y ausencia de registros sin asignar antes de imponer `NOT NULL`, índices y nuevas restricciones.
- [x] Agregar `TRASVASANDO` y la persistencia de trasvases. Crear las otras plantas y sus equipos de manera idempotente, sin modificar registros ya existentes.
- [x] Separar instalación inicial, demo y actualización. El seed actual sobreescribe configuración y elimina ciertos registros: no debe ejecutarse en despliegues normales.
- [x] Probar tanto instalación limpia como actualización desde el esquema anterior y repetición de migraciones sin cambios adicionales.

Salida: migraciones probadas, conteos e IDs conservados, procedimiento de baseline y herramientas disponibles dentro del artefacto desplegable.

### Etapa C — Backend y aislamiento por planta

- [x] Incorporar listado de plantas autorizadas y contexto explícito en consultas/escrituras.
- [x] Validar que usuario, equipo, lote y operación pertenezcan a la empresa y planta solicitadas.
- [x] Aplicar el filtro a históricos, auditoría, reportes, configuración, cierres, exportaciones y TV, además del tablero.
- [x] Incorporar pertenencia por planta en destinatarios y lectura de notificaciones. Un aviso debe conservar la planta y llevar a ella al abrirse.
- [x] Resolver configuración por planta y eliminar dependencia funcional de valores fijos de Látex.
- [x] Implementar inicio/fin de trasvase transaccional con control de concurrencia. Sólo Slurry admite trasvase y no admite OEs.
- [x] Mantener `FUERA_DE_SERVICIO` y sus restricciones en todas las plantas.
- [x] Adaptar campos de cantidad requeridos para equipos sin peso: dato ausente queda nulo, dato declarado conserva su origen.
- [x] Conservar acceso y comportamiento legado de Látex durante la transición de clientes.

Salida: API probada con intentos de acceso cruzado y operaciones simultáneas.

### Etapa D — Contrato Node-RED y mapa de pesos

Preferir una evolución mínima del contrato vigente: conservar `scaleKey`, `grossKg`, `netKg` opcional y `measuredAt`. Identificar planta mediante ruta y credencial, evitando renombrar campos innecesariamente.

Contrato implementado:

```text
POST /api/plants/{plantCode}/telemetry/weights
X-Node-Red-Key: <credencial asociada a planta e integración>
Content-Type: application/json
```

```json
{
  "source": "NODE_RED_LATEX",
  "readings": [
    {
      "scaleKey": "TK101",
      "grossKg": 18542.7,
      "measuredAt": "2026-09-08T14:32:10.000Z"
    }
  ]
}
```

Variables propuestas para cada Node-RED:

| Variable | Uso |
|---|---|
| `DISAL_API_BASE_URL` | Dirección alcanzable del backend/proxy, con `/api` |
| `DISAL_PLANT_CODE` | `LATEX`, `TERPLAST` o `SLURRY` |
| `DISAL_INTEGRATION_KEY` | Credencial limitada a la planta/fuente |
| `DISAL_SOURCE_ID` | Identificador estable del emisor |
| `DISAL_REQUEST_TIMEOUT_MS` | Tiempo máximo de solicitud |

`disal-nginx` sólo es un hostname válido dentro de la red Docker correspondiente. Para un Node-RED externo documentar la dirección real del servidor, sin inventar IP ni protocolo físico.

- [x] Crear configuración de fuentes/credenciales por planta; no guardar claves reales en Git ni exponerlas al navegador.
- [x] Mantener el endpoint legado `/api/plant/telemetry/weights` y `NODE_RED_API_KEY` temporalmente asociados exclusivamente a Látex. No permitir que un fallback envíe datos a otras plantas.
- [x] Validar equipo conocido, planta, credencial, modo de telemetría, números finitos y timestamp. Rechazar o ignorar explícitamente datos fuera de orden para que una lectura antigua no sustituya una nueva.
- [x] Distinguir calidad desconocida, sensor sin comunicación y sensor no instalado. Si se incorporan calidad o secuencia, definirlas en el contrato y probar compatibilidad con clientes que no las envían.
- [x] Acordar semántica de errores de lote: aceptación total o parcial documentada, con detalle por lectura y sin afirmar éxito para equipos inexistentes.
- [x] Usar una clave interna que incluya planta y equipo; probar nombres de balanza repetidos entre plantas.
- [x] Crear mapa completo: planta, equipo, clave API, variable/tag Node-RED de origen, unidad, transformación, disponibilidad, emisor y ruta destino.
- [x] Conservar las nueve claves TK101–TK109. Para los cuatro equipos de Terplast y dos de Slurry dejar tags físicos pendientes hasta confirmación; para los dos de Enduido indicar «No aplica».
- [x] Entregar ejemplos importables de flujos Node-RED y pruebas de envío por planta, con placeholders de credenciales. Los simuladores deben estar deshabilitados por defecto en producción.
- [x] Actualizar `docs/NODE_RED_PESOS.md`, `.env.example`, Compose cuando corresponda y el instructivo de integración con rutas, campos, respuestas y procedimiento de cambio.
- [x] Probar cambio de endpoint de Látex sin cruce de pesos y registrar cuándo puede retirarse el contrato legado.

El alcance es estado instantáneo y fotografías de peso en transiciones. No introducir un historiador completo. Una lectura obsoleta no debe guardarse como medición actual confiable en un evento.

### Etapa E — Selector e interfaz

- [x] Convertir el título superior izquierdo en selector de las plantas autorizadas, manteniendo visible la planta activa.
- [x] Mantener la planta en la URL y recordar la última selección válida. Definir fallback autorizado al abrir enlaces antiguos.
- [x] Incluir planta en claves de caché, polling, reportes y notificaciones. Al cambiar, cancelar o aislar solicitudes anteriores y limpiar formularios pendientes para evitar operaciones sobre otra planta.
- [x] Ajustar grillas dinámicamente a 9, 4, 2 y 2 equipos sin espacios o contadores fijos de Látex.
- [x] Mostrar «Dispersora» y botones «Iniciar trasvase» / «Finalizar trasvase» en Slurry. Mostrar duración de Trasvase; no pedir OE, formato o cantidades.
- [x] Mostrar «Fuera de servicio», motivo y duración en todas las plantas y habilitar sólo las acciones permitidas.
- [x] Ocultar peso, medidor y diagnóstico de balanza en Enduido. No mostrar `0 kg` para valores ausentes.
- [x] Ajustar TV, exportaciones, historial, leyendas, semáforos y objetivos para Trasvase y equipos sin telemetría.
- [x] Calcular estado de balanzas sólo sobre sensores habilitados; si no hay sensores, indicar «Sin medición de peso» en lugar de una falla.
- [x] Identificar planta y equipo en confirmaciones y notificaciones para reducir errores de contexto.
- [x] Exigir planta explícita en la URL de TV, ofrecer una pantalla inicial de configuración y conservar el parámetro al redirigir desde `/monitoreo`.

Salida: recorrido completo por las cuatro plantas en las vistas operativa, TV e historial.

### Etapa F — Actualizaciones de producción que preserven datos

- [x] Separar imagen de aplicación de almacenamiento PostgreSQL, adjuntos y datos/credenciales Node-RED.
- [x] Documentar el volumen real existente. Si se adopta un nombre fijo o volumen externo, apuntar al volumen actual o realizar una migración verificada; cambiar el nombre sin transferir datos aparentaría una base vacía.
- [ ] Preparar backups automáticos de PostgreSQL y configuración runtime relevante, guardados fuera del contenedor y con copia fuera del host.
- [x] Probar restauración en una base aislada. Un archivo no vacío por sí solo no verifica un backup.
- [ ] Fijar versión/tag de imágenes para poder identificar y recuperar la versión anterior.
- [x] Ejecutar migraciones como paso controlado único, no desde cada réplica de backend ni junto con seeds al arrancar.
- [ ] Definir ventana de mantenimiento o compatibilidad entre versión anterior y nueva durante el cambio; probar especialmente el nuevo estado `TRASVASANDO` frente a clientes antiguos.
- [x] Documentar recuperación: revertir imagen sólo si es compatible con el esquema. Restaurar un backup productivo requiere un procedimiento explícito que contemple escrituras posteriores al respaldo.
- [x] Prohibir en el procedimiento normal `down -v`, eliminación de volúmenes, `migrate reset`, `db push --accept-data-loss` y scripts demo.
- [x] Separar actualización de flujos Node-RED de datos runtime y credenciales; no sobreescribir el bind mount de producción mediante un checkout del repositorio.
- [x] Diferenciar conservación de datos de continuidad: un reinicio puede causar indisponibilidad breve y perder el último peso en memoria; estados, lotes e históricos deben persistir. El peso se recupera al recibir una lectura nueva válida.

Salida: manual probado para instalar, actualizar, verificar y recuperar, con riesgos y tiempos observados documentados.

### Etapa G — Pruebas y documentación final

- [x] Compilar backend y frontend y ejecutar las pruebas existentes.
- [ ] Agregar pruebas de aislamiento por planta, membresía y acceso directo a IDs de otra planta.
- [ ] Probar ambos ciclos finales: envasado y trasvase, con ajustes repetidos y rechazo.
- [ ] Probar fuera de servicio en las cuatro plantas, incluida imposibilidad de fabricar mientras está inhabilitado.
- [ ] Probar carreras: dos inicios de trasvase y dos finalizaciones no duplican registros ni cierres.
- [ ] Probar Enduido sin sensores y sin requisitos de peso derivados de Látex.
- [ ] Probar cambio rápido de planta con formulario abierto, polling y notificaciones pendientes.
- [ ] Probar telemetría nueva y legada, credencial equivocada, equipo desconocido, timestamp inválido y lectura antigua.
- [ ] Probar migración de una copia del esquema anterior y comparar valores, relaciones, IDs, lotes activos e históricos antes/después, no sólo cantidades.
- [ ] Cargar datos de prueba en las cuatro plantas, mantener una operación activa en cada una, recrear contenedores conservando volúmenes y comprobar la persistencia. Repetir una actualización ya aplicada y comprobar que no resiembra ni altera configuración.
- [x] Actualizar requisitos, modelo de datos, operación, contexto multiplanta, Node-RED, despliegue e índice de documentación. Mantener el contexto específico de Látex como documento propio.
- [x] Crear nota de versión acorde con la versión finalmente elegida, sin afirmar verificaciones que no se hayan ejecutado.

## 6. Archivos y áreas a revisar

- `apps/backend/prisma/schema.prisma`, `migrations/`, `seed.ts` y scripts de preparación.
- `apps/backend/package.json` y `Dockerfile`: ejecución real de migraciones en el artefacto final.
- `apps/backend/src/modules/plant/`: reglas, consultas, DTO, reportes y exportaciones.
- `apps/backend/src/modules/notifications/`: destinatarios, lectura y navegación por planta.
- `apps/backend/src/modules/auth/`, `users/`, `companies/`: contexto, acceso y configuración.
- `apps/frontend/src/shared/layouts/AppLayout.tsx` y router: selector, URL y contexto.
- `apps/frontend/src/features/plant/`: tablero, TV, historial y Jefatura.
- `apps/frontend/src/shared/components/NotificationBell.tsx`: avisos por planta.
- `docker-compose.yml`, configuración HTTPS, `.env.example` e integración Node-RED.
- `docs/`: contratos, requisitos, migración, operación y notas de versión.

## 7. Criterios de aceptación de la entrega

1. Una sola aplicación permite seleccionar las cuatro plantas autorizadas.
2. Cada planta muestra su cantidad y tipo correctos de equipos y su propia configuración.
3. Slurry tiene trasvase temporizado y regresa a Vacío al finalizar; no crea órdenes de envasado.
4. Fuera de servicio funciona y queda trazado en todos los equipos de las cuatro plantas.
5. Enduido permite operación manual sin simular pesos ni generar fallas de sensores inexistentes.
6. API, caché, notificaciones, históricos y reportes no mezclan datos entre plantas.
7. El contrato Node-RED y el mapa de variables están documentados; los mapeos no confirmados están identificados y no habilitados como reales.
8. El Node-RED actual de Látex conserva compatibilidad durante el cambio.
9. Todos los datos previos se conservan asociados a Látex con sus IDs y relaciones originales.
10. Instalar desde cero y actualizar una base existente son recorridos distintos, reproducibles y probados.
11. Recrear contenedores conserva datos de las cuatro plantas; repetir despliegues no ejecuta limpiezas ni restablece configuración.
12. Existe evidencia de restauración y un procedimiento de recuperación compatible con el esquema desplegado.

## 8. Fuera de esta entrega

- Controlar PLC, válvulas, motores o máquinas desde la aplicación.
- Integrar todos los tags de SCADA o implementar un historiador nuevo.
- Agregar Sintéticos como quinta planta.
- Seguir inventario del tanque exterior de Slurry o transferencias entre lotes/plantas.
- Diseñar un nuevo módulo de ensayos de Laboratorio, OEE o IA.
- Reemplazar los flujos existentes por una máquina de estados genérica configurable sin necesidad concreta.

## 9. Registro de ejecución

- Etapas terminadas: implementación de B (migraciones/persistencia), C (backend/aislamiento), D (contrato/flujo Node-RED) y E (selector/interfaz). A, F y G conservan checks abiertos por fixtures operativos, infraestructura productiva o pruebas E2E pendientes.
- Decisiones pendientes y supuestos confirmados: se mantiene Laboratorio para Slurry; trasvase requiere `UserPlantAccess.canTransfer`; nombres `Equipo 1..n` y `Dispersora 1..2` son fixtures, no tags físicos. Terplast no admite envasado real hasta configurar líneas/formatos.
- Migraciones y baseline aplicados en pruebas: se confirmó que la cadena histórica falla desde cero en `20260727000000_add_stage_comments`; se agregó `prisma:install-empty`, que rechaza una base no vacía, materializa/valida el esquema y recién entonces reconcilia las 11 migraciones. En PostgreSQL 16 aislado se verificaron instalación vacía, actualización de una restauración del esquema anterior y una segunda ejecución de `migrate deploy` sin pendientes. Para la base local anterior se verificó por `prisma migrate diff` que el baseline histórico coincidía exactamente antes de marcarlo aplicado.
- Evidencia de conservación de registros: antes del despliegue se detuvieron los escritores y se creó/restauró el backup `D:\Proyectos\LatexNuevo\planta-latex-local-backups\20260908-173520\pre-multiplant-20260908-173520.dump`; `pg_restore --list` y la restauración completa en PostgreSQL 16 finalizaron correctamente. Después de migrar, los conteos y checksum de IDs históricos permanecieron iguales: `ProductionLot=12` (`4929b08514cc112669137e7d14d13f07`), `PackagingOrder=4` (`2e26e295d1e2c567689f90bf80f99cef`), `PlantAuditLog=25` (`09a021dbfb6f78d377d29f6bdad1bfd3`), `Tank` de Látex `=9` (`787092c87e7a976df38f9a6498e303eb`) y `TankStateHistory` de Látex `=43` (`0de443766fdb8715df6f57360e27c313`). No quedaron `plantId` nulos en las tablas migradas.
- Pruebas ejecutadas y resultados: backend y frontend compilaron en Docker; Prisma generó cliente y validó esquema; 7 suites/27 tests backend pasaron. Fixture limpio produjo `LATEX=9`, `TERPLAST=4`, `SLURRY=2`, `ENDUIDO=2`; segundo seed no agregó equipos; segundo deploy no aplicó cambios. El ensayo sobre la restauración detectó una omisión de `Tank.updatedAt` antes de tocar la base local; corregida, la migración y su repetición pasaron. No se ejecutaron aún E2E de concurrencia, acceso cruzado autenticado ni telemetría con Node-RED real.
- Mapeos Node-RED confirmados y pendientes: TK101–TK109 y contrato legado conservados. Los tags físicos/unidades/transformaciones de Terplast y Slurry siguen pendientes; el Docker local usa los fixtures `TERP01`–`TERP04` y `SLURRY01`–`SLURRY02`, claramente identificados como simulación. Enduido continúa `NOT_INSTALLED`. Se mantiene el ejemplo deshabilitado en `infra/node-red/examples/multiplant-weights.json`. El flujo local previo quedó preservado como pestaña deshabilitada y se agregó `Pesos multiplanta DISAL` sin sobrescribir sus nodos.
- Evidencia Node-RED local: se crearon integraciones activas y separadas por `source` para Látex, Terplast y Slurry usando el secreto runtime sin registrarlo en Git. Node-RED 4.0.9 cargó el archivo sin errores y las vistas TV mostraron telemetría reciente `online=true` para los 9+4+2 equipos habilitados. Enduido mantuvo sus dos equipos sin sensor y no recibió solicitudes de peso. El endpoint legado sigue disponible y podrá retirarse sólo después de confirmar un ciclo operativo completo de Látex sobre la ruta nueva.
- Procedimiento de despliegue y recuperación entregado: `docs/DESPLIEGUE_MULTIPLANTA.md`, servicio Compose `disal-migrate` y CLI Prisma disponible en runtime. Se respaldaron PostgreSQL, uploads, Node-RED y `.env`; se restauró y migró la copia en aislamiento. Aún no se automatizaron backups fuera del host ni se fijaron tags definitivos de imágenes.
- Despliegue local verificado el 8 de septiembre de 2026: se ejecutó el baseline controlado, la migración multiplanta y `docker compose up -d --build --force-recreate` sin borrar volúmenes. `disal-db`, `disal-backend` y `disal-node-red` quedaron saludables; frontend y proxy quedaron activos en `http://localhost:8081`. `/api/auth/status` y las cuatro rutas TV devolvieron HTTP 200. La base contiene `LATEX=9`, `TERPLAST=4`, `SLURRY=2` y `ENDUIDO=2`; el administrador protegido conserva su contraseña/sesión y recibió acceso a las cuatro plantas, con trasvase sólo en Slurry.
- Limitaciones antes de producción: confirmar equipos, líneas, formatos, sensores, responsables y accesos; provisionar credenciales hasheadas; ejecutar E2E/carreras/cambio rápido y telemetría real; fijar imágenes, backups fuera del host y ventana de mantenimiento. No se desplegó ni se tocó una base productiva.

## 10. Mensaje sugerido para iniciar la nueva sesión

> Leé `docs/PLAN_IMPLEMENTACION_MULTIPLANTA.md` y seguí sus etapas para implementar la evolución multiplanta del proyecto. Incluí Látex, Terplast, Slurry con Trasvase y Enduido sin peso. Conservá Fuera de servicio en las cuatro plantas. Prepará el contrato y ejemplos Node-RED, y probá que migrar y actualizar contenedores preserve los datos. Registrá resultados y pendientes en el plan. Usá bases aisladas para pruebas y preservá los cambios locales existentes.
