# Fase 0 · Auditoría de Historial y fuentes industriales

**Corte:** 05/11/2026. **Método:** lectura estática del árbol de trabajo actual, esquema Prisma, controladores, servicios, pantallas y documentación operativa. No se consultó PostgreSQL, InfluxDB ni una planta activa; por lo tanto, existencia de campos no demuestra cobertura, exactitud ni volumen histórico. El árbol contiene modificaciones previas ajenas en `schema.prisma`, `plant.service.ts`, `plant.controller.ts`, DTO y pantallas; los hallazgos se refieren al estado local inspeccionado y deben revalidarse al implementar.

## 1. Hechos verificados

| Área | Evidencia en código | Consecuencia |
| --- | --- | --- |
| Historial | `apps/frontend/src/features/plant/PlantHistoryPage.tsx` consulta `GET /plants/:plantCode/history/states`; `plant.service.ts:1908` limita a 1.000 filas y ordena por inicio descendente e ID. | La tabla y su resumen contraído sólo representan la primera página; el encabezado no advierte truncamiento. |
| Resumen por OF | `PlantHistoryPage.tsx:224-256` agrupa filas recibidas por `lot.id`, cuenta filas `AJUSTE`, y ordena por texto de OF. | El conteo depende de filtros de estado/fecha/búsqueda y de la página visible; no es el número canónico de solicitudes de ajuste. La clave `lot.id` sí evita fusionar numeraciones repetidas dentro de lo cargado. |
| PDF resumido | `history-summary-pdf.ts:62-75` pone `lot.description` en PRODUCTO, cuenta estados `AJUSTE` y muestra «Estados en el período». `PlantHistoryPage.tsx:274-308` descarga todas las páginas de 1.000 en el navegador. | Pantalla y PDF pueden dar totales distintos con más de 1.000 eventos. La generación implica transferencia completa al cliente y carece de corte de datos estable entre páginas. |
| PDF individual | `history-pdf.ts` usa jsPDF y `jspdf-autotable`; la línea de PRODUCTO también usa `timeline.description`. | Hay dos generadores de PDF de trazabilidad reutilizables, pero su presentación depende del dato vigente del lote. |
| Producto de la OF | `ProductionLot.description` se copia de `StartManufacturingDto.description` en `plant.service.ts:1090-1127`; `correctLot` permite actualizarla y audita antes/después (`plant.service.ts:1866-1905`). `PlantBoardPage.tsx:1232-1333` presenta un campo genérico «Descripción». | El código no posee un campo separado «nombre de producto». No se puede atribuir el valor de ajustes visto por el usuario al PDF sin inspeccionar las filas afectadas y su auditoría. |
| Decisiones y muestras | `schema.prisma` contiene `QualityDecision`, `QualityAdjustmentItem`, `LaboratorySample` con marcas de solicitud, recepción, inicio, resolución, cancelación e iteración. `plant.service.ts:1317-1507` crea una decisión por resolución y **edita** una decisión de ajuste existente al corregirla. | El hecho de una solicitud se cuenta por `QualityDecision.id`; motivos por elemento de `adjustmentReasons`, nunca por material ni transición. La corrección cambia el valor vigente; `PlantAuditLog` conserva antes/después. |
| Timeline | `plant.service.ts:1951-2078` devuelve lote, estados, decisiones, muestras, OE y pesos opcionales de InfluxDB; `manufacturingCharges: []` es literal. | No hay cargas de fabricación implementadas en esa respuesta. El histórico de peso es externo y opcional. |
| Jefatura | `plant.service.ts:2082-2462` calcula resumen diario con intersección de estados y exporta PDF y `.xls` XML Spreadsheet 2003. | Existe precedente de agregación en backend y exportación, pero el `.xls` no es `.xlsx`; no es aún un motor editorial de reportes. `DailyPlantClosure.snapshot` fija un cierre diario, mientras los informes vivos recalculan. |
| Seguridad | `plant.controller.ts` protege Historial con JWT, `RolesGuard`, roles MONITOREO/JEFATURA/ADMIN y `assertPlantAccess`; `AppRouter.tsx` replica roles de navegación. `UserPlantAccess` relaciona usuario y planta. | Laboratorio carece hoy de acceso a Historial. La nueva lectura exige autorización propia en backend y no heredar automáticamente permisos operativos. |
| Planta | `Plant.finalOperation`, `Plant.settings`, `Tank.equipmentType`, `telemetryMode` y `UserPlantAccess` existen; `seed.ts` define LATEX, TERPLAST, SLURRY, ENDUIDO, SINTETICOS y ENVASES. | El seed describe configuración prevista, no prueba datos reales ni capacidades efectivas de cada instalación. `finalOperation` sólo distingue PACKAGING/TRANSFER: no equivale a un catálogo analítico completo. |
| Fechas | `schema.prisma` usa `Timestamptz(3)` en las entidades industriales; `plant.service.ts:3349` calcula día local con offset fijo de 3 horas. | El período del nuevo módulo debe definir la zona `America/Argentina/Buenos_Aires` en un punto común y consultar `[inicio, fin)`. |

## 2. Defectos y límites concretos de HISTORIAL

1. **PRODUCTO incorrecto observado por el usuario:** se verificó que PDF y timeline usan el campo vigente `ProductionLot.description`. No hay una transformación en el PDF que copie motivos de ajuste a PRODUCTO. Causa exacta **no comprobada**: podría estar en captura, corrección o registros históricos. Antes de corregir: seleccionar OF/lotes afectados en una copia autorizada, comparar `ProductionLot.description`, captura inicial auditada `CREATE`, correcciones `CORRECTION` y decisiones; registrar `lotId`, planta y fechas; proponer reparación por caso con aprobación y auditoría. No sobreescribir masivamente.
2. **Resumen incompleto:** el primer `history/states` retorna máximo 1.000 filas. La agrupación y filtros de búsqueda se ejecutan sobre esa página. El PDF sí pagina para descargar todo, con posible desalineación y coste creciente. Diseñar consulta de lotes/agrupación en backend, total explícito y paginación estable antes del ordenamiento solicitado.
3. **Ajustes con semántica errónea:** contar estados `AJUSTE` puede omitir o duplicar decisiones según filtro, cancelaciones, retrocesos y correcciones. Usar `QualityDecision` no cancelada como fuente de solicitudes; documentar excepciones históricas. Un lote con varios materiales sigue contando una solicitud.
4. **Período de estados:** `history()` incluye períodos que solapan la ventana (`startedAt < fin` y `endedAt >= inicio`) y devuelve duración completa del estado. Una permanencia mensual requiere recorte a la intersección. El límite igual a inicio merece definición explícita: con `[inicio, fin)` el estado terminado exactamente en inicio no aporta segundos.
5. **Ordenamiento:** el resumen contraído tiene un único orden por OF; no existen controles ascendente/descendente ni comparadores de fechas/cantidades/duraciones. Ordenar sólo las filas cargadas sería incorrecto con paginación.
6. **Columnas:** «Estados en el período» sólo aparece en la primera tabla de `history-summary-pdf.ts`; su eliminación futura no debe quitar filas de estados del detalle cronológico ni del historial.

## 3. Inventario de fuentes y confiabilidad

| Fuente | Identidad y datos | Uso inmediato posible | Límite / verificación pendiente |
| --- | --- | --- | --- |
| `ProductionLot` | `id`, empresa, planta, tanque, OF, material, descripción, kg planificados, inicio/fin/cancelación | OF iniciadas/terminadas, plan y vínculo a trazabilidad. | OF textual no es única (`@@index`, no `@@unique`). No contiene kg reales fabricados. Producto libre requiere auditoría de calidad. |
| `LaboratorySample` | `id`, `lotId`, iteración, marcas temporales y decisión vinculada | Ciclos, recibidas/resueltas y esperas cuando existan timestamps válidos. | Cobertura histórica previa al flujo de muestra no verificada; intervalos abiertos y cancelaciones. |
| `QualityDecision` | `id`, `lotId`, resultado, `adjustmentReasons[]`, `createdAt`, `cancelledAt` | Solicitudes, decisiones, primera resolución, Pareto vigente. | Edición posterior altera motivos actuales; no tiene fecha de última edición propia. Reconstrucción histórica exige `PlantAuditLog` y validación. |
| `QualityAdjustmentItem` | decisión, código y kg de material | Detalle de materiales solicitados. | Son materiales de ajuste, no kg fabricados ni motivos; no usar como multiplicador de solicitudes. |
| `TankStateHistory` | períodos por tanque/lote, estado, inicio/fin, peso puntual | Ocupación, tiempos de etapa y drill-down. | Estados abiertos, cancelados/retrocedidos y recortes de mes; `weightKg` es fotografía, no producción final. |
| `PackagingOrder` | OE, kg y unidades producidas, merma, inicio/fin/cancelación | Métricas de **envasado** si los valores fueron cargados/validados. | Campos nullable; no equivalen a kg fabricados; revisar completitud, cancelaciones y proceso de captura. |
| `PlantAuditLog` | entidad, acción, antes/después, usuario, fecha | Evidencia de correcciones y trazabilidad de producto/motivos. | No se demostró reconstrucción automática completa a fecha de corte; no llamar inmutable a un PDF recalculado. |
| `DailyPlantClosure` | snapshot por planta/fecha | Comparación con cierre diario existente. | Semántica diaria y alcance distintos de un informe mensual; no sumar snapshots sin definir población. |
| InfluxDB / Node-RED | peso continuo externo y última señal en memoria | Contexto de trazabilidad, sólo con adaptador validado. | No hay cantidad final fabricada deducible; disponibilidad, calidad y cobertura no medidas. |
| Integración ENVASES | CMS Woojin e inbox; ver `docs/BASE_DATOS_CMS_WOOJIN.md` y `docs/MATRIZ_INTEGRACION_INDUSTRIAL.md` | Analítica específica futura de inyectoras. | No mezclar disparos o ciclos con OF de fabricación látex; fuente externa no auditada aquí. |

**Límite de esta auditoría:** sin lectura de datos no se conocen nulos, duplicados, volumen por planta, distribución de motivos, amplitud histórica, rendimiento de consultas ni porcentaje de registros anteriores a la incorporación de muestras. La fase de implementación necesita un perfilado **de solo lectura** sobre copia autorizada y planes `EXPLAIN` seguros antes de prometer KPI o índices.

## 4. Riesgos ordenados por impacto

| Riesgo | Impacto | Contención propuesta |
| --- | --- | --- |
| Filtración entre plantas/empresas en consolidado o exportación | Crítico | Resolver lista autorizada en backend; intersección con filtro solicitado; misma condición en agregado, detalle y descarga. |
| KPI de ajuste derivado de estados o materiales | Alto | Fuente `QualityDecision`, identidad por ID, motivos por mención, reconciliación con muestras. |
| Producto histórico incorrecto | Alto | Diagnóstico por lotes afectados y auditoría; corrección futura controlada. |
| Dashboard/PDF/Excel inconsistentes por páginas o cambios concurrentes | Alto | Dataset versionado, filtros normalizados, `asOf`/corte explícito y semántica de lectura coherente. |
| Carga de base por consulta ilimitada o PDF masivo en navegador | Alto | Límites, paginación, agregación SQL, medición y exportación por lotes; sin índices especulativos. |
| Comparación engañosa de plantas o kg | Alto | Catálogo de capacidades, «No aplica» y cobertura; no atribuir kg envasados a fabricación. |
| Correcciones posteriores alteran informes reproducidos | Medio/alto | Declarar «estado vigente al corte de consulta»; reconstrucción histórica sólo cuando sea verificable. |

## 5. Evidencia y pendientes para Fase 1

**Evidencia adicional aportada por el usuario durante Fase 1:** un extracto del Historial del servidor del 04–05/11/2026 muestra textos como «APROBADO», «Viscosidad», «Color» y «Fin de envasado» en la columna **Descripción** de eventos. Esto es coherente con `TankStateHistory.description` y con el fallback del detalle en `PlantHistoryPage.tsx`. El extracto no incluye el valor de `ProductionLot.description` ni la tabla PRODUCTO del PDF resumido, por lo que **no permite atribuir la causa del PRODUCTO incorrecto**. No se incorporan nombres personales ni filas completas al repositorio. Comparar un lote afectado, su auditoría y el PDF en servidor o copia autorizada sigue pendiente.

**PDF del servidor aportado después:** se inspeccionaron visualmente sus 2 páginas. El resumen contiene 8 OF y la columna PRODUCTO muestra descripciones de productos para las 8; no contiene motivos de ajuste en esa columna. Por lo tanto, **el defecto PRODUCTO no se reproduce en este PDF concreto**. El filtro del archivo comienza el 05/11/2026: los ajustes del 04/11 del extracto anterior quedan fuera del período y el PDF anterior marca cero, coherente con su lógica de contar estados filtrados, aunque no es un KPI canónico de solicitudes. El encabezado del PDF mostraba «Emitido 02:27:31» mientras sus metadatos indican creación a las 14:27:31 hora argentina; se reprodujo la ambigüedad con `toLocaleString('es-AR')` del runtime y se decidió mostrar horas de Historial y PDFs en formato de 24 horas. No se versiona el PDF ni se copian sus datos personales al repositorio.

Consulta de diagnóstico **propuesta, no ejecutada**, para un operador autorizado en copia o sesión de solo lectura. Sustituir el identificador y añadir la planta correspondiente; no exportar nombres de usuarios ni ejecutar `UPDATE`:

```sql
SELECT l.id, l."plantId", l."manufacturingOrder", l."materialCode",
       l.description AS producto_registrado, l."createdAt", l."updatedAt"
FROM "ProductionLot" l
WHERE l."manufacturingOrder" = :of
  AND l."plantId" = :plant_id
ORDER BY l."startedAt" DESC;

SELECT a."entityId" AS lot_id, a.action, a.reason, a.before, a.after, a."createdAt"
FROM "PlantAuditLog" a
WHERE a."entityType" = 'ProductionLot'
  AND a."entityId" = :lot_id
ORDER BY a."createdAt", a.id;
```

Comparar `producto_registrado` con la descripción esperada de la OF y con el campo `description` de `CREATE`/`CORRECTION`. Los parámetros `:of`, `:plant_id`, `:lot_id` son marcadores para una herramienta que admita parámetros; no son sintaxis para pegar directamente en `psql`.

- Revisados: `PlantHistoryPage.tsx`, `history-pdf.ts`, `history-summary-pdf.ts`, `PlantManagementPage.tsx`, `AppRouter.tsx`, `AppLayout.tsx`, `plant.controller.ts`, `plant.service.ts`, `schema.prisma`, DTO, guard de roles, selector de planta, seed y documentación de Fabricación/Laboratorio.
- No se ejecutaron pruebas ni consultas de datos: esta fase no cambia comportamiento. Las verificaciones de documentación son lectura, diff y enlaces/rutas.
- Decisiones pendientes: población histórica usable desde la creación de `LaboratorySample`; política para cancelaciones/retrocesos; criterio exacto de «producto»; audiencia de cada informe; permisos de exportación; umbrales medidos de rendimiento.

## Actualización: exportación del servidor incorporada a la base local (06/11/2026)

**Hecho verificado.** La exportación NDJSON aportada por el usuario tiene manifiesto LATEX_REPORTING_NDJSON_V1, corte del 05/11/2026 15:26 ART y snapshot consistente. Contiene 61 lotes, 424 estados, 118 decisiones, 117 muestras, 114 ítems de ajuste, 68 OE y 838 auditorías. Se verificaron IDs únicos, referencias internas, fechas parseables y pertenencia a una sola empresa/planta. El archivo se trasladó a `planta-latex-local-backups/` para mantener datos industriales y personales fuera de Git; su SHA-256 es `10D11C7530DE30D924AE6A53DD38DD10CD23B5BF708C77DA6D1B13E9F7480CF6`.

**Carga local controlada.** Se respaldó PostgreSQL en formato `pg_dump -Fc` antes de escribir (SHA-256 `54E4C710A638607CF1B4C7CFB7F3B26F0705DAE9F69A745810D3FAE8708D5216`). El importador `apps/backend/scripts/import-reporting-local.cjs` comprobó colisiones, mapeó los nueve tanques por número/código y creó 27 identidades históricas deshabilitadas, sin acceso a plantas. Una sola transacción incorporó 61 lotes, 415 estados **cerrados**, 118 decisiones, 117 muestras resueltas, 114 ítems, 67 OE **cerradas** y 838 auditorías. Se excluyeron nueve estados y una OE abiertos al corte: importarlos como operaciones vigentes habría entrado en conflicto con la operación local. Una verificación posterior confirmó cada cantidad por ID, usuarios inactivos y ausencia de accesos. Estado, lote activo y versión de los nueve tanques locales quedaron idénticos al valor previo.

**Calidad observada del origen.** Las 117 muestras tienen decisión vinculada del mismo lote y resolución; 114 registran además inicio de análisis. Hay una decisión APROBADO de septiembre sin muestra vinculada. Las 57 decisiones AJUSTE tienen al menos un motivo y suman 77 menciones, por lo que solicitudes y menciones no son equivalentes. En auditoría hay tres correcciones de descripción de lote; ninguna prueba por sí sola el defecto PRODUCTO reportado. No se modificaron descripciones históricas.

**Límite de interpretación.** La base local mezcla registros demostrativos preexistentes con los importados y el corte del servidor ya es pasado; sus totales no son una medición oficial actual. Las métricas de permanencia que incluyan períodos abiertos del servidor quedarían incompletas hasta disponer de un mecanismo de snapshot apropiado. El importador no creó migraciones ni alteró lógica operativa.
