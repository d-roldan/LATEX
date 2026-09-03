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
