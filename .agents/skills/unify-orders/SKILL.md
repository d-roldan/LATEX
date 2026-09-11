---
name: unify-orders
description: >
  Plan completo para unificar Presupuesto y Orden de Trabajo en una sola entidad "Order"
  con un ID unico, dos fases (comercial + produccion), multiples adjuntos, visor interactivo,
  y PDFs formales de presupuesto y remito.
  Usar para cambios en el módulo comercial de órdenes, presupuestos y OT; no para OF, OE o estados de tanques.
---

# Skill: Unificacion Presupuesto + Orden de Trabajo

## Alcance en Codex

Referencia histórica del módulo comercial. Confirmar cada ruta y comportamiento contra el código vigente antes de modificarlo. No ejecutar este plan como una nueva implementación ni aplicarlo al flujo multiplanta de tanques.

## Estado histórico: COMPLETADO (v2.1)

Todas las etapas de implementación han sido ejecutadas. Esta skill sirve como referencia
de la arquitectura actual del sistema.

---

## Decisiones Confirmadas e Implementadas

### Codigo y Numeracion
- **Formato**: `ORD-{AÑO}-{4 digitos}` — Ejemplo: `ORD-2026-0001`
- **Secuencial por empresa y por año**: cada empresa arranca en 0001 cada año nuevo
- **Auto-generado por el backend** al crear. El usuario nunca lo ve ni lo edita
- **Inmutable**: una vez creado, el codigo no se puede modificar

### Relacion
- **1:1** por ahora (un registro = un presupuesto que se convierte en una OT)
- Diseñado para migrar a **1:N** en el futuro

### Nuevo Campo: Orden de Compra
- Campo `purchaseOrderNumber`: texto libre, opcional
- Registra el numero de orden de compra del cliente
- Apartado visible en la UI: "Orden de Compra"
- El buscador acepta buscar por Orden de Compra

### Archivos Adjuntos
- **Multiples archivos** por orden (imagenes y PDFs)
- Tabla separada `OrderAttachment` (id, orderId, fileName, fileUrl, mimeType, sizeBytes, uploadedAt)
- Se pueden subir al crear la orden y en cualquier momento posterior (excepto ordenes cerradas)
- **Operarios** pueden **ver** adjuntos desde Mi Turno (sin boton de descarga)
- **Supervisores/Dueños** pueden ver, descargar y eliminar adjuntos

### Visor Interactivo de Adjuntos (IMPLEMENTADO)
- Thumbnails 32x32 para imagenes en la lista
- Click en icono abre visor fullscreen (portal al body)
- **Imagenes**: zoom proporcional (25%-500%) con botones ➕/➖/100%, arrastre con manita (mousedown drag-scroll)
- **PDFs**: iframe fullscreen con viewer nativo del navegador
- Propiedad `hideDownload` en AttachmentList para bloquear descarga (usado en OperatorPage)

### Flujo de Creacion

#### Crear como Presupuesto
- `commercialStatus = BORRADOR`, `productionStatus = null`
- Muestra **todos** los campos comerciales: items, costeo de horas, validez, dias de entrega
- Campos de produccion **ocultos** hasta que se apruebe
- El costeo completo es visible y editable

#### Crear como OT Directa
- `commercialStatus = null`, `productionStatus = PENDIENTE`
- **No requiere** items ni costeo al crear (se pueden agregar despues)
- `estimatedTimeMin` y `estimatedCost` se ingresan a mano o se dejan en 0
- Campos de produccion visibles: prioridad, fecha compromiso, etc.
- Seccion comercial visible pero vacia, con badge "Sin Presupuesto"

### Flujo de Aprobacion
- **Roles que aprueban**: DUENO, SUPERVISOR, ADMIN
- **Al aprobar se pide**: fecha estimada de entrega (`commitmentDate`) + nivel de prioridad
- Resultado: `commercialStatus = APROBADO`, `productionStatus = PENDIENTE`, `approvedAt = now()`
- Una vez en produccion, `commercialStatus` queda **congelado**

### Estado VENCIDO (automático)
- Si la fecha `validUntil` del presupuesto ya pasó y `commercialStatus` no es APROBADO,
  el sistema muestra la orden como VENCIDA automáticamente.
- No es un campo guardado; es calculado en frontend al renderizar.
- No aparece como opción en el selector manual de estado.

### Vista y Navegacion
- **Menu**: una sola entrada → "Ordenes de Produccion"
- **Ruta**: `/orders`
- **Tabs de filtro**: Todos | Presupuestos | En Produccion | Cerrados
- **Detalle**: modal con ancho 1200px, altura mínima 85vh, consistente entre pestañas
- **Dos pestañas** en el detalle:
  - Sección Comercial (presupuesto): items, costeo, validez, selector de estado rápido, PDF
  - Sección Producción (OT): asignaciones, adjuntos, eventos, consumos, remito
- Botón "Editar OT" en el encabezado del modal (edición general)
- Edición bloqueada para ordenes FINALIZADA/ENTREGADA/CANCELADA

### Ordenamiento y Búsqueda
- Lista ordenable por cualquier columna (click en encabezado, toggle ASC/DESC)
- Eventos mostrados en orden descendente (más reciente primero)
- Buscador acepta: codigo, titulo, cliente, purchaseOrderNumber

### PDFs
- **PDF de Presupuesto**: formato comercial formal, con datos de empresa, cliente, items,
  costeo de horas, totales, validez y espacio de firma. Generado via iframe oculto.
- **Remito de Entrega**: documento formal con detalle de OT, checklist de entrega,
  notas de cierre y firmas (DISAL + Cliente). Generado via iframe oculto.
- Ambos renderizan HTML/CSS desde el frontend sin dependencias externas de PDF.

### Permisos y Roles

| Acción | OPERARIO | SUPERVISOR | DUENO/ADMIN |
|--------|----------|------------|-------------|
| Ver lista de ordenes | ❌ | ✅ | ✅ |
| Crear orden | ❌ | ✅ | ✅ |
| Editar datos generales | ❌ | ✅ | ✅ |
| Cambiar estado comercial | ❌ | ✅ | ✅ |
| Aprobar presupuesto | ❌ | ✅ | ✅ |
| Subir adjuntos | ❌ | ✅ | ✅ |
| Ver adjuntos | ✅ | ✅ | ✅ |
| Descargar adjuntos | ❌ | ✅ | ✅ |
| Eliminar adjuntos | ❌ | ✅ | ✅ |
| Ejecutar OT (start/pause/finish) | ✅ | ✅ | ✅ |
| Generar PDF presupuesto | ❌ | ✅ | ✅ |
| Generar remito | ❌ | ✅ | ✅ |

---

## Modelo de Datos (Prisma) — Estado Actual

### Enums

```prisma
enum CommercialStatus {
  BORRADOR
  ENVIADO
  APROBADO
  RECHAZADO
  VENCIDO
}

enum ProductionStatus {
  PENDIENTE
  PLANIFICADA
  EN_PROCESO
  PAUSADA
  FINALIZADA
  ENTREGADA
  CANCELADA
  RETRABAJO
}
```

### Modelo Principal: Order

```prisma
model Order {
  id                  String             @id @default(cuid())
  companyId           String
  clientId            String
  createdByUserId     String?
  code                String             // "ORD-2026-0001" — auto-generado, inmutable
  title               String
  description         String
  purchaseOrderNumber String?            // Orden de compra del cliente (texto libre)

  // ── Fase comercial (presupuesto) ──
  commercialStatus    CommercialStatus?  // null = creado directo como OT
  validUntil          DateTime?
  deliveryTimeDays    Int?
  approvedAt          DateTime?
  estimatedMaterials  String?

  // ── Fase produccion (orden de trabajo) ──
  productionStatus    ProductionStatus?  // null = aun en fase comercial
  priority            Int                @default(3)
  plannedDate         DateTime?
  commitmentDate      DateTime?
  startedAt           DateTime?
  finishedAt          DateTime?
  deliveredAt         DateTime?
  closedAt            DateTime?
  closedByUserId      String?
  deliveryChecklist   String?
  deliveryNote        String?
  notes               String?
  isSigned            Boolean            @default(false)

  // ── Compartidos ──
  estimatedTimeMin    Int
  estimatedCost       Decimal            @db.Decimal(12, 2)
  attachmentUrl       String?            // Legacy
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  // ── Relaciones ──
  company             Company            @relation(...)
  client              Client             @relation(...)
  createdByUser       User?              @relation("OrderCreator", ...)
  closedByUser        User?              @relation("OrderCloser", ...)

  items               OrderItem[]
  costingHours        OrderCostingHour[]
  assignments         OrderAssignment[]
  operationLogs       OperationLog[]
  materialConsumptions MaterialConsumption[]
  attachments         OrderAttachment[]

  @@unique([companyId, code])
  @@index([companyId, commercialStatus])
  @@index([companyId, productionStatus])
  @@index([companyId, commitmentDate])
}
```

### Modelo: OrderAttachment

```prisma
model OrderAttachment {
  id         String   @id @default(cuid())
  orderId    String
  fileName   String
  fileUrl    String
  mimeType   String   // "image/png", "application/pdf", etc.
  sizeBytes  Int?
  uploadedAt DateTime @default(now())

  order      Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId])
}
```

---

## Arquitectura Backend — Estado Actual

### Modulo activo: `apps/backend/src/modules/orders/`

```
orders/
  orders.module.ts
  orders.controller.ts
  orders.service.ts
  dto/
    create-order.dto.ts
    update-order.dto.ts
    update-commercial-status.dto.ts
    update-production-status.dto.ts
    approve-order.dto.ts
    assign-order.dto.ts
    add-consumption.dto.ts
    add-event.dto.ts
    close-delivery.dto.ts
```

### Endpoints activos

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | /orders | Listar con filtros |
| GET | /orders/stats | Estadisticas combinadas |
| GET | /orders/:id | Detalle completo con adjuntos |
| POST | /orders | Crear |
| PATCH | /orders/:id | Editar datos generales |
| PATCH | /orders/:id/commercial-status | Cambiar estado comercial |
| PATCH | /orders/:id/production-status | Cambiar estado de produccion |
| POST | /orders/:id/approve | Aprobar presupuesto → activa produccion |
| POST | /orders/:id/assignments | Asignar recurso/operario |
| POST | /orders/:id/events | Agregar evento operativo |
| POST | /orders/:id/consumptions | Registrar consumo de material |
| POST | /orders/:id/close-delivery | Cerrar entrega con checklist y firma |
| POST | /orders/:id/attachments | Subir archivo adjunto |
| DELETE | /orders/:id/attachments/:attachmentId | Eliminar adjunto |
| DELETE | /orders/:id | Eliminar orden |

---

## Arquitectura Frontend — Estado Actual

### Feature: `apps/frontend/src/features/orders/`

```
orders/
  OrdersPage.tsx              // Pagina principal con lista + tabs
  components/
    OrderList.tsx             // Tabla/lista ordenable con filtros y buscador
    OrderDetail.tsx           // Modal 1200px con pestañas Comercial / Producción
    CommercialSection.tsx     // Seccion presupuesto (items, costeo, estado rapido, PDF)
    ProductionSection.tsx     // Seccion OT (adjuntos, asignaciones, eventos, remito)
    CreateOrderModal.tsx      // Modal de creacion con toggle presupuesto/OT directa
    EditOrderModal.tsx        // Modal de edicion de datos generales
    ApproveDialog.tsx         // Dialog de aprobacion (commitmentDate + priority)
    AttachmentList.tsx        // Lista de adjuntos con thumbnails, visor zoom y drag
    EditQuotationModal.tsx    // Modal de edicion comercial (items, costeo)
```

### AttachmentList — Props clave

```typescript
interface Props {
  orderId: string;
  attachments: OrderAttachment[];
  canUpload: boolean;       // true = muestra boton de subida
  hideDownload?: boolean;   // true = oculta botones de descarga (para operarios)
  onRefresh: () => void;
}
```

### Comportamiento del visor de imágenes

```typescript
// Estado de zoom
const [imgZoom, setImgZoom] = useState(1); // 1 = 100%

// El zoom se aplica al WRAPPER, no a la imagen
// La imagen usa: maxWidth: '100%', objectFit: 'contain'
// Esto garantiza proporciones correctas en cualquier nivel de zoom

// Drag-to-pan:
const containerRef = useRef<HTMLDivElement>(null);
const [dragState, setDragState] = useState({
  isDragging: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0
});
// onMouseDown → guarda posicion inicial
// onMouseMove → calcula delta y ajusta scrollLeft/scrollTop del container
// onMouseUp/onMouseLeave → libera drag
```

---

## Modulos y Features Eliminados

### Backend (removidos)
- `apps/backend/src/modules/quotations/`
- `apps/backend/src/modules/work-orders/`

### Frontend (removidos)
- `apps/frontend/src/features/quotations/`
- `apps/frontend/src/features/work-orders/`

### Prisma (removidos)
- Modelos: `Quotation`, `WorkOrder`, `QuotationItem`, `CostingHour`, `WorkOrderAssignment`
- Enums: `QuotationStatus`, `WorkOrderStatus`

---

## Integraciones con otros modulos

- **OperatorPage** (`apps/frontend/src/features/operator/OperatorPage.tsx`):
  - Muestra `AttachmentList` con `canUpload=false` y `hideDownload=true`
  - Los adjuntos se cargan desde `detailQuery.data?.attachments`
  - El modal se llama "Insumos, Notas y Adjuntos"

- **SupervisorPage**: muestra solo ordenes con `productionStatus != null`

- **CalendarPage**: usa `commitmentDate` para eventos de OT y `validUntil` para vencimientos de presupuesto

- **DashboardPage**: KPIs apuntan a `/orders/stats`
