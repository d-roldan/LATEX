import { api } from '../../../shared/api/http';

// ── Types ──────────────────────────────────────────────────────────────────

export type CommercialStatus = 'BORRADOR' | 'ENVIADO' | 'APROBADO' | 'RECHAZADO' | 'VENCIDO';
export type ProductionStatus =
  | 'PENDIENTE'
  | 'PLANIFICADA'
  | 'EN_PROCESO'
  | 'PAUSADA'
  | 'FINALIZADA'
  | 'ENTREGADA'
  | 'CANCELADA'
  | 'RETRABAJO';
export type OrderStageStatus =
  | 'BLOQUEADA'
  | 'DISPONIBLE'
  | 'EN_PROCESO'
  | 'PAUSADA'
  | 'COMPLETADA'
  | 'RETRABAJO'
  | 'CANCELADA';

export interface OrderItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  estimatedUnitCost: number;
  estimatedHoursMin?: number;
  position: number;
}

export interface OrderCostingHour {
  id: string;
  label: string;
  hours: number;
  ratePerHour: number;
  position: number;
}

export interface OrderAssignment {
  id: string;
  orderId: string;
  resourceId: string;
  userId?: string;
  assignedAt: string;
  unassignedAt?: string | null;
  resource: { id: string; name: string; type: string };
  user?: { id: string; fullName: string; role: string } | null;
  orderStageId?: string | null;
}

export interface OrderStage {
  id: string;
  orderId: string;
  code: string;
  name: string;
  description?: string | null;
  position: number;
  weight: number;
  status: OrderStageStatus;
  estimatedTimeMin: number;
  startedAt?: string | null;
  completedAt?: string | null;
  isQualityGate?: boolean;
  isDeliveryGate?: boolean;
  dependencies: Array<{
    id: string;
    dependsOnStage: Pick<OrderStage, 'id' | 'code' | 'name' | 'status'>;
  }>;
  assignments: OrderAssignment[];
}

export interface OrderAttachment {
  id: string;
  orderId: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes?: number;
  isInternal: boolean;
  uploadedAt: string;
}

export interface OperationLog {
  id: string;
  eventType: string;
  eventAt: string;
  note?: string;
  pauseReason?: string;
  user?: { id: string; fullName: string; role: string } | null;
  resource?: { id: string; name: string } | null;
}

export interface MaterialConsumption {
  id: string;
  materialId: string;
  quantity: number;
  unitCostSnapshot: number;
  note?: string;
  consumedAt: string;
  orderStageId?: string | null;
  material?: { id: string; name: string; unit: string } | null;
  createdByUser?: { id: string; fullName: string } | null;
}

export interface Order {
  id: string;
  companyId: string;
  clientId: string;
  code: string;
  title: string;
  description: string;
  purchaseOrderNumber?: string | null;
  // Commercial
  commercialStatus?: CommercialStatus | null;
  validUntil?: string | null;
  deliveryTimeDays?: number | null;
  approvedAt?: string | null;
  estimatedMaterials?: string | null;
  // Production
  productionStatus?: ProductionStatus | null;
  priority: number;
  plannedDate?: string | null;
  commitmentDate?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  deliveredAt?: string | null;
  closedAt?: string | null;
  closedByUserId?: string | null;
  deliveryChecklist?: string | null;
  deliveryNote?: string | null;
  notes?: string | null;
  isSigned: boolean;
  dashboardUrl?: string | null;
  serialNumber?: string | null;
  progressPct?: number;
  // Shared
  estimatedTimeMin: number;
  estimatedCost: number;
  attachmentUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  // Relations
  client: { id: string; name: string; email?: string; phone?: string };
  items?: OrderItem[];
  costingHours?: OrderCostingHour[];
  assignments?: OrderAssignment[];
  operationLogs?: OperationLog[];
  materialConsumptions?: MaterialConsumption[];
  attachments?: OrderAttachment[];
  stages?: OrderStage[];
  cabinModelRevision?: {
    id: string;
    version: number;
    cabinModel: { id: string; code: string; name: string };
  } | null;
}

export interface OrderStats {
  total: number;
  commercial: Record<CommercialStatus, number>;
  production: Record<ProductionStatus, number>;
  pendingQuotations: number;
}

// ── List & Detail ──────────────────────────────────────────────────────────

export interface ListOrdersParams {
  tab?: 'quotations' | 'production' | 'closed' | 'noPurchaseOrder';
  commercialStatus?: CommercialStatus;
  productionStatus?: ProductionStatus;
  clientId?: string;
  search?: string;
  noPurchaseOrder?: boolean;
  assignedToMe?: boolean;
}

export async function listOrders(params: ListOrdersParams = {}): Promise<Order[]> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  });
  const res = await api.get(`/orders?${qs}`);
  return res.data;
}

export async function getOrderStats(): Promise<OrderStats> {
  const res = await api.get('/orders/stats');
  return res.data;
}

export async function getOrder(id: string): Promise<Order> {
  const res = await api.get(`/orders/${id}`);
  return res.data;
}

// ── Create / Update ────────────────────────────────────────────────────────

export interface CreateOrderItemInput {
  description: string;
  quantity: number;
  unit: string;
  estimatedUnitCost: number;
  estimatedHoursMin?: number;
}

export interface CreateCostingHourInput {
  label: string;
  hours: number;
  ratePerHour: number;
}

export interface CreateOrderDto {
  type: 'quotation' | 'direct';
  clientId: string;
  title: string;
  description: string;
  purchaseOrderNumber?: string;
  estimatedTimeMin: number;
  estimatedCost: number;
  estimatedMaterials?: string;
  // Quotation fields
  commercialStatus?: CommercialStatus;
  validUntil?: string;
  deliveryTimeDays?: number;
  items?: CreateOrderItemInput[];
  costingHours?: CreateCostingHourInput[];
  // Campos de OP directa
  priority?: number;
  plannedDate?: string;
  commitmentDate?: string;
  notes?: string;
  dashboardUrl?: string;
  cabinModelRevisionId?: string;
  serialNumber?: string;
  stageAssignments?: Array<{ stageCode: string; userIds: string[] }>;
}

export async function createOrder(dto: CreateOrderDto): Promise<Order> {
  const res = await api.post('/orders', dto);
  return res.data;
}

export interface UpdateOrderDto {
  clientId?: string;
  title?: string;
  description?: string;
  purchaseOrderNumber?: string;
  estimatedTimeMin?: number;
  estimatedCost?: number;
  estimatedMaterials?: string;
  validUntil?: string | null;
  deliveryTimeDays?: number | null;
  priority?: number;
  plannedDate?: string;
  commitmentDate?: string;
  notes?: string;
  dashboardUrl?: string;
  items?: CreateOrderItemInput[];
  costingHours?: CreateCostingHourInput[];
}

export async function updateOrder(id: string, dto: UpdateOrderDto): Promise<Order> {
  const res = await api.patch(`/orders/${id}`, dto);
  return res.data;
}

// ── Status changes ─────────────────────────────────────────────────────────

export async function updateCommercialStatus(
  id: string,
  status: CommercialStatus
): Promise<Order> {
  const res = await api.patch(`/orders/${id}/commercial-status`, { status });
  return res.data;
}

export async function updateProductionStatus(
  id: string,
  status: ProductionStatus,
  note?: string
): Promise<Order> {
  const res = await api.patch(`/orders/${id}/production-status`, { status, note });
  return res.data;
}

export async function updateStageStatus(
  orderId: string,
  stageId: string,
  status: OrderStageStatus,
  note?: string
): Promise<Order> {
  const res = await api.patch(`/orders/${orderId}/stages/${stageId}/status`, { status, note });
  return res.data;
}

export async function rejectQualityControl(
  orderId: string,
  stageId: string,
  reworkStageId: string,
  note?: string
): Promise<Order> {
  const res = await api.post(`/orders/${orderId}/stages/${stageId}/reject`, { reworkStageId, note });
  return res.data;
}

export async function approveOrder(
  id: string,
  commitmentDate?: string,
  priority?: number,
  cabinModelRevisionId?: string
): Promise<Order> {
  const res = await api.post(`/orders/${id}/approve`, { commitmentDate, priority, cabinModelRevisionId });
  return res.data;
}

// ── Assignments ────────────────────────────────────────────────────────────

export async function assignToOrder(
  orderId: string,
  resourceId: string,
  userId?: string,
  orderStageId?: string
): Promise<OrderAssignment> {
  const res = await api.post(`/orders/${orderId}/assignments`, { resourceId, userId, orderStageId });
  return res.data;
}

export async function updateAssignment(
  orderId: string,
  assignmentId: string,
  dto: { resourceId?: string; userId?: string; orderStageId?: string }
): Promise<OrderAssignment> {
  const res = await api.patch(`/orders/${orderId}/assignments/${assignmentId}`, dto);
  return res.data;
}

export async function deleteAssignment(
  orderId: string,
  assignmentId: string
): Promise<{ message: string }> {
  const res = await api.delete(`/orders/${orderId}/assignments/${assignmentId}`);
  return res.data;
}

// ── Events ─────────────────────────────────────────────────────────────────

export async function addOrderEvent(
  orderId: string,
  eventType: string,
  note?: string,
  resourceId?: string,
  pauseReason?: string
): Promise<OperationLog> {
  const res = await api.post(`/orders/${orderId}/events`, { eventType, note, resourceId, pauseReason });
  return res.data;
}

// ── Consumptions ───────────────────────────────────────────────────────────

export async function addConsumption(
  orderId: string,
  materialId: string,
  quantity: number,
  note?: string,
  orderStageId?: string
): Promise<MaterialConsumption> {
  const res = await api.post(`/orders/${orderId}/consumptions`, { materialId, quantity, note, orderStageId });
  return res.data;
}

export async function updateConsumption(
  orderId: string,
  consumptionId: string,
  dto: { materialId?: string; quantity?: number; note?: string }
): Promise<MaterialConsumption> {
  const res = await api.patch(`/orders/${orderId}/consumptions/${consumptionId}`, dto);
  return res.data;
}

export async function deleteConsumption(
  orderId: string,
  consumptionId: string
): Promise<{ message: string }> {
  const res = await api.delete(`/orders/${orderId}/consumptions/${consumptionId}`);
  return res.data;
}

// ── Delivery ───────────────────────────────────────────────────────────────

export async function closeDelivery(
  orderId: string,
  dto: {
    deliveryChecklist?: string;
    deliveryNote?: string;
    deliveredAt?: string;
    isSigned?: boolean;
  }
): Promise<Order> {
  const res = await api.post(`/orders/${orderId}/close-delivery`, dto);
  return res.data;
}

// ── Attachments ────────────────────────────────────────────────────────────

export async function uploadAttachment(
  orderId: string,
  file: File,
  isInternal = false
): Promise<OrderAttachment> {
  const form = new FormData();
  form.append('file', file);
  form.append('isInternal', String(isInternal));
  const res = await api.post(`/orders/${orderId}/attachments`, form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data;
}

export async function deleteAttachment(
  orderId: string,
  attachmentId: string
): Promise<{ message: string }> {
  const res = await api.delete(`/orders/${orderId}/attachments/${attachmentId}`);
  return res.data;
}

export async function updateAttachment(
  orderId: string,
  attachmentId: string,
  fileName: string
): Promise<OrderAttachment> {
  const res = await api.patch(`/orders/${orderId}/attachments/${attachmentId}`, { fileName });
  return res.data;
}

export async function fetchAttachmentFile(orderId: string, attachmentId: string): Promise<Blob> {
  const res = await api.get(`/orders/${orderId}/attachments/${attachmentId}/download`, {
    responseType: 'blob'
  });
  return res.data;
}

// ── Delete order ───────────────────────────────────────────────────────────

export async function deleteOrder(id: string): Promise<{ message: string }> {
  const res = await api.delete(`/orders/${id}`);
  return res.data;
}
