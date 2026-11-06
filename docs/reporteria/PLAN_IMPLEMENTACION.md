# Fase 0 · Plan técnico y backlog priorizado

**Estado:** planificación inicial del 05/11/2026, actualizada el 06/11/2026 con la implementación local y la importación histórica controlada. Las fases 1–5 tienen una primera implementación: Historial, métricas y Pareto de Laboratorio, PDF/Excel, Producción con límites de datos explícitos, filtros multiplanta y rangos personalizados. Este documento conserva el backlog original y sus criterios de cierre; las plantillas restantes, la fuente validada de kg fabricados y la actualización productiva siguen pendientes. Complejidad relativa: B (baja), M (media), A (alta), no equivale a fechas ni horas comprometidas.

## 1. Secuencia, dependencias y puertas de calidad

| Fase | Objetivo y dependencia | Trabajo principal | Complejidad / riesgo | Criterio de cierre |
| --- | --- | --- | --- | --- |
| 0 | Línea base | Auditoría, fuentes, KPI, arquitectura, UX, trazabilidad y riesgos | M / interpretación de datos sin perfilado | Cinco archivos coherentes, rutas verificadas, hipótesis marcadas, `git diff --check`. |
| 1 | Corregir Historial antes de usarlo como drill-down | Diagnóstico de PRODUCTO en casos reales; corrección de captura/transformación/PDF si se demuestra; eliminar columna sólo de resumen; ordenar resumen contraído sobre conjunto filtrado completo; regresiones | A / datos históricos, paginación, permisos | Producto correcto en datos comprobados; totales y orden de conjunto completo; PDFs/diálogo conservados; sin reparaciones masivas. |
| 2 | Base de reportería, depende de 0 y 1 | `ReportingModule`, DTO, autorización, capacidades, consultas agregadas, dataset versionado, ruta/menú/frontend base | A / aislamiento de empresa/planta y carga SQL | API y pantalla sólo lectura, denegaciones probadas, métricas base reconciliadas, límites de consulta. |
| 3 | Laboratorio, depende de 2 | KPI de muestras/decisiones, cohortes, Pareto, tiempos, comparaciones, drill-down | A / denominadores y cobertura histórica | Casos A–G; conciliación con IDs; motivos/solicitudes separados; cobertura visible. |
| 4 | Informes, depende de 3 | Plantillas 1–3 primero, dataset común, PDF/Excel/CSV, vista previa, metodología, auditoría de generación si se aprueba | A / equivalencia, memoria, licencias | Caso H, PDF multipágina visualmente validado, Excel tipado, sin truncar ni filtrar planta ajena. |
| 5 | Producción, depende de fuentes reales y 2–4 | OF/tiempos/plan, kg reales sólo si se instrumenta fuente validada; comparaciones y tendencias | A / medición industrial errónea | Indicadores con trazabilidad a fuente; `PRO-006`–`PRO-008` deshabilitados si faltan datos. |

La revisión PDCA de cada fase compara resultados con criterio, registra desvíos y decide ajustes antes de la siguiente. No crear release ni desplegar por completar una fase.

## 2. Backlog ejecutable por fase

### Fase 1 autorizada

| Prioridad | Tarea y archivos previstos | Prueba / evidencia | Riesgo y condición |
| --- | --- | --- | --- |
| P0 | Reproducir PRODUCTO incorrecto con `lotId` afectado y auditoría `PlantAuditLog`; inspeccionar `PlantBoardPage.tsx`, `plant.service.ts`, DTO y PDFs | Comparación de captura, lote, auditoría y salida; fixtures seguros si faltan datos reales | Sin filas autorizadas, corregir únicamente defecto reproducible en código y dejar reparación histórica pendiente. |
| P0 | Separar semántica del resumen: resumen de OF sobre **todos** los registros filtrados en backend, total y orden estable | >1.000 eventos, OF repetida en dos plantas, filtros, páginas y exportación | Mantener control de rol/planta y no descargar lista ilimitada. |
| P0 | Quitar «Estados en el período» de la tabla resumida PDF | Inspección de encabezados y conteo de columnas; detalle cronológico intacto | No borrar eventos históricos. |
| P1 | Agregar orden asc/desc a columnas del resumen contraído: OF natural, semielaborado/descripción localizados, ajustes/OE numéricos | Valores que invierten orden; empates por `lotId`; segunda página | El frontend puede ordenar sólo si posee conjunto completo; preferir backend para paginación. |
| P1 | Ajustar mensaje de total/alcance y conservar PDF individual, filtros, permisos y UX | Pruebas enfocadas, compilación frontend/backend, flujos de Historial y denegación | No alterar operación de Fabricación/Laboratorio. |

### Fase 2 propuesta

P0: definir DTO y catálogo de capacidades por planta; resolver `companyId` + `UserPlantAccess` antes de toda consulta; establecer `[inicio, fin)` y corte; crear dataset con `metricVersion` y cobertura; consultas agregadas y páginas con límites. P1: ruta `/reporteria`, navegación y estados de carga/error/vacío; observabilidad de latencia. Validar por pruebas de integración con dos empresas y tres plantas, manipulación de parámetros y volumen representativo. No añadir índice hasta perfilado.

### Fase 3 propuesta

P0: implementar `LAB-001`–`LAB-011`, Pareto de menciones y drill-down; fijar cohorte de primera decisión; conciliar con datos de origen. P1: tasas y tendencias `LAB-012`–`LAB-017`, comparaciones sólo entre plantas aptas. Validar fechas cruzadas, múltiples motivos/materiales, corrección auditada y muestras abiertas.

### Fase 4 propuesta

P0: prototipo de composición PDF con datos sintéticos cortos y extensos, selección de biblioteca y licencia; plantillas 1–3 desde dataset compartido; libro Excel tipado y mitigación de fórmulas; verificación visual. P1: plantillas 4–6 según capacidad, vista previa y auditoría de generación. Registrar tamaño/memoria/tiempo antes de decidir procesos asíncronos.

### Fase 5 propuesta

P0: publicar OF, plan y tiempos con definición validada; separar Envasado. P1 condicionado: obtener y conciliar cantidad real fabricada desde fuente de proceso autorizada; sólo entonces plan-real/merma. OEE requiere proyecto de instrumentación específico, no se habilita por analogía con pesos u OE.

## 3. Matriz de trazabilidad de requisitos

**Servicios y endpoints siguientes son propuestos; no existen en Fase 0.** `RH` = Historial actual, `RQ` = futuro servicio de consultas, `RM` = futuro servicio de métricas, `RE` = futuro exportador. `P` = fase. Las pruebas A–J provienen de `PLAN_MAESTRO.md`.

| Requisito | Fuente / regla de cálculo | Servicio y endpoint propuestos | Pantalla / informe | Prueba / fase |
| --- | --- | --- | --- | --- |
| PRODUCTO y resumen correcto | `ProductionLot.description`, `PlantAuditLog`; lote por ID, resumen completo | RH: `GET /api/plants/:code/history/states` a evolucionar o consulta de resumen dedicada | Historial, PDF resumido | Datos afectados + D/J; P1 |
| Ordenamiento y paginación | OF natural, texto localizado, enteros; orden global + ID | RH: resumen dedicado paginado | Historial contraído | >1.000, asc/desc, páginas; P1 |
| OF iniciadas/finalizadas | `ProductionLot.id`, `startedAt`/`finishedAt` `[inicio,fin)` | RQ/RM: `GET /api/reporting/overview` y `/orders` | Resumen, Producción, mensual | D/J; P2/P5 |
| Solicitudes de ajuste | `QualityDecision.id`, `AJUSTE`, `createdAt`, no cancelada | RQ/RM: `/laboratory/adjustments` | Laboratorio, informe 1/3 | A/B/E; P3 |
| OF con ajustes y tasas | `COUNT(DISTINCT lotId)` sobre cohorte aprobada | RM: `/laboratory` | Laboratorio, informe 1 | A/D; P3 |
| Pareto | `adjustmentReasons[]`; solicitudes distintas de menciones | RM: `/laboratory/adjustments` | Gráfico/tabla, informe 1/3 | B/E/H; P3/P4 |
| Aprobación inicial | primera muestra/decisión resuelta por `lotId`, cohorte mensual | RM: `/laboratory` | Laboratorio, resumen, informe 1 | A/F; P3 |
| Esperas y análisis | `LaboratorySample` timestamps; sólo intervalos completos | RM: `/laboratory` | Laboratorio, informe 1 | A/F; P3 |
| Permanencia mensual | intersección de `TankStateHistory` con mes | RQ/RM: `/laboratory` | Laboratorio, informe 1 | C; P3 |
| Kg planificados/reales | `plannedQuantityKg`; real sin fuente verificada | RM: `/production` sólo plan; real bloqueado | Producción, informe 5 | I/J y fuente; P5 |
| Kg envasados | `PackagingOrder.producedKg`, OE terminadas con dato | RM: `/production` subsección Envasado | Producción/Envasado | Conciliación con OE; P5 |
| Multiplanta/capacidades | `Plant`, `UserPlantAccess`, configuración y cobertura | RQ: `/capabilities`; todas las consultas | Todas, informes 2/6 | D/G; P2–P5 |
| Trazabilidad OF | `lotId`, planta, empresa | RH timeline actual o detalle autorizado | Drill-down a Historial | D/G/J; P1/P3 |
| PDF/Excel/CSV equivalentes | Dataset versionado, filtros y corte idénticos | RE: `POST /api/reporting/exports` | Centro de informes | H/I; P4 |

## 4. Escenarios deterministas y aceptación

- **A:** una OF, dos muestras, un ajuste, aprobación final → 1 OF, 1 solicitud, 2 iteraciones, primera aprobación = no.
- **B:** una decisión de ajuste con tres motivos y varios materiales → 1 solicitud, 3 menciones; Pareto por menciones suma 100 %.
- **C:** estado LABORATORIO 31/10 23:00–01/11 01:00 ART → 1 h en octubre y 1 h en noviembre.
- **D:** mismo texto de OF en dos plantas → `lotId` distintos y resultados separados incluso al ordenar/exportar.
- **E:** motivo corregido → valor vigente mostrado, cambio original accesible por auditoría; PDF regenerado declara corte.
- **F:** muestra recibida sin resolución → espera de recepción puede calcularse; análisis final/resultado son nulos.
- **G:** usuario de planta A pide A+B o B directamente → denegación backend sin datos de B en cuerpo, CSV ni PDF.
- **H:** mismo dataset, filtros, corte y versión → totales idénticos en pantalla/PDF/Excel.
- **I:** volumen alto → registrar tiempo, tamaño y memoria; fijar límites según línea base, sin meta inventada.
- **J:** regresión de Fabricación, Laboratorio, Envasado, Historial, Jefatura, PDFs, integraciones y permisos.

Fase 1 requiere, además, casos de página 2, empates, OF sin lote en estado, filtro de fecha y estado, producto con corrección auditada y PDF largo. Pruebas que requieran datos usan fixtures o entorno seguro; no conectarse a planta activa para generar estados.

## 5. Riesgos y decisiones para la revisión de cada fase

1. **Datos históricos:** cobertura de muestras y motivos por planta/mes no observada. Antes de Fase 3, perfilado de sólo lectura y muestra de casos reales autorizada. Si falla, limitar período y marcar KPI como no disponible.
2. **Producto:** no existe campo canónico separado de `description`; el valor incorrecto reportado requiere `lotId` y auditoría. No reparar históricos por regla heurística.
3. **Autorización:** Laboratorio no tiene hoy Historial; matriz de lectura/exportación debe aprobarse en Fase 2 antes de habilitar enlace.
4. **Rendimiento:** Historial actual pagina 1.000 eventos y su PDF descarga todos al cliente; Fase 1 debe evitar repetir ese patrón para orden global.
5. **Consistencia:** exportar en distintos instantes puede cambiar totales por corrección; `dataCutoff` solo no fija snapshot. Fase 4 debe demostrar equivalencia real.
6. **Fuente física:** el peso es señal/contexto, no kg fabricados oficiales. Fase 5 se limita a fuentes verificadas.

## 6. Registro de decisión y próximo paso

Las decisiones ADR-01 a ADR-07 están en `03-ARQUITECTURA.md`; las reglas de KPI en `02-INDICADORES.md`, y límites del código en `01-AUDITORIA.md`. Primera implementación recomendada: **Fase 1**, con corrección acotada de Historial y pruebas de regresión. Al cerrar Fase 1, presentar evidencias y solicitar instrucciones para Fase 2. Publicación a `origin` (personal) y `laboral` (trabajo), con el mismo commit/tag cuando se solicite publicar; esta autorización de implementación no incluye push, release ni despliegue.

### Estado de Fase 1 al 05/11/2026

- **Implementado localmente:** resumen dedicado en backend con alcance empresa/planta, filtros, orden global por OF/texto/cantidad y paginación; solicitudes de ajuste contadas por decisiones no anuladas; tabla contraída con orden ascendente/descendente; PDF resumido sin «Estados en el período» y alimentado por el mismo resumen para sus totales; horas de Historial y sus PDFs en formato de 24 horas.
- **Verificado:** 53 pruebas enfocadas de backend (2 suites), lint de archivos afectados en backend/frontend, compilaciones NestJS/TypeScript/Vite y `git diff --check`. No hubo prueba de integración contra base ni navegador, ni despliegue.
- **Pendiente que impide declarar cerrada la fase:** el PDF aportado por el usuario muestra PRODUCTO correcto en las 8 OF; no reproduce el defecto referido. Identificar otro lote/PDF afectado o confirmar si la columna problemática era el detalle «Descripción». Si existe un caso, contrastar `ProductionLot.description` con `PlantAuditLog` y el producto esperado antes de reparar datos. El nuevo SQL del resumen también requiere prueba de integración en entorno seguro antes de ponerlo en uso.
- **Riesgo residual:** el backend reúne las filas agregadas de lotes para aplicar comparación localizada antes de paginar; se debe medir memoria/latencia con volumen real. El detalle cronológico del PDF conserva la descarga por páginas de eventos; Fase 4 deberá unificar el corte de datos de exportación.

### Avance de Fase 2 con datos locales al 05/11/2026

- **Implementado localmente:** módulo NestJS de sólo lectura en apps/backend/src/modules/reporting/ con GET /api/reporting/capabilities, /overview y /orders; ruta React /reporteria, menú, filtro por mes y plantas, tabla de OF y enlace a Historial. No se crearon tablas, índices, migraciones, dependencias ni exportadores.
- **Definiciones publicadas:** OF iniciadas por startedAt, terminadas por finishedAt, decisiones y ajustes por createdAt, muestras recibidas por receivedAt; intervalo mensual [inicio, fin) en hora argentina. Los conteos tienen poblaciones distintas. El endpoint de capacidades informa cantidad observada de registros, sin afirmar que la planta tenga o no un proceso.
- **Evidencia local:** para octubre de 2026, el usuario administrador recibió 3 OF iniciadas, 1 finalizada, 3 decisiones, 2 ajustes y 3 muestras recibidas; la lista de OF tiene 3 filas. Un usuario existente con acceso a seis plantas recibió sólo esas seis y una petición explícita por ENVASES (no asignada) devolvió 404. Sin token devolvió 401; mes inválido y límite excesivo devolvieron 400. Tres pruebas enfocadas de servicio pasaron.
- **Pendiente para cerrar Fase 2:** validar la experiencia visual y filtros en navegador, perfilar consultas con volumen representativo, completar contratos de filtros y cobertura por indicador, ejecutar regresión de navegación y documentar la matriz funcional de roles antes de abrir acceso de Laboratorio. Los datos locales son limitados y en parte demostrativos; el caso PRODUCTO del servidor no está reproducido.

### Conciliación de Fase 2 tras la importación del 06/11/2026

- **Importación y aislamiento:** 1.730 registros operativos/auditables más 27 identidades históricas deshabilitadas, en una transacción local. Se excluyeron nueve estados y una OE abiertos. El respaldo y NDJSON están fuera de Git; las verificaciones posteriores encontraron los conteos exactos por ID y los nueve tanques sin cambios.
- **API frente al origen:** para LATEX en noviembre de 2026, la exportación y `GET /api/reporting/overview?month=2026-11` con esa planta coinciden exactamente: 9 OF iniciadas, 12 finalizadas, 28 decisiones, 15 ajustes y 27 muestras recibidas. Una OF importada abrió su timeline con estados, decisión y muestra. `GET /api/plants/LATEX/history/summary` devolvió 70 lotes con actividad desde octubre, incluyendo los preexistentes locales.
- **Seguridad y rendimiento local:** la prueba previa de usuario con seis plantas impidió ENVASES con 404 y omitió esa planta del catálogo. Con el volumen actual, tres lecturas consecutivas desde Node hacia la API local tardaron 12–80 ms según endpoint y calentamiento; es una línea base pequeña, no una meta de producción ni una prueba de escalabilidad. El resumen de Historial aún ordena el conjunto completo en memoria backend.
- **Pendiente:** la base local mezcla datos demo y registros importados; la validación visual autenticada, pruebas de volumen y la política de acceso de LABORATORIO siguen abiertas. El defecto PRODUCTO original no se reproduce con el PDF aportado ni con una regla evidente en la exportación. Fase 3 requiere una instrucción posterior; el pedido de avanzar una etapa después de importar se aplica a completar Fase 2.

### Avance de Fase 3 al 06/11/2026

- **Implementado localmente:** `GET /api/reporting/laboratory`, `/laboratory/adjustments` y `/laboratory/lots/:lotId`; tablero mensual de Laboratorio, recuentos de muestras y ajustes, primera aprobación, tiempos transcurridos, tendencia, comparación por planta, Pareto y solicitudes paginadas. El detalle de OF muestra ciclos y decisiones para `LABORATORIO` sin abrirle HISTORIAL ni permisos operativos. Los demás roles autorizados conservan el enlace a HISTORIAL.
- **Cálculo:** solicitudes = decisiones `AJUSTE` no canceladas por `createdAt`; OF ajustadas = `COUNT(DISTINCT lotId)`; menciones = motivos individuales, incluyendo «Sin clasificar» para arrays vacíos. Pareto agrega en PostgreSQL, calcula porcentaje sobre menciones y pagina sólo el detalle. Aprobación inicial = primera muestra resuelta con decisión no cancelada de cada lote, agrupada por mes de `resolvedAt`. Tiempos excluyen intervalos incompletos o cronología invertida; permanencia en `LABORATORIO` se recorta al mes.
- **Conciliación inicial:** en noviembre de 2026, API local y NDJSON de origen coinciden en 15 solicitudes de ajuste, 7 OF ajustadas y 18 menciones. Un recuento independiente sobre el NDJSON confirma 13 OF en la cohorte de primera resolución y 5 aprobadas inicialmente (38,46 %). La API devuelve 27 muestras recibidas, 28 resueltas; el Pareto suma 18 menciones y 100 %. Se probaron 401 sin sesión, 400 para mes inválido y 404 para planta ajena/inexistente; la lectura de detalle exige empresa y planta autorizadas.
- **Limitaciones:** el archivo importado sólo contiene datos desde el 01/10/2026 y omite estados/OE abiertos; la base local también contiene datos de demostración. La tasa de primera aprobación expresa la cohorte observada, no una tasa histórica completa. Motivos corregidos se muestran con su valor vigente; `dataCutoff` no reconstruye una versión histórica inmutable. Las comparaciones entre plantas muestran conteos, sin tasa normalizada ni certificación de cobertura equivalente. Las duraciones son tiempo transcurrido, no trabajo efectivo.
- **Permisos y cobertura:** cuatro pruebas enfocadas verifican que `LABORATORIO` lee sus endpoints pero no el resumen general, y que el detalle consulta sólo empresa y plantas asignadas. No hay en la base local una cuenta `LABORATORIO` activa con planta asignada para probar el recorrido HTTP completo con ese rol. Las plantas sin muestras históricas se señalan como «Cobertura no verificada» en la comparación, no como cero medido.
- **Intervalos entre meses:** la base local contiene cuatro intervalos `LABORATORIO` de LATEX que cruzan el límite octubre/noviembre. Una suma independiente sobre los 145 intervalos de esa planta, recortada al mes y con la misma fecha de corte, coincidió con la API para noviembre: 1.804.112 segundos. No hubo intervalos invertidos en esa selección; la consulta evita que uno futuro reste duración.
- **Cierre pendiente de Fase 3:** validar visualmente con sesión de cada rol, probar escenarios A–G sobre fixtures deterministas (en particular mes cruzado y edición auditada), medir consultas con volumen representativo y perfilar cobertura de datos por planta/mes antes de declarar tasas oficiales. La Fase 4 quedó pendiente hasta la instrucción posterior del usuario.

### Avance de Fases 4 y 5 al 06/11/2026

- **Informe PDF:** botón «Descargar PDF Grupo DISAL» en `/reporteria`, sección Laboratorio. La plantilla mensual A4 horizontal utiliza el logo corporativo existente, identificación del período y plantas, usuario, versiones, KPIs, Pareto, comparación por planta, tendencia, detalle completo de solicitudes y metodología. Las filas se descargan por páginas de 100 y se concilian con el Pareto y los totales antes de generar. Ante cambios concurrentes detectados o más de 100.000 solicitudes, se informa el límite y no se descarga un documento incompleto. No se afirma reproducción histórica inmutable.
- **Libro Excel:** botón «Descargar Excel» y hojas Resumen, Indicadores, OF, Ajustes, Motivos, Ciclos de Laboratorio y Metodología. OF y ciclos corresponden a las OF con ajustes del período; esa cobertura aparece en el libro. Los números se guardan como números, las fechas como fechas de hora argentina y los campos de texto con riesgo de fórmula se neutralizan. Se agregó ExcelJS 4.4.0 (MIT) como dependencia del frontend; se carga sólo al exportar.
- **Validación de documentos:** PDF de muestra generado con datos locales, cinco páginas renderizadas e inspeccionadas; encabezados, logo, tablas y paginación legibles. El XLSX de muestra se reabrió: siete hojas, 15 ajustes, cuatro motivos y 22 ciclos. Una celda de prueba `=1+1` se guardó como texto protegido. Ambos artefactos de prueba están fuera de Git, en el respaldo local de reportería.
- **Producción:** `GET /api/reporting/production` y panel mensual con OF iniciadas/finalizadas, kg planificados con cobertura, duración promedio de intervalos `FABRICANDO` cerrados, comparación por planta/tanque, tendencia y sección de Envasado separada. `manufacturedKg` permanece `null`: no hay fuente validada de cantidad realmente fabricada. La exportación de origen y API local coinciden en noviembre: 9 OF iniciadas, 12 finalizadas, 256.619 kg planificados, 15 OE terminadas y 525 kg de merma de envasado con dato en 11 OE; 0/15 OE tienen kg envasados registrados, por lo que esa suma no se publica.
- **Pendientes de alcance mayor:** las otras plantillas PDF del plan maestro, vista previa, libro multiplanta consolidado de Producción, reconstrucción histórica `as of`, tasas oficiales entre plantas y kg fabricados reales requieren datasets/fuentes y validación adicionales. No se modificaron datos productivos, migraciones ni integraciones industriales.

### Ampliación del Pareto de Laboratorio al 06/11/2026

- Se agregó al mismo endpoint `/api/reporting/laboratory/adjustments` un Pareto por `ProductionLot.materialCode`: solicitudes de ajuste por material de la OF, OF distintas, porcentaje sobre solicitudes y acumulado. Un segundo agregado muestra menciones de cada motivo por material. Ambos respetan empresa, plantas, período, cancelación y filtro de material.
- La sección Laboratorio muestra gráfico, tabla completa y desglose material–motivo. El PDF mensual agrega dos páginas y el Excel incorpora las hojas `Materiales` y `Material y motivo`. La descarga concilia los agregados con todas las solicitudes paginadas.
- En la base local de noviembre: 15 solicitudes distribuidas entre cinco materiales; el código `300405` concentra 10 solicitudes (66,67 %) de tres OF, con 10 menciones de Color y dos de Viscosidad. Los insumos agregados en la solicitud siguen siendo una dimensión distinta.
