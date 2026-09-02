# Modelo de datos actual

Fuente de verdad: `apps/backend/prisma/schema.prisma`.

## Núcleo multiempresa

- `Company`: empresa propietaria de usuarios, clientes, modelos y producción.
- `User`: usuario con rol `DUENO`, `SUPERVISOR`, `OPERARIO` o `ADMIN`.
- `Client` y `ClientContact`: cliente comercial y sus contactos.
- Todas las consultas operativas se aíslan por `companyId`.

## Catálogo de casillas

### CabinModel

Modelo comercial de casilla, por ejemplo RC4400, RC4900 o RC6000. Guarda código, nombre, descripción, dimensiones y vigencia.

### CabinModelRevision

Versión inmutable de fabricación de un modelo. Permite cambiar el proceso futuro sin alterar casillas ya creadas.

### CabinStageTemplate

Plantilla de etapa: código, nombre, sector, posición, tiempo previsto, peso en el avance y obligatoriedad.

### CabinStageDependency

Arista del grafo productivo. Indica qué plantilla debe completarse antes de habilitar otra.

## Orden de Producción

`Order` sigue siendo la entidad central: puede comenzar como presupuesto o como casilla de producción directa.

Además de los campos comerciales y logísticos, una casilla guarda:

- `cabinModelRevisionId`;
- `serialNumber`;
- `progressPct`;
- estado productivo global derivado;
- fechas planificada y de compromiso;
- costos, consumos, adjuntos y entrega.

### OrderStage

Snapshot de una etapa para una casilla concreta. Conserva nombre, sector, peso, tiempos, estado, avance, observaciones e hitos reales.

Estados:

```text
BLOQUEADA | DISPONIBLE | EN_PROCESO | PAUSADA |
COMPLETADA | RETRABAJO | CANCELADA
```

### OrderStageDependency

Snapshot de las dependencias. La habilitación no depende de la posición visual: depende de que todos los prerrequisitos estén `COMPLETADA`.

### OrderAssignment

Une orden, etapa opcional, recurso y usuario. Guarda `assignedByUserId`, fecha de asignación y eventual desasignación, por lo que se conserva quién asignó cada trabajo. Una etapa admite varios operarios y un operario puede participar en varias etapas, aunque solo puede tener un cronómetro activo.

La relación con la etapa se gestiona mediante `orderStageId`. Las asignaciones activas pueden crearse y modificarse, mientras que al quitarlas se completa `unassignedAt` para conservar el historial en lugar de borrar el registro.

### StageWorkSession

Sesión de trabajo real por etapa y operario. Guarda inicio, fin y observación. Es la base para tiempos reales y productividad.

`OperationLog`, `MaterialConsumption` y `OrderAttachment` también pueden referenciar una etapa específica.

Cada inicio, pausa, reanudación, finalización o cambio de estado de etapa genera un `OperationLog` con usuario, fecha y etapa. El Centro de Control combina estos eventos con asignaciones, sesiones y consumos para construir el seguimiento histórico de una casilla.

## Grafo productivo vigente

```text
CHASIS ──────────────────────────────────────────────────┐
PISO ────────────────────────────────────────────────────┤
PAREDES ─┬─ PINTURA ────────────────────────────────────┤
TECHO ───┼─ ELECTRICA ──────────────────────────────────┤
         ├─ SANITARIA ──────────────────────────────────┤
ABERTURAS┘                                               │
                                                         v
                                                     ARMADO
                                                        |
                                                TERMINACIONES
                                                        |
                                                     CALIDAD
                                                        |
                                                     ENTREGA
```

`ARMADO` es una barrera de sincronización: requiere CHASIS, PISO, PAREDES, TECHO, ABERTURAS, ELECTRICA, SANITARIA y PINTURA completas.

La planificación, las fechas y la asignación inicial se administran en `Order`; no se contabilizan como una etapa productiva ni afectan `progressPct`.

## Reglas derivadas

- El código de orden es único por empresa y usa `DISAL-AAAA-NNNN`.
- Crear una casilla copia una revisión completa y sus dependencias.
- Completar una etapa libera automáticamente sus sucesoras cuando corresponde.
- `progressPct` es el promedio ponderado de las etapas.
- El estado global de `Order` se recalcula desde las etapas; no reemplaza su estado individual.
- `Resource.linkedUserId` mantiene una correspondencia única entre operario y recurso humano.
- Los consumos conservan costo histórico y actualizan inventario.
