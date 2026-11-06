# Fase 0 · Catálogo formal de indicadores

**Naturaleza:** diseño propuesto basado en campos verificados en `apps/backend/prisma/schema.prisma` y operaciones de `plant.service.ts`. No se perfiló la base real. **V** = técnicamente verificable con fuentes persistidas, pendiente de medir cobertura; **L** = calculable con limitaciones explícitas; **N** = no disponible como medición oficial. Ningún valor de ejemplo es un resultado de LATEX.

## Convenciones comunes obligatorias

- Ámbito: `companyId` autenticada e intersección entre `plantId` solicitadas y `UserPlantAccess` vigente; no se infiere permiso por la URL. Cada tarjeta muestra plantas incluidas/excluidas y número de registros elegibles.
- Tiempo: zona `America/Argentina/Buenos_Aires`; período `[inicio, fin)` convertido a instantes UTC. Los timestamps `Timestamptz` se comparan como instantes. Mes 10/2026: 01/10/2026 00:00 local incluido, 01/11/2026 00:00 local excluido.
- Grano: lotes = `ProductionLot.id`; decisiones = `QualityDecision.id`; muestras = `LaboratorySample.id`; períodos = `TankStateHistory.id`; OE = `PackagingOrder.id`. El texto de OF es etiqueta, no clave. Toda agregación vuelve al ID antes de unir relaciones 1:N.
- Exclusiones predeterminadas: `cancelledAt != null` queda fuera de KPI operativos salvo informe de cancelaciones. Las decisiones y muestras históricas anteriores al esquema actual requieren perfilado. No excluir un lote abierto de un KPI de «iniciadas» por no tener fin.
- Nulos: contar cobertura (`con dato / población elegible`) y mostrar `—` si no hay denominador; cero sólo cuando el denominador existe y el conteo es efectivamente cero. Un tiempo abierto nunca se completa con `now` para una métrica de ciclo cerrado. Un período de ocupación abierto sí se recorta a `min(now, fin)` y se etiqueta «en curso».
- Correcciones: por defecto métricas de **valor vigente al instante de consulta** con `dataCutoff` explícito. `PlantAuditLog` permite inspeccionar cambios, pero no se ha probado reconstrucción completa «como se veía en una fecha pasada». Un PDF regenerado puede cambiar.
- Comparaciones: sólo plantas con capacidad y cobertura compatible; informar exclusiones. Una variación intermensual exige idéntica definición y poblaciones comparables.
- Pruebas comunes: casos A–J de `PLAN_MAESTRO.md`, conciliación contra IDs de origen, fechas de borde y autorización cruzada. La validación de datos reales queda para un entorno autorizado en fases posteriores.

## Catálogo de Laboratorio y calidad

La periodicidad de publicación propuesta es mensual, con rango personalizado; el desglose puede ser por día, mes, planta, producto o tanque cuando el origen lo permite. Las pruebas `A`–`J` se describen en `PLAN_IMPLEMENTACION.md`.

| ID y estado | Indicador / objetivo | Fórmula, unidad y grano | Fuente y fecha de inclusión | Exclusiones, nulos y límite | Ejemplo / prueba focal |
| --- | --- | --- | --- | --- | --- |
| `LAB-001` V | Muestras recibidas; carga de ingreso | `COUNT(DISTINCT sample.id)`; muestras | `LaboratorySample.receivedAt` en período | Sin `receivedAt` fuera; canceladas fuera; cobertura histórica desconocida | 5 recibidas = 5. F |
| `LAB-002` V | Muestras resueltas; producción analítica | `COUNT(DISTINCT sample.id)`; muestras | `LaboratorySample.resolvedAt` en período | Resolver sin decisión asociada se señala; canceladas fuera | 4 resueltas = 4. A/F |
| `LAB-003` L | Solicitudes de ajuste; incidencia | `COUNT(DISTINCT decision.id)` donde `result=AJUSTE`; solicitudes | `QualityDecision.createdAt` en período | `cancelledAt` fuera; decisión editada sigue siendo una; requiere conciliar posibles retrocesos | Una decisión con 3 motivos y 2 materiales = 1. A/B/E |
| `LAB-004` L | OF con ajustes; alcance | `COUNT(DISTINCT decision.lotId)` entre `LAB-003`; OF/lotes | `QualityDecision.createdAt` | Agrupar por `lotId`, no número de OF; una OF con 2 solicitudes = 1 OF | Dos decisiones de un lote = 1. A/D |
| `LAB-005` L | Menciones de motivos; Pareto | `SUM(cardinality(adjustmentReasons))` para `LAB-003`; menciones | `QualityDecision.adjustmentReasons`, fecha de decisión | Arreglo vacío/valor desconocido a categoría «Sin clasificar» separada; nombres corregidos muestran valor vigente | 1 solicitud con 3 motivos = 3. B/E |
| `LAB-006` L | Participación por motivo; priorización | menciones del motivo / `LAB-005` × 100; %, acumulado ordenado | Igual a `LAB-005` | Denominador = menciones, no solicitudes; sin menciones = `—` | 3, 1 menciones → 75 %, 25 %, acumulado 75/100. B |
| `LAB-007` L | OF aprobadas al primer análisis; calidad inicial | Lotes cuya **primera decisión resuelta no cancelada** es `APROBADO` / lotes con primera decisión resuelta en período × 100; % | `LaboratorySample` vinculada a `QualityDecision`; fecha de primera resolución | Necesita vínculo y orden determinista `(resolvedAt, sample.id)`; lotes sin primera resolución fuera; ajustes/rechazos previos impiden aprobación inicial | 2 de 4 lotes = 50 %. A/F |
| `LAB-008` L | Espera hasta recepción; logística de muestra | promedio y distribución de `(receivedAt-requestedAt)` para muestras recibidas en período; segundos/minutos | `LaboratorySample`, fecha `receivedAt` | Sin recepción fuera del promedio y dentro de cobertura; intervalos negativos se marcan inválidos | 10 y 20 min → 15 min. F |
| `LAB-009` L | Espera hasta inicio de análisis | promedio y distribución de `(analysisStartedAt-receivedAt)` para inicios en período; segundos/minutos | `LaboratorySample.analysisStartedAt` | Sin inicio fuera; no sumar con permanencia sin explicar solapamiento | 5 y 15 min → 10 min. F |
| `LAB-010` L | Análisis transcurrido; tiempo de ciclo | promedio y distribución de `(resolvedAt-analysisStartedAt)` para resoluciones en período; segundos/minutos | `LaboratorySample.resolvedAt` | No representa tiempo activo; sin resolución fuera; timestamps inválidos se reportan | 30 y 40 min → 35 min. F |
| `LAB-011` L | Permanencia mensual en Laboratorio | `SUM(max(0,min(endedAt o corte,fin)-max(startedAt,inicio)))` en estados `LABORATORIO`; horas | `TankStateHistory`, intersección de fechas | Estado abierto recortado a corte; excluir intervalos sin lote para análisis por OF; calidad de retrocesos a revisar | 31/10 23:00–01/11 01:00 → 1 h en cada mes. C |
| `LAB-012` L | Solicitudes por 100 OF evaluadas | `LAB-003` / lotes con primera decisión resuelta en período × 100; solicitudes/100 OF | Decisiones y muestras, fecha de primera resolución para denominador | **Numerador y denominador deben compartir cohorte**: para versión estricta, contar ajustes de esos lotes hasta corte, no ajustes ajenos al conjunto | 4 solicitudes en 20 OF evaluadas = 20/100. A |
| `LAB-013` L | OF que requirieron ajuste | lotes con ≥1 ajuste / lotes con primera decisión resuelta en período × 100; % | Decisiones y muestras, cohorte de primera resolución | Misma cohorte; diferencia respecto de solicitudes/100 OF | 3 lotes de 20 = 15 %. A |
| `LAB-014` L | Reanálisis / ciclos múltiples | lotes con ≥2 muestras no canceladas / lotes con ≥1 muestra no cancelada de cohorte; %; además distribución de iteraciones | `LaboratorySample`, fecha de primera solicitud o primera resolución según informe | No igualar automáticamente reanálisis con ajuste; revisar cancelaciones/duplicados | 1 de 5 lotes = 20 %. A |
| `LAB-015` L | Tiempo a aprobación | para lotes aprobados en período, `primera aprobación.resolvedAt - primera muestra.requestedAt`; horas | Muestras y decisiones, fecha de aprobación | Sin aprobación fuera; incluye esperas y ajustes, no tiempo efectivo de análisis | 1 día y 2 días → 1,5 días. A |
| `LAB-016` L | Rechazos por tipo | `COUNT(DISTINCT decision.id)` por `RECHAZADO_RECUPERAR`/`RECHAZADO_DESTRUIR`; decisiones | `QualityDecision.createdAt` | Canceladas fuera; no equiparar `AJUSTE` a rechazo | 2 recuperar + 1 destruir = 3. J |
| `LAB-017` L | Incidencia de causa por producto/planta | `LAB-005` desglosado por `ProductionLot.description` vigente y `plantId`; menciones | Decisión en período; dimensión vigente al corte | Descripción libre puede ser errónea; mostrar código de material y cobertura; no comparar categorías sin normalización | 6 menciones de viscosidad en producto X. B/E |
| `LAB-018` L | Pareto de materiales ajustados | Solicitudes `LAB-003` agrupadas por `ProductionLot.materialCode`; porcentaje = solicitudes del material / `LAB-003` × 100; además `COUNT(DISTINCT lotId)` | `QualityDecision.createdAt` en período y material vigente de la OF | El material identifica el producto de la OF, no los insumos de `QualityAdjustmentItem`; correcciones del lote alteran el desglose vigente | 2 solicitudes de material A y 1 de B → 66,67 % y 33,33 %. B/D/E |
| `LAB-019` L | Motivos por material de la OF | Por cada decisión `AJUSTE`, una mención por cada motivo de `adjustmentReasons` atribuida al código de material de su lote | Misma cohorte de `LAB-003`; dimensión material vigente | Una solicitud con 3 motivos cuenta 1 en `LAB-018` y 3 menciones en `LAB-019`; no multiplicar por insumos agregados | A: Color 2 y Viscosidad 1 → 3 menciones. B/E |

**Decisión pendiente de negocio:** `LAB-007`, `LAB-012` y `LAB-013` requieren ratificar si la cohorte mensual corresponde a primera decisión, primera muestra o OF terminada. Se recomienda **primera decisión resuelta en el mes** para tasas de calidad y mostrar explícitamente el denominador. Si la primera decisión de un lote fue anterior al período, ese lote no ingresa en esa cohorte aunque tenga un ajuste nuevo en el mes; `LAB-003` sigue contabilizando el ajuste del mes como flujo de solicitudes. Esta diferencia debe ser visible en el dashboard.

## Catálogo de Fabricación y Envasado

| ID y estado | Indicador / objetivo | Fórmula, unidad y grano | Fuente y fecha | Límite / ejemplo / prueba |
| --- | --- | --- | --- | --- |
| `PRO-001` V | OF iniciadas | `COUNT(DISTINCT lot.id)`; OF | `ProductionLot.startedAt` en período | Canceladas fuera del KPI principal, en anexo de cancelaciones; 7 lotes = 7. D |
| `PRO-002` V | OF finalizadas | `COUNT(DISTINCT lot.id)`; OF | `ProductionLot.finishedAt` en período | Sin fin fuera; 5 finalizadas = 5. D |
| `PRO-003` L | Kg planificados | `SUM(plannedQuantityKg)` sobre cohorte `PRO-001` o `PRO-002`, elegida y rotulada; kg | `ProductionLot.plannedQuantityKg` y fecha de cohorte | Nulos excluidos con cobertura; suma 100+200 = 300 kg, no tratar nulo como cero. |
| `PRO-004` L | Duración de fabricación | `endedAt-startedAt` del estado `FABRICANDO`, por ciclo/lote, atribuido al mes de fin; horas | `TankStateHistory` | Estado abierto no es ciclo cerrado; varios intervalos por OF se agregan según regla documentada; no equivale a trabajo efectivo. C |
| `PRO-005` L | Tiempo hasta liberación | primera decisión `APROBADO` resuelta − `ProductionLot.startedAt`; horas por lote | Lote, muestra y decisión | Incluye fabricación, esperas y ajustes; sin aprobación fuera. A |
| `ENV-001` L | Kg envasados | `SUM(producedKg)` de OE finalizadas, no canceladas, con valor no nulo; kg | `PackagingOrder.finishedAt` | Validar completitud/captura; 100+50 = 150 kg envasados, **no** fabricados. |
| `ENV-002` L | Unidades envasadas | `SUM(producedUnits)` de OE finalizadas con dato; unidades | `PackagingOrder.finishedAt` | Nulos y formatos no comparables; desglosar por formato. |
| `ENV-003` L | Merma de envasado | `SUM(wasteKg)` de OE finalizadas con dato; kg | `PackagingOrder.finishedAt` | No confundir con merma de fabricación; revisar signo y captura. |
| `ENV-004` L | Espera hasta envasado | primera OE `startedAt` − primera aprobación `resolvedAt`; horas | OE y decisiones | Puede haber transferencias u otros recorridos; sólo plantas con proceso compatible. |
| `PRO-006` N | Kg realmente fabricados por OF | No hay campo validado de cantidad fabricada final por OF | No disponible en `ProductionLot` | Peso puntual, señal Influx y kg envasados no sustituyen la medición. Requiere fuente/evento de cierre validado. |
| `PRO-007` N | Diferencia plan-real, cumplimiento y kg reales por tanque | `realKg - plannedQuantityKg`, `realKg/plannedQuantityKg` sólo cuando `PRO-006` exista; kg/% | Pendiente | No publicar mientras falte `realKg` confiable. |
| `PRO-008` N | OEE/eficiencia global | Requiere disponibilidad, rendimiento ideal y calidad con tiempos planificados y pérdidas clasificadas | Pendiente | No hay evidencia suficiente de paradas, ciclos ideales y rechazo industrial. |

## Pareto: contrato matemático y calidad de categorías

Ejemplo: decisión D1 con tres motivos `[Viscosidad, Color, Brillo]` y dos materiales; D2 con `[Viscosidad]`. Resultado: **2 solicitudes**, **4 menciones**; Viscosidad 2/4 = 50 %, Color 1/4 = 25 %, Brillo 1/4 = 25 %. Acumulado ordenado: 50 %, 75 %, 100 %. Si se presenta «solicitudes afectadas por motivo», el denominador son 2 solicitudes y los porcentajes 100 %, 50 %, 50 %; se advierte que no suman 100 %.

La dimensión canónica inicial conserva cada cadena original; normalización de variantes y cambios de nombre requiere tabla de correspondencias versionada aprobada por negocio en otra fase. Valores vacíos se cuentan como «Sin clasificar» y se informan; una corrección de motivo altera el Pareto vigente, con enlace al `PlantAuditLog` correspondiente. Se debe fijar un desempate estable en orden alfabético para igual número de menciones.

El Pareto de **materiales de la OF** utiliza solicitudes como denominador: cada decisión pertenece a un solo `ProductionLot.materialCode`, por lo que sus porcentajes suman 100 %. El desglose material–motivo cuenta menciones y puede superar el número de solicitudes. Los materiales agregados durante el ajuste (`QualityAdjustmentItem.materialCode`) son otra dimensión y permanecen en el detalle; no se atribuye automáticamente cada motivo a cada insumo.

## Reglas de conciliación antes de habilitar un KPI

1. Perfil de cobertura por planta/mes: lotes, muestras, decisiones, estados, cancelaciones, campos nulos, fechas invertidas y claves huérfanas, sin exponer datos sensibles.
2. Comparar decisiones de ajuste con períodos `AJUSTE` sólo como control de discrepancias; la diferencia no se «corrige» sumando estados.
3. Para una muestra resuelta verificar `qualityDecisionId`, `result`, `resolvedAt` y pertenencia al mismo lote/planta/empresa; clasificar inconsistencias.
4. Verificar diez casos representativos y todos los bordes del escenario A–H con registros de origen antes de publicar porcentajes.
5. Registrar versión de fórmula, filtros normalizados, fecha de corte, cobertura y exclusiones en API, pantalla y exportación.

## Cobertura empírica de la exportación LATEX al 05/11/2026

La exportación aportada para desarrollo local contiene 117 muestras resueltas vinculadas a decisiones del mismo lote; 114/117 tienen los cuatro hitos necesarios para medir el intervalo de análisis desde `analysisStartedAt`. Hay una decisión APROBADO anterior sin muestra. Para ajustes, 57 decisiones aportan 77 menciones de motivo: `LAB-003` y `LAB-005` deben conservar denominadores distintos. Nueve estados abiertos y una OE abierta no se importaron a las tablas operativas locales, por lo que `LAB-011` no debe declararse completo para el corte del 05/11. Estas observaciones no sustituyen el perfilado por planta/mes ni habilitan por sí solas tasas oficiales: la base local también contiene datos demostrativos anteriores.

## Estado de implementación local de Fase 3 (06/11/2026)

`/api/reporting/laboratory` expone conteos de muestras recibidas y resueltas, solicitudes `AJUSTE`, OF ajustadas, menciones de motivos, cohorte de primera resolución, aprobación inicial, OF con múltiples ciclos, promedios de espera y análisis, permanencia mensual en `LABORATORIO`, serie mensual y conteos por planta. `/api/reporting/laboratory/adjustments` expone Pareto por menciones y decisiones paginadas; `/api/reporting/laboratory/lots/:lotId` expone los ciclos de una OF autorizada. Son cálculos de lectura del estado vigente.

En noviembre de 2026 la exportación de origen y la API local coinciden en 15 solicitudes, 7 OF ajustadas y 18 menciones. La API calcula 5 aprobaciones iniciales de 13 OF en la cohorte observada (38,46 %). Esa cifra se presenta como cohorte observada: el archivo empieza el 01/10/2026, puede faltar historia anterior y la base local mezcla registros de demostración. La duración de permanencia no se publica como completa para el corte de exportación porque nueve estados abiertos no se importaron. La edición posterior de motivos cambia el Pareto vigente; todavía no existe reconstrucción `as of`.

## Estado local de indicadores productivos (06/11/2026)

`/api/reporting/production` implementa `PRO-001` y `PRO-002`, informa `PRO-003` sobre la cohorte de OF iniciadas con cobertura de nulos, y ofrece un promedio limitado de intervalos cerrados `FABRICANDO` para `PRO-004` por mes de fin. No equivale a tiempo de trabajo ni a duración total por OF. Para Envasado suma `producedKg`, `producedUnits` y `wasteKg` únicamente entre OE terminadas con valor presente, mostrando cuántas OE aportan cada campo. En noviembre, las 15 OE de origen carecen de `producedKg`; 11 tienen `wasteKg` y suman 525 kg. `PRO-006`–`PRO-008` siguen no disponibles: no se infiere cantidad fabricada real, plan-real, merma de fabricación ni OEE.
