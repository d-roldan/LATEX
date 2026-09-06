# Modelo de datos de Planta de Látex DISAL

La fuente de verdad es `apps/backend/prisma/schema.prisma`.

## Entidades productivas

- `Tank`: configuración, capacidad, balanza, estado y lote activo de TK101–TK109.
- `ProductionLot`: OF, material, producto, planificación, prioridad, turno e inicio/fin del lote.
- `TankStateHistory`: períodos de permanencia por estado, duración, objetivo, responsable, descripción y fotografía puntual del peso.
- `QualityDecision`: aprobación, ajuste o rechazo, legajo, peso específico, motivo y recuperación.
- `PackagingOrder`: OE, línea, formato, inicio/fin, duración, kilogramos, unidades y merma.
- `PlantAuditLog`: cambios auditables con valores anterior/nuevo y motivo.
- `DailyPlantClosure`: fotografía JSON del resumen de una jornada, observaciones y responsable del cierre.

## Relaciones principales

```text
Company
 ├─ Tank ── ProductionLot
 │   └─ TankStateHistory
 │
 ├─ QualityDecision
 ├─ PackagingOrder
 ├─ PlantAuditLog
 └─ DailyPlantClosure
```

## Tiempo y duración

Las fechas productivas usan `TIMESTAMPTZ(3)`. La base conserva instantes absolutos y el frontend presenta `America/Argentina/Buenos_Aires`.

La duración cerrada se conserva en segundos. Para estados en curso se calcula contra el instante actual. Los informes diarios incluyen cualquier período que se superponga con la jornada y recortan su duración a los límites del día.

## Telemetría

Las lecturas cada dos segundos viven únicamente en memoria. No existe una tabla de muestras. Al cambiar de estado se copia el último peso disponible a `TankStateHistory.weightKg`, generando pocos hitos auditables por lote.

Esta memoria representa sólo el último valor para visualización. InfluxDB continúa siendo la fuente prevista para reconstruir la señal de alta frecuencia; PostgreSQL debe almacenar resultados consolidados, referencias y evidencia suficiente para repetir un cálculo.

## Restricciones actuales

- `Tank.activeLotId` permite un único lote activo por tanque.
- `PackagingOrder.lotId` vincula cada OE con un único lote.
- `Notification.readAt` registra lectura, pero no aceptación ni resolución de una entrega entre sectores.
- `QualityDecision` conserva la decisión general, no el detalle de muestra y ensayos.
- No existen todavía entidades productivas para ejecución de receta, pasos, cargas, eventos PLC o consumos parciales de envasado.

Estas restricciones deben contrastarse con casos reales de mezcla, transferencia, recuperación, envasado parcial y relación varios-a-varios entre OF y OE.

## Ampliación propuesta

Las siguientes entidades son conceptuales. Sus nombres y campos definitivos deben cerrarse después del relevamiento industrial.

- `SectorHandoff`: entrega de trabajo entre sectores, estado de recepción/resolución, responsables, tiempos y observaciones.
- `IntegrationEvent`: evento inmutable recibido desde PLC/SCADA o Node-RED, con `eventId` idempotente, origen, secuencia, timestamps y calidad.
- `RecipeExecution`: corrida de receta asociada a OF, tanque y fotografía de versión y parámetros efectivos.
- `RecipeStepExecution`: ejecución ordenada de cada paso, resultado, modo, timestamps, alarmas e intervenciones.
- `MaterialCharge`: carga automática o manual, material, lote, setpoint, tolerancia, cantidad real, desvío y evidencia del cálculo.
- `AssetAssignmentRevision`: relación histórica válvula–cañería–material–tanque con período de vigencia.
- `LaboratorySample`: muestra, extracción, recepción, analista, estado e iteración.
- `LaboratoryTestResult`: ensayo, valor, unidad, límites, instrumento y conformidad.
- `PackagingConsumption`: cantidad de un lote consumida por una OE, permitiendo una relación explícita varios-a-varios.
- `MassBalance`: entradas, envasado, merma, rechazo, remanente y diferencia no explicada con versión de cálculo.

Relación objetivo simplificada:

```text
Tank ── ProductionLot ── RecipeExecution ── RecipeStepExecution
  │           │                    │                  └─ MaterialCharge
  │           ├─ LaboratorySample ── LaboratoryTestResult
  │           ├─ SectorHandoff
  │           └─ PackagingConsumption ── PackagingOrder
  │
  ├─ TankStateHistory
  └─ IntegrationEvent

ProductionLot ── MassBalance
```

## Reglas de diseño para la ampliación

- El evento industrial original debe ser inmutable; una consolidación o corrección se guarda por separado.
- `eventId` debe ser único por fuente para que un reintento no duplique información.
- Una receta histórica debe conservar los valores efectivos aunque cambie la receta maestra.
- Las configuraciones de activos y materiales deben tener vigencia histórica.
- Toda medición calculada debe conservar algoritmo, versión, ventanas consultadas y nivel de confianza.
- Los consumos deben ser explícitos; no deben inferirse sólo por cercanía horaria.
- La lectura de una notificación y la resolución de una entrega son hechos diferentes.
