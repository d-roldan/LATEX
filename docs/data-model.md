# Modelo de datos de Planta de Látex DISAL

La fuente de verdad es `apps/backend/prisma/schema.prisma`.

## Alcance multiplanta vigente

`Company` sigue representando a la empresa. `Plant` identifica Látex, Terplast, Slurry y Enduido, guarda su configuración y operación final. `UserPlantAccess` limita la visibilidad y habilita explícitamente trasvases. Todas las entidades productivas llevan `plantId`; `Tank` conserva sus IDs históricos, admite tipo `TANK`/`DISPERSER`, `scaleKey` nula y modos `AUTOMATIC`, `PENDING` y `NOT_INSTALLED`. `TransferOperation` registra inicio, fin, responsables y duración sin crear una OE. `DailyPlantClosure` es única por planta y fecha.

## Entidades productivas

- `Tank`: configuración, capacidad, balanza, estado y lote activo de TK101–TK109.
- `ProductionLot`: OF, material, producto, planificación, prioridad, turno e inicio/fin del lote.
- `TankStateHistory`: períodos de permanencia por estado, duración, objetivo, responsable, descripción y fotografía puntual del peso.
- `QualityDecision`: aprobación, ajuste o rechazo, legajo, peso específico, motivo y recuperación.
- `LaboratorySample`: una iteración de muestra por envío a Laboratorio, con estados de espera, recepción y resolución, responsables y timestamps.
- `IntegrationInbox`: bandeja durable de eventos PLC/SCADA/Node-RED, idempotente por planta, fuente y `eventId`; recibir un evento no modifica por sí solo la operación.
- `PackagingOrder`: OE, línea, formato, dosificadora, filtro, inicio/fin, duración, kilogramos, unidades y merma.
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

Dentro del backend de LATEX, las lecturas recibidas cada dos segundos viven únicamente en memoria y no existe una tabla de muestras en PostgreSQL. Al cambiar de estado se copia el último peso disponible a `TankStateHistory.weightKg`, generando pocos hitos auditables por lote.

Esta memoria representa sólo el último valor para visualización. La señal continua se almacena históricamente segundo a segundo en InfluxDB, que es la fuente utilizada para reconstruir el peso de alta frecuencia. LATEX consulta ese histórico, pero su endpoint de recepción no lo escribe. PostgreSQL conserva los resultados consolidados, las referencias y la evidencia operativa necesaria, sin duplicar todas las muestras.

## Restricciones actuales

- `Tank.activeLotId` permite un único lote activo por tanque.
- `PackagingOrder.lotId` vincula cada OE con un único lote.
- `Notification.readAt` registra lectura, pero no aceptación ni resolución de una entrega entre sectores.
- `QualityDecision` conserva la decisión general y se vincula con el ciclo de muestra resuelto; todavía no conserva el detalle estructurado de cada ensayo.
- No existen todavía entidades productivas para ejecución de receta, pasos, cargas o consumos parciales de envasado. La bandeja industrial recibe eventos, pero sus procesadores de negocio aún deben definirse y habilitarse por tipo.

Estas restricciones deben contrastarse con casos reales de mezcla, transferencia, recuperación, envasado parcial y relación varios-a-varios entre OF y OE.

## Ampliación propuesta posterior

Las siguientes entidades son conceptuales. Sus nombres y campos definitivos deben cerrarse después del relevamiento industrial.

- `SectorHandoff`: entrega de trabajo entre sectores, estado de recepción/resolución, responsables, tiempos y observaciones.
- `RecipeExecution`: corrida de receta asociada a OF, tanque y fotografía de versión y parámetros efectivos.
- `RecipeStepExecution`: ejecución ordenada de cada paso, resultado, modo, timestamps, alarmas e intervenciones.
- `MaterialCharge`: carga automática o manual, material, lote, setpoint, tolerancia, cantidad real, desvío y evidencia del cálculo.
- `AssetAssignmentRevision`: relación histórica válvula–cañería–material–tanque con período de vigencia.
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
