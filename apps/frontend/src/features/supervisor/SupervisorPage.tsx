import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../shared/api/http';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { Input, Textarea } from '../../shared/ui/Input';
import { Dialog } from '../../shared/ui/Dialog';
import { ArrowRight, CheckCircle2, ChevronDown, CirclePause, Clock3, Factory, UserRound, Wrench } from 'lucide-react';
import { useHighlightTarget } from '../../shared/utils/highlightTarget';

interface WorkOrderSummary {
  id: string;
  code: string;
  title: string;
  productionStatus: string;
  priority: number;
  commitmentDate?: string | null;
  startedAt?: string | null;
  client: { name: string };
  progressPct?: number;
  cabinModelRevision?: { cabinModel: { code: string; name: string } } | null;
  stages: Array<{
    id: string;
    name: string;
    status: string;
    isQualityGate?: boolean;
    assignments: Array<{ id: string; user?: { id: string; fullName: string } | null }>;
  }>;
  assignments: Array<{
    id: string;
    resource: { name: string; type: string };
    user?: { id: string; fullName: string } | null;
  }>;
  operationLogs: Array<{
    id: string;
    eventType: string;
    eventAt: string;
    user?: { fullName: string } | null;
  }>;
}

interface OperatorUser {
  id: string;
  fullName: string;
}

interface WorkOrderHistory {
  id: string;
  code: string;
  title: string;
  description: string;
  productionStatus: string;
  progressPct?: number;
  serialNumber?: string | null;
  createdAt: string;
  startedAt?: string | null;
  commitmentDate?: string | null;
  client: { name: string };
  createdByUser?: { id: string; fullName: string; role: string } | null;
  cabinModelRevision?: { cabinModel: { code: string; name: string } } | null;
  assignments: Array<{
    id: string;
    assignedAt: string;
    unassignedAt?: string | null;
    resource: { name: string; type: string };
    user?: { id: string; fullName: string } | null;
    assignedByUser?: { id: string; fullName: string; role: string } | null;
    orderStage?: { id: string; code: string; name: string } | null;
  }>;
  operationLogs: Array<{
    id: string;
    eventType: string;
    eventAt: string;
    note?: string | null;
    pauseReason?: string | null;
    user?: { fullName: string } | null;
    resource?: { name: string } | null;
    orderStage?: { id: string; code: string; name: string } | null;
  }>;
  materialConsumptions: Array<{
    id: string;
    quantity: number;
    consumedAt: string;
    note?: string | null;
    material?: { name: string; unit: string } | null;
    createdByUser?: { fullName: string } | null;
  }>;
  attachments: Array<{ id: string; fileName: string; uploadedAt: string }>;
  stages: Array<{
    id: string;
    code: string;
    name: string;
    status: string;
    progressPct: number;
    startedAt?: string | null;
    finishedAt?: string | null;
    assignments: Array<{ id: string; user?: { fullName: string } | null; resource: { name: string } }>;
    workSessions: Array<{
      id: string;
      startedAt: string;
      endedAt?: string | null;
      note?: string | null;
      user: { fullName: string };
      resource?: { name: string } | null;
    }>;
  }>;
}

interface HistoryEntry {
  id: string;
  at: string;
  kind: 'creation' | 'assignment' | 'event' | 'paused' | 'material';
  title: string;
  detail?: string;
  actor?: string;
  stage?: string;
}

const STATUS_LABEL: Record<string, string> = {
  PENDIENTE: 'No iniciada', PLANIFICADA: 'No iniciada', EN_PROCESO: 'En proceso',
  PAUSADA: 'Pausada', FINALIZADA: 'Finalizada', ENTREGADA: 'Entregada', CANCELADA: 'Cancelada',
  RETRABAJO: 'Retrabajo'
};

const STATUS_COLOR: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'primary'> = {
  PENDIENTE: 'default', PLANIFICADA: 'default', EN_PROCESO: 'warning',
  PAUSADA: 'destructive', FINALIZADA: 'success', ENTREGADA: 'success', CANCELADA: 'default',
  RETRABAJO: 'warning'
};

function isDelayed(commitmentDate?: string | null): boolean {
  if (!commitmentDate) return false;
  return new Date(commitmentDate) < new Date();
}

function getPriorityLabel(priority: number): string {
  if (priority === 5) return 'Urgente';
  if (priority === 4) return 'Alta';
  if (priority === 3) return 'Normal';
  if (priority === 2) return 'Baja';
  return 'Mínima';
}

function getPriorityClass(priority: number): string {
  if (priority === 5) return 'is-high';
  if (priority === 4) return 'is-medium-high';
  if (priority === 3) return 'is-normal';
  return 'is-low';
}

function formatHistoryDate(value: string) {
  return new Date(value).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function eventLabel(eventType: string) {
  const labels: Record<string, string> = {
    OT_CREADA: 'Casilla creada',
    ASIGNADO: 'Asignación registrada',
    INICIO: 'Trabajo iniciado',
    PAUSA: 'Trabajo pausado',
    REANUDACION: 'Trabajo reanudado',
    FINALIZACION: 'Trabajo completado',
    CAMBIO_ESTADO: 'Estado actualizado',
    MATERIAL_CONSUMIDO: 'Material consumido',
    NOTA: 'Observación registrada'
  };
  return labels[eventType] ?? eventType.replace(/_/g, ' ');
}

export function SupervisorPage() {
  const location = useLocation();
  const navigate = useNavigate();
  // Se guarda en estado (no se lee location.state directo) porque hay que poder
  // limpiarlo enseguida sin perder el valor, y volver a dispararlo aunque el usuario
  // ya esté en /supervisor cuando llega la notificación (mismo path, sin remount).
  const [highlightRequest, setHighlightRequest] = useState<{ orderId: string; nonce: string } | null>(null);

  useEffect(() => {
    const incoming = (location.state as { highlightOrderId?: string } | null)?.highlightOrderId;
    if (!incoming) return;
    setHighlightRequest({ orderId: incoming, nonce: location.key });
    navigate(location.pathname, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  const ordersQuery = useQuery({
    queryKey: ['supervisor-orders'],
    queryFn: async () => {
      const response = await api.get<WorkOrderSummary[]>('/orders', { params: { tab: 'production' } });
      return response.data;
    },
    refetchInterval: 30000 // actualiza cada 30 segundos
  });

  useHighlightTarget(
    highlightRequest ? `quality-order-${highlightRequest.orderId}` : null,
    highlightRequest
  );

  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approveMessage, setApproveMessage] = useState<{ id: string; type: 'success' | 'error'; text: string } | null>(null);
  const [approveModalOrder, setApproveModalOrder] = useState<WorkOrderSummary | null>(null);
  const [approveNote, setApproveNote] = useState('');
  const [approveRating, setApproveRating] = useState<number>(3);
  const [runningWorkOpen, setRunningWorkOpen] = useState(false);
  const [historyOrderId, setHistoryOrderId] = useState<string | null>(null);
  const [expandedHistoryEntryId, setExpandedHistoryEntryId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const historyQuery = useQuery({
    queryKey: ['supervisor-order-history', historyOrderId],
    queryFn: async () => (await api.get<WorkOrderHistory>(`/orders/${historyOrderId}`)).data,
    enabled: Boolean(historyOrderId)
  });
  const operatorsQuery = useQuery({
    queryKey: ['supervisor-operators'],
    queryFn: async () => (await api.get<OperatorUser[]>('/users', { params: { role: 'OPERARIO', active: 'true' } })).data,
    refetchInterval: 30000
  });

  const historyEntries = useMemo<HistoryEntry[]>(() => {
    const order = historyQuery.data;
    if (!order) return [];
    const entries: HistoryEntry[] = [{
      id: `created-${order.id}`,
      at: order.createdAt,
      kind: 'creation',
      title: 'Orden de Producción creada',
      detail: `${order.cabinModelRevision?.cabinModel.code ?? 'Casilla'} para ${order.client.name}`,
      actor: order.createdByUser?.fullName ?? 'Usuario no registrado'
    }];
    order.assignments.forEach(assignment => entries.push({
      id: `assignment-${assignment.id}`,
      at: assignment.assignedAt,
      kind: 'assignment',
      title: `Se asignó a ${assignment.user?.fullName ?? assignment.resource.name}`,
      detail: assignment.unassignedAt ? `Asignación finalizada el ${formatHistoryDate(assignment.unassignedAt)}` : 'Asignación activa',
      actor: assignment.assignedByUser?.fullName ?? 'Responsable no registrado',
      stage: assignment.orderStage?.name
    }));
    order.operationLogs
      // ASIGNADO ya se muestra a partir de order.assignments; mantenerlo acá duplica la entrada
      .filter(log => log.eventType !== 'ASIGNADO')
      .forEach(log => entries.push({
        id: `event-${log.id}`,
        at: log.eventAt,
        kind: log.eventType === 'PAUSA' ? 'paused' : 'event',
        title: eventLabel(log.eventType),
        detail: log.pauseReason || log.note || undefined,
        actor: log.user?.fullName ?? log.resource?.name ?? 'Sistema',
        stage: log.orderStage?.name
      }));
    order.materialConsumptions.forEach(consumption => entries.push({
      id: `material-${consumption.id}`,
      at: consumption.consumedAt,
      kind: 'material',
      title: `Consumo: ${consumption.material?.name ?? 'Material'}`,
      detail: `${Number(consumption.quantity).toLocaleString('es-AR')} ${consumption.material?.unit ?? ''}${consumption.note ? ` · ${consumption.note}` : ''}`,
      actor: consumption.createdByUser?.fullName ?? 'Usuario no registrado'
    }));
    return entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [historyQuery.data]);

  const getQualityStage = (order: WorkOrderSummary) =>
    order.stages.find((s) => s.isQualityGate && ['DISPONIBLE', 'EN_PROCESO', 'PAUSADA'].includes(s.status));

  const [rejectMode, setRejectMode] = useState(false);
  const [reworkStageId, setReworkStageId] = useState('');

  const approveMutation = useMutation({
    mutationFn: async ({ orderId, stageId, note }: { orderId: string; stageId: string; note: string }) => {
      await api.patch(`/orders/${orderId}/stages/${stageId}/status`, { status: 'COMPLETADA', note });
    },
    onSuccess: (_data, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['supervisor-orders'] });
      setApprovingId(null);
      setApproveModalOrder(null);
      setApproveNote('');
      setApproveRating(3);
      setApproveMessage({ id: orderId, type: 'success', text: '✔ Control de calidad aprobado' });
      setTimeout(() => setApproveMessage(null), 3000);
    },
    onError: (err: any, { orderId }) => {
      setApprovingId(null);
      const msg = err?.response?.data?.message;
      setApproveMessage({ id: orderId, type: 'error', text: Array.isArray(msg) ? msg.join(', ') : (msg || 'Error al aprobar') });
      setTimeout(() => setApproveMessage(null), 5000);
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ orderId, stageId, reworkStageId: reworkId, note }: { orderId: string; stageId: string; reworkStageId: string; note: string }) => {
      await api.post(`/orders/${orderId}/stages/${stageId}/reject`, { reworkStageId: reworkId, note });
    },
    onSuccess: (_data, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['supervisor-orders'] });
      setApprovingId(null);
      setApproveModalOrder(null);
      setApproveNote('');
      setRejectMode(false);
      setReworkStageId('');
      setApproveMessage({ id: orderId, type: 'success', text: '⚠ Control de calidad rechazado' });
      setTimeout(() => setApproveMessage(null), 3000);
    },
    onError: (err: any, { orderId }) => {
      setApprovingId(null);
      const msg = err?.response?.data?.message;
      setApproveMessage({ id: orderId, type: 'error', text: Array.isArray(msg) ? msg.join(', ') : (msg || 'Error al rechazar') });
      setTimeout(() => setApproveMessage(null), 5000);
    }
  });

  const handleOpenApproveModal = (order: WorkOrderSummary) => {
    setApproveModalOrder(order);
    setApproveNote('');
    setApproveRating(3);
    setRejectMode(false);
    setReworkStageId('');
  };

  const handleConfirmApprove = () => {
    if (!approveModalOrder) return;
    const qualityStage = getQualityStage(approveModalOrder);
    if (!qualityStage) return;
    const ratingLabel = ['', '⭐ Deficiente', '⭐⭐ Regular', '⭐⭐⭐ Aceptable', '⭐⭐⭐⭐ Bueno', '⭐⭐⭐⭐⭐ Excelente'][approveRating] || '';
    const fullNote = [ratingLabel, approveNote.trim()].filter(Boolean).join(' — ') || 'Aprobado por supervisor';
    setApprovingId(approveModalOrder.id);
    approveMutation.mutate({ orderId: approveModalOrder.id, stageId: qualityStage.id, note: fullNote });
  };

  const handleConfirmReject = () => {
    if (!approveModalOrder || !reworkStageId) return;
    const qualityStage = getQualityStage(approveModalOrder);
    if (!qualityStage) return;
    setApprovingId(approveModalOrder.id);
    rejectMutation.mutate({
      orderId: approveModalOrder.id,
      stageId: qualityStage.id,
      reworkStageId,
      note: approveNote.trim() || undefined as unknown as string
    });
  };

  const grouped = useMemo(() => {
    if (!ordersQuery.data) return { active: [], pending: [], delayed: [], awaitingApproval: [] };
    const active = ordersQuery.data.filter((o) => ['EN_PROCESO', 'PAUSADA'].includes(o.productionStatus));
    const awaitingApproval = ordersQuery.data.filter((o) => getQualityStage(o));
    const delayed = ordersQuery.data.filter(
      (o) => !['FINALIZADA', 'ENTREGADA', 'CANCELADA'].includes(o.productionStatus) && isDelayed(o.commitmentDate)
    );
    const pending = ordersQuery.data
      .filter((o) => ['PENDIENTE', 'PLANIFICADA'].includes(o.productionStatus) && !isDelayed(o.commitmentDate))
      .sort((a, b) => b.priority - a.priority);

    return { active, pending, delayed, awaitingApproval };
  }, [ordersQuery.data]);

  const runningOrders = useMemo(() => (ordersQuery.data ?? []).flatMap((order) => {
    const stages = order.stages
      .filter((stage) => stage.status === 'EN_PROCESO')
      .map((stage) => ({
        id: stage.id,
        name: stage.name,
        people: Array.from(new Set(
          stage.assignments
            .map((assignment) => assignment.user?.fullName)
            .filter((name): name is string => Boolean(name))
        ))
      }));

    if (stages.length === 0) return [];

    return [{
      id: order.id,
      code: order.code,
      title: order.title,
      clientName: order.client.name,
      modelCode: order.cabinModelRevision?.cabinModel.code ?? 'Sin modelo',
      progress: Math.round(Number(order.progressPct ?? 0)),
      stages
    }];
  }), [ordersQuery.data]);

  const runningStageCount = runningOrders.reduce((total, order) => total + order.stages.length, 0);
  const runningOperators = useMemo(() => {
    const byOperator = new Map<string, {
      id: string;
      name: string;
      work: Array<{
        key: string;
        stageName: string;
        orderCode: string;
        orderTitle: string;
        modelCode: string;
        clientName: string;
      }>;
    }>();

    (ordersQuery.data ?? []).forEach((order) => {
      order.stages
        .filter((stage) => stage.status === 'EN_PROCESO')
        .forEach((stage) => stage.assignments.forEach((assignment) => {
          if (!assignment.user) return;
          const operator = byOperator.get(assignment.user.id) ?? {
            id: assignment.user.id,
            name: assignment.user.fullName,
            work: []
          };
          const key = `${stage.id}-${assignment.user.id}`;
          if (!operator.work.some((item) => item.key === key)) {
            operator.work.push({
              key,
              stageName: stage.name,
              orderCode: order.code,
              orderTitle: order.title,
              modelCode: order.cabinModelRevision?.cabinModel.code ?? 'Sin modelo',
              clientName: order.client.name
            });
          }
          byOperator.set(assignment.user.id, operator);
        }));
    });

    return Array.from(byOperator.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [ordersQuery.data]);

  const runningAssignmentCount = runningOperators.reduce((total, operator) => total + operator.work.length, 0);
  const unassignedRunningStages = runningOrders.flatMap((order) => order.stages
    .filter((stage) => stage.people.length === 0)
    .map((stage) => ({
      key: stage.id,
      stageName: stage.name,
      orderCode: order.code,
      orderTitle: order.title,
      modelCode: order.modelCode
    }))
  );

  const idleAssignedOperators = useMemo(() => {
    const runningOperatorIds = new Set<string>();
    const byOperator = new Map<string, {
      id: string;
      name: string;
      work: Array<{
        key: string;
        stageName: string;
        status: string;
        orderCode: string;
        orderTitle: string;
        modelCode: string;
        clientName: string;
      }>;
    }>();
    const availableStatuses = new Set(['DISPONIBLE', 'PAUSADA', 'RETRABAJO']);

    (ordersQuery.data ?? []).forEach((order) => order.stages.forEach((stage) => {
      stage.assignments.forEach((assignment) => {
        if (!assignment.user) return;
        if (stage.status === 'EN_PROCESO') {
          runningOperatorIds.add(assignment.user.id);
          return;
        }
        if (!availableStatuses.has(stage.status)) return;

        const operator = byOperator.get(assignment.user.id) ?? {
          id: assignment.user.id,
          name: assignment.user.fullName,
          work: []
        };
        const key = `${stage.id}-${assignment.user.id}`;
        if (!operator.work.some((item) => item.key === key)) {
          operator.work.push({
            key,
            stageName: stage.name,
            status: stage.status,
            orderCode: order.code,
            orderTitle: order.title,
            modelCode: order.cabinModelRevision?.cabinModel.code ?? 'Sin modelo',
            clientName: order.client.name
          });
        }
        byOperator.set(assignment.user.id, operator);
      });
    }));

    return Array.from(byOperator.values())
      .filter((operator) => !runningOperatorIds.has(operator.id) && operator.work.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [ordersQuery.data]);

  const operatorCapacity = useMemo(() => {
    const operators = operatorsQuery.data ?? [];
    const workByOperator = new Map<string, Array<{ orderCode: string; stageName: string; status: string }>>();

    (ordersQuery.data ?? [])
      .filter(order => !['ENTREGADA', 'CANCELADA'].includes(order.productionStatus))
      .forEach(order => order.stages.forEach(stage => {
        stage.assignments.forEach(assignment => {
          if (!assignment.user) return;
          const work = workByOperator.get(assignment.user.id) ?? [];
          work.push({ orderCode: order.code, stageName: stage.name, status: stage.status });
          workByOperator.set(assignment.user.id, work);
        });
      }));

    const actionableStatuses = new Set(['DISPONIBLE', 'PAUSADA', 'RETRABAJO', 'EN_PROCESO']);
    const waitingStatuses = new Set(['DISPONIBLE', 'PAUSADA', 'RETRABAJO']);
    const withoutAvailableWork = operators.filter(operator =>
      !(workByOperator.get(operator.id) ?? []).some(work => actionableStatuses.has(work.status))
    );
    const waitingToStart = operators.flatMap(operator => {
      const work = workByOperator.get(operator.id) ?? [];
      const hasRunningWork = work.some(item => item.status === 'EN_PROCESO');
      const pendingWork = work.filter(item => waitingStatuses.has(item.status));
      return !hasRunningWork && pendingWork.length ? [{ ...operator, work: pendingWork }] : [];
    });

    return { withoutAvailableWork, waitingToStart };
  }, [operatorsQuery.data, ordersQuery.data]);

  const operationalAttention = useMemo(() => {
    const items: Array<{ id: string; type: 'paused' | 'blocked' | 'unassigned'; title: string; detail: string }> = [];
    (ordersQuery.data ?? [])
      .filter(order => !['ENTREGADA', 'CANCELADA'].includes(order.productionStatus))
      .forEach(order => order.stages.forEach(stage => {
        const names = stage.assignments.map(assignment => assignment.user?.fullName).filter(Boolean).join(', ');
        if (stage.status === 'PAUSADA') {
          items.push({ id: `paused-${stage.id}`, type: 'paused', title: `${stage.name} pausada`, detail: `${order.code} · ${names || 'Sin responsable'}` });
        } else if (stage.status === 'BLOQUEADA' && names) {
          items.push({ id: `blocked-${stage.id}`, type: 'blocked', title: `${stage.name} bloqueada`, detail: `${order.code} · ${names}` });
        } else if (['DISPONIBLE', 'RETRABAJO'].includes(stage.status) && !names) {
          items.push({ id: `unassigned-${stage.id}`, type: 'unassigned', title: `${stage.name} sin responsable`, detail: order.code });
        }
      }));
    return items;
  }, [ordersQuery.data]);

  return (
    <div className="stack-lg page-enter supervisor-page">

      {/* ── HERO ─────────────────────────────────────────── */}
      <header className="page-hero panel stagger-1">
        <div className="page-hero__left">
          <p className="eyebrow" style={{ color: 'var(--accent-cyan)' }}>🔭 CONTROL DE PRODUCCIÓN</p>
          <h2 className="page-hero__title">Centro de Control</h2>
          <p className="page-hero__sub">
            Estado en tiempo real de la planta · Se actualiza automáticamente cada 30 segundos.
          </p>
        </div>
        <div className="page-hero__actions">
          {grouped.awaitingApproval.length > 0 && (
            <span className="dash-alert-badge--critical" style={{ background: 'var(--accent-orange)', color: 'var(--color-on-status)' }}>
              ✅ {grouped.awaitingApproval.length} OP para aprobar
            </span>
          )}
          {grouped.delayed.length > 0 && (
            <span className="dash-alert-badge--critical">
              ⚠️ {grouped.delayed.length} OP atrasada{grouped.delayed.length > 1 ? 's' : ''}
            </span>
          )}
          <span className="dash-period-badge">
            {grouped.active.length} en ejecución
          </span>
        </div>
      </header>

      {/* ── FILA RESUMEN ──────────────────────────────────── */}
      <section className="stagger-2">
        <div className="dash-ops-row supervisor-capacity-kpis">
          <button
            type="button"
            className="dash-kpi-card dash-kpi--cyan supervisor-kpi-button"
            onClick={() => setRunningWorkOpen(true)}
            aria-haspopup="dialog"
            aria-label={`Ver detalle de ${runningStageCount} etapas en proceso`}
          >
            <div className="dash-kpi-card__icon">⚙️</div>
            <div>
              <p className="dash-kpi-card__label">En proceso</p>
              <p className="dash-kpi-card__val">{runningStageCount}</p>
            </div>
            <span className="supervisor-kpi-button__hint">Ver detalle <ArrowRight size={14} /></span>
          </button>
          <div className="dash-kpi-card dash-kpi--orange">
            <div className="dash-kpi-card__icon">⏸</div>
            <div>
              <p className="dash-kpi-card__label">Pausadas</p>
              <p className="dash-kpi-card__val">{grouped.active.filter((o) => o.productionStatus === 'PAUSADA').length}</p>
            </div>
          </div>
          <div className="dash-kpi-card dash-kpi--red">
            <div className="dash-kpi-card__icon">⏰</div>
            <div>
              <p className="dash-kpi-card__label">Atrasadas</p>
              <p className="dash-kpi-card__val">{grouped.delayed.length}</p>
            </div>
          </div>
          <div className="dash-kpi-card dash-kpi--purple">
            <div className="dash-kpi-card__icon">👷</div>
            <div>
              <p className="dash-kpi-card__label">Operarios sin asignación de trabajo</p>
              <p className="dash-kpi-card__val">{operatorCapacity.withoutAvailableWork.length}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="stagger-2">
        <p className="dash-group-label">Mapa operativo de casillas</p>
        <div className="supervisor-map-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '.75rem' }}>
          {(ordersQuery.data ?? [])
            .filter(order => !['ENTREGADA', 'CANCELADA'].includes(order.productionStatus))
            .map(order => {
              const running = order.stages?.filter(stage => ['EN_PROCESO', 'PAUSADA', 'RETRABAJO'].includes(stage.status)) ?? [];
              const blocked = order.stages?.filter(stage => stage.status === 'BLOQUEADA').length ?? 0;
              const progress = Math.round(Number(order.progressPct ?? 0));
              return (
                <button
                  key={order.id}
                  type="button"
                  className="panel supervisor-map-card"
                  onClick={() => setHistoryOrderId(order.id)}
                  aria-label={`Ver seguimiento histórico de ${order.code}`}
                  style={{ width: '100%', textAlign: 'left', color: 'inherit', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.75rem' }}>
                    <div>
                      <span className="dash-order-code">{order.code}</span>
                      <strong
                        className="supervisor-map-card__title"
                        title={order.title}
                      >
                        {order.title}
                      </strong>
                      <span style={{ display: 'block', marginTop: '.15rem', fontSize: '.72rem', color: 'var(--ink-muted)' }}>
                        {order.cabinModelRevision?.cabinModel.code ?? 'Sin modelo'} · {order.client.name}
                      </span>
                    </div>
                    <strong style={{ color: 'var(--success)' }}>{progress}%</strong>
                  </div>
                  <div style={{ height: 7, background: 'var(--border)', borderRadius: 999, overflow: 'hidden', margin: '.8rem 0' }}>
                    <div style={{ width: `${progress}%`, height: '100%', background: 'var(--success)' }} />
                  </div>
                  <div style={{ display: 'grid', gap: '.35rem' }}>
                    {running.length ? running.map(stage => (
                      <div key={stage.id} style={{ padding: '.45rem .55rem', borderRadius: '.45rem', background: 'color-mix(in srgb, var(--success) 8%, var(--background))', fontSize: '.78rem' }}>
                        <strong>{stage.name}</strong> · {stage.status === 'PAUSADA' ? 'Pausada' : 'En proceso'}
                        <div style={{ color: 'var(--ink-muted)', marginTop: '.15rem' }}>
                          {stage.assignments.map(assignment => assignment.user?.fullName).filter(Boolean).join(', ') || 'Sin operario'}
                        </div>
                      </div>
                    )) : <span style={{ fontSize: '.78rem', color: 'var(--ink-muted)' }}>Sin etapas en ejecución</span>}
                    <span style={{ fontSize: '.72rem', color: 'var(--ink-muted)' }}>{blocked} etapas bloqueadas por dependencias</span>
                  </div>
                </button>
              );
            })}
        </div>
      </section>

      {/* ── PENDIENTES DE APROBACIÓN ─────────────────────── */}
      {grouped.awaitingApproval.length > 0 && (
        <section className="stagger-2">
          <p className="dash-group-label" style={{ color: 'var(--accent-orange)' }}>✅ Control de calidad pendiente — las terminaciones están listas para tu revisión</p>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {grouped.awaitingApproval.map((order) => (
              <div
                key={order.id}
                id={`quality-order-${order.id}`}
                className="supervisor-quality-card"
                style={{
                  background: 'var(--panel)',
                  border: '2px solid var(--accent-orange)',
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: '1rem',
                  alignItems: 'center'
                }}
              >
                <div style={{ display: 'grid', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span className="dash-order-code">{order.code}</span>
                    <Badge variant="warning">⏳ Control de calidad</Badge>
                    {isDelayed(order.commitmentDate) && <Badge variant="destructive">⏰ Atrasada</Badge>}
                  </div>
                  <p style={{ fontWeight: 600, margin: 0, fontSize: '0.95rem' }}>{order.title}</p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--ink-soft)' }}>
                    Cliente: <strong>{order.client.name}</strong>
                    {order.commitmentDate && (
                      <> · Compromiso: <strong>{new Date(order.commitmentDate).toLocaleDateString('es-AR')}</strong></>
                    )}
                  </p>
                  {order.assignments.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.25rem' }}>
                      {order.assignments.map((a) => (
                        <span
                          key={a.id}
                          style={{
                            fontSize: '0.78rem', background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
                            color: 'var(--primary)', padding: '0.2rem 0.5rem', borderRadius: '0.3rem'
                          }}
                        >
                          {a.resource.type === 'HUMANO' ? '👷' : '🔧'} {a.user?.fullName ?? a.resource.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="supervisor-quality-actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-end' }}>
                  <Button
                    onClick={() => handleOpenApproveModal(order)}
                    disabled={approvingId === order.id}
                    style={{ background: 'var(--success)', color: 'white', minWidth: '170px' }}
                  >
                    {approvingId === order.id ? '⏳ Procesando...' : '🔎 Revisar control de calidad'}
                  </Button>
                  {approveMessage?.id === order.id && (
                    <span style={{ fontSize: '0.75rem', color: approveMessage.type === 'success' ? 'var(--success)' : 'var(--destructive)' }}>
                      {approveMessage.text}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="two-col-grid stagger-2">

        {/* ── EXCEPCIONES OPERATIVAS ───────────────────────── */}
        <section>
          <p className="dash-group-label">⚠ Atención operativa</p>
          {operationalAttention.length === 0 ? (
            <Card>
              <div className="empty-state">
                <span className="empty-state__icon">✓</span>
                <p>Sin pausas, bloqueos asignados ni etapas disponibles sin responsable.</p>
              </div>
            </Card>
          ) : (
            <Card>
              <ul className="supervisor-attention-list">
                {operationalAttention.map(item => (
                  <li key={item.id} className={`supervisor-attention-item supervisor-attention-item--${item.type}`}>
                    <span className="supervisor-attention-item__signal" aria-hidden="true" />
                    <div><strong>{item.title}</strong><small>{item.detail}</small></div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>

        {/* ── OPERARIOS Y COLA ─────────────────────────────── */}
        <div className="supervisor-secondary-stack" style={{ display: 'grid', gap: '1.5rem', alignContent: 'start' }}>

          {/* Operarios con trabajo disponible pendiente */}
          <section>
            <p className="dash-group-label">👷 Trabajo pendiente de iniciar</p>
            <Card>
              {operatorCapacity.waitingToStart.length === 0 ? (
                <p style={{ color: 'var(--ink-soft)', fontSize: '0.88rem', textAlign: 'center', padding: '1rem 0' }}>
                  Todos los operarios con trabajo disponible ya tienen una etapa en curso.
                </p>
              ) : (
                <ul className="supervisor-waiting-list">
                  {operatorCapacity.waitingToStart.map((operator) => (
                    <li key={operator.id}>
                      <span className="supervisor-operator-avatar">{operator.fullName.charAt(0)}</span>
                      <div>
                        <strong>{operator.fullName}</strong>
                        <small>{operator.work.map(item => `${item.orderCode} · ${item.stageName}`).join(' · ')}</small>
                      </div>
                      <Badge variant="warning">{operator.work.length} pendiente{operator.work.length === 1 ? '' : 's'}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>

          {/* Cola de pendientes */}
          <section>
            <p className="dash-group-label">📋 Próximas órdenes por prioridad</p>
            <Card>
              {grouped.pending.length === 0 ? (
                <p style={{ color: 'var(--ink-soft)', fontSize: '0.88rem', textAlign: 'center', padding: '1rem 0' }}>Sin órdenes pendientes.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.5rem' }}>
                  {grouped.pending.slice(0, 10).map((order) => (
                    <li key={order.id} className="supervisor-queue-item">
                      <span className="supervisor-queue-item__order">
                        <span className="dash-order-code" style={{ fontSize: '0.78rem' }}>{order.code}</span>
                        <span>{order.title}</span>
                      </span>
                      <span className={`supervisor-priority ${getPriorityClass(order.priority)}`}>
                        {getPriorityLabel(order.priority)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {grouped.pending.length > 0 && (
                <div className="supervisor-queue-footer">
                  <span>Mostrando {Math.min(10, grouped.pending.length)} de {grouped.pending.length}</span>
                  <Link to="/orders">Ver lista completa <ArrowRight size={13} /></Link>
                </div>
              )}
            </Card>
          </section>

        </div>
      </div>

      {/* ── OTs ATRASADAS ────────────────────────────────── */}
      {grouped.delayed.length > 0 && (
        <section className="stagger-3">
          <p className="dash-group-label">🚨 Órdenes atrasadas — Requieren atención</p>
          <div className="premium-table-wrap">
            <table className="premium-table" id="delayed-orders-table">
              <thead>
                <tr>
                  <th>OP</th>
                  <th>Título</th>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Vencimiento</th>
                  <th>Días de atraso</th>
                </tr>
              </thead>
              <tbody>
                {grouped.delayed.map((order) => {
                  const daysLate = order.commitmentDate
                    ? Math.ceil((new Date().getTime() - new Date(order.commitmentDate).getTime()) / (1000 * 60 * 60 * 24))
                    : 0;
                  return (
                    <tr key={order.id}>
                      <td><span className="dash-order-code">{order.code}</span></td>
                      <td className="strong-cell">{order.title}</td>
                      <td>{order.client.name}</td>
                      <td><Badge variant={STATUS_COLOR[order.productionStatus] ?? 'default'}>{STATUS_LABEL[order.productionStatus]}</Badge></td>
                      <td style={{ color: 'var(--destructive)', fontSize: '0.85rem' }}>
                        {order.commitmentDate ? new Date(order.commitmentDate).toLocaleDateString('es-AR') : '—'}
                      </td>
                      <td>
                        <Badge variant="destructive">+{daysLate} día{daysLate !== 1 ? 's' : ''}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Dialog
        open={runningWorkOpen}
        onOpenChange={setRunningWorkOpen}
        title="Operarios trabajando ahora"
        description="Detalle exacto de cada operario, la etapa que está realizando y la casilla correspondiente. Se actualiza automáticamente cada 30 segundos."
        className="running-work-dialog"
      >
        <div className="running-work-content">
          <section className="running-work-overview" aria-label="Resumen de operarios trabajando">
            <div className="running-work-overview__item">
              <UserRound size={18} aria-hidden="true" />
              <strong>{runningOperators.length}</strong>
              <span>Operarios trabajando</span>
            </div>
            <div className="running-work-overview__item">
              <Wrench size={18} aria-hidden="true" />
              <strong>{runningAssignmentCount}</strong>
              <span>Asignaciones activas</span>
            </div>
            <div className="running-work-overview__item running-work-overview__item--waiting">
              <CirclePause size={18} aria-hidden="true" />
              <strong>{idleAssignedOperators.length}</strong>
              <span>Operarios esperando iniciar</span>
            </div>
          </section>

          {ordersQuery.isLoading ? (
            <div className="empty-state running-work-empty"><Clock3 size={22} /> Cargando trabajos en proceso...</div>
          ) : runningStageCount === 0 && idleAssignedOperators.length === 0 ? (
            <div className="empty-state running-work-empty">
              <CheckCircle2 size={24} />
              <strong>No hay actividad ni trabajos disponibles asignados en este momento.</strong>
              <span>Cuando se asigne o inicie una etapa, aparecerá aquí automáticamente.</span>
            </div>
          ) : (
            <div className="running-work-list">
              {runningOperators.length === 0 && (
                <div className="running-work-no-active">
                  <CirclePause size={20} aria-hidden="true" />
                  <div>
                    <strong>Ningún operario está trabajando ahora.</strong>
                    <span>Hay tareas asignadas pendientes de iniciar.</span>
                  </div>
                </div>
              )}

              {runningOperators.map((operator) => (
                <article className="running-work-operator" key={operator.id}>
                  <header className="running-work-operator__header">
                    <span className="running-work-operator__avatar" aria-hidden="true">
                      {operator.name.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <span>Operario</span>
                      <h4>{operator.name}</h4>
                    </div>
                    <Badge variant="success">{operator.work.length} etapa{operator.work.length === 1 ? '' : 's'}</Badge>
                  </header>

                  <div className="running-work-operator__assignments">
                    {operator.work.map((work) => (
                      <div className="running-work-assignment" key={work.key}>
                        <span className="running-work-stage__signal" aria-hidden="true" />
                        <div className="running-work-assignment__body">
                          <span className="running-work-assignment__eyebrow">Etapa en ejecución</span>
                          <strong className="running-work-assignment__stage">{work.stageName}</strong>
                          <div className="running-work-assignment__order">
                            <span className="dash-order-code">{work.orderCode}</span>
                            <div>
                              <strong>{work.orderTitle}</strong>
                              <small>{work.modelCode} · {work.clientName}</small>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}

              {unassignedRunningStages.length > 0 && (
                <section className="running-work-unassigned" aria-label="Etapas activas sin operario asignado">
                  <strong>Etapas en marcha sin operario asignado</strong>
                  <p>Estas etapas requieren que se registre un responsable.</p>
                  <ul>
                    {unassignedRunningStages.map((work) => (
                      <li key={work.key}>
                        <span>{work.stageName}</span>
                        <small>{work.orderCode} · {work.orderTitle} · {work.modelCode}</small>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {idleAssignedOperators.length > 0 && (
                <section className="running-work-idle" aria-label="Operarios con etapas asignadas pendientes de iniciar">
                  <header className="running-work-idle__head">
                    <span className="running-work-idle__icon"><CirclePause size={20} aria-hidden="true" /></span>
                    <div>
                      <strong>Operarios con trabajo pendiente de iniciar</strong>
                      <p>Tienen etapas asignadas y disponibles, pero no están ejecutando ninguna en este momento.</p>
                    </div>
                    <Badge variant="warning">{idleAssignedOperators.length} operario{idleAssignedOperators.length === 1 ? '' : 's'}</Badge>
                  </header>

                  <div className="running-work-idle__grid">
                    {idleAssignedOperators.map((operator) => (
                      <article className="running-work-idle__operator" key={operator.id}>
                        <header>
                          <span className="running-work-idle__avatar" aria-hidden="true">{operator.name.charAt(0).toUpperCase()}</span>
                          <div>
                            <span>Disponible sin iniciar</span>
                            <h4>{operator.name}</h4>
                          </div>
                          <Badge variant="warning">{operator.work.length} etapa{operator.work.length === 1 ? '' : 's'}</Badge>
                        </header>
                        <ul>
                          {operator.work.map((work) => (
                            <li key={work.key}>
                              <div className="running-work-idle__stage">
                                <strong>{work.stageName}</strong>
                                <span>{work.status === 'PAUSADA' ? 'Pausada' : work.status === 'RETRABAJO' ? 'Retrabajo pendiente' : 'Lista para iniciar'}</span>
                              </div>
                              <div className="running-work-idle__order">
                                <span className="dash-order-code">{work.orderCode}</span>
                                <div>
                                  <strong>{work.orderTitle}</strong>
                                  <small>{work.modelCode} · {work.clientName}</small>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </Dialog>

      <Dialog
        open={Boolean(historyOrderId)}
        onOpenChange={(open) => {
          if (!open) {
            setHistoryOrderId(null);
            setExpandedHistoryEntryId(null);
          }
        }}
        title={`Seguimiento histórico · ${historyQuery.data?.code ?? ''}`}
        description={historyQuery.data ? `${historyQuery.data.title} · ${historyQuery.data.client.name}` : 'Cargando trazabilidad de la casilla...'}
        className="history-dialog"
      >
        {historyQuery.isLoading ? (
          <div className="empty-state" style={{ minHeight: 220 }}><Clock3 size={22} /> Cargando historial...</div>
        ) : historyQuery.isError || !historyQuery.data ? (
          <div className="alert alert-error">No se pudo recuperar el seguimiento de esta casilla.</div>
        ) : (
          <div style={{ display: 'grid', gap: '1.25rem' }}>
            <section className="history-summary-grid">
              <div className="history-summary-card">
                <Factory size={18} />
                <span>Modelo</span>
                <strong>{historyQuery.data.cabinModelRevision?.cabinModel.code ?? 'Sin modelo'}</strong>
                {historyQuery.data.serialNumber && <small>Serie {historyQuery.data.serialNumber}</small>}
              </div>
              <div className="history-summary-card">
                <CheckCircle2 size={18} />
                <span>Avance</span>
                <strong>{Math.round(Number(historyQuery.data.progressPct ?? 0))}%</strong>
                <small>{STATUS_LABEL[historyQuery.data.productionStatus] ?? historyQuery.data.productionStatus}</small>
              </div>
              <div className="history-summary-card">
                <UserRound size={18} />
                <span>Creada por</span>
                <strong>{historyQuery.data.createdByUser?.fullName ?? 'No registrado'}</strong>
                <small>{formatHistoryDate(historyQuery.data.createdAt)}</small>
              </div>
              <div className="history-summary-card">
                <Clock3 size={18} />
                <span>Compromiso</span>
                <strong>{historyQuery.data.commitmentDate ? new Date(historyQuery.data.commitmentDate).toLocaleDateString('es-AR') : 'Sin fecha'}</strong>
                <small>{historyQuery.data.attachments.length} archivos · {historyQuery.data.materialConsumptions.length} consumos</small>
              </div>
            </section>

            <section>
              <div className="section-head" style={{ marginBottom: '.65rem' }}>
                <div>
                  <h3>Estado de las etapas</h3>
                  <p>Responsables y situación actual de cada proceso.</p>
                </div>
              </div>
              <div className="history-stage-grid">
                {historyQuery.data.stages.map(stage => {
                  const isAssigned = stage.assignments.length > 0;
                  const isDelayed = Boolean(
                    historyQuery.data.commitmentDate &&
                    new Date(historyQuery.data.commitmentDate).getTime() < Date.now() &&
                    !['FINALIZADA', 'ENTREGADA', 'CANCELADA'].includes(historyQuery.data.productionStatus) &&
                    !['COMPLETADA', 'CANCELADA'].includes(stage.status)
                  );
                  return (
                    <article
                      key={stage.id}
                      className={`history-stage stage-card--${stage.status.toLowerCase()}${isAssigned ? ' stage-card--assigned' : ''}${isDelayed ? ' stage-card--delayed' : ''}`}
                    >
                      <div className="history-stage__head">
                        <strong>{stage.name}</strong>
                        <span>{stage.status.replace(/_/g, ' ')}</span>
                      </div>
                      {isDelayed && (
                        <div className="stage-flow-card__signals" aria-label="Indicadores de la etapa">
                          {isDelayed && <span className="stage-signal stage-signal--delayed">Retrasada</span>}
                        </div>
                      )}
                      <small>
                        {stage.assignments.map(item => item.user?.fullName ?? item.resource.name).join(', ') || 'Sin responsable'}
                      </small>
                    </article>
                  );
                })}
              </div>
            </section>

            <section>
              <div className="section-head" style={{ marginBottom: '.65rem' }}>
                <div>
                  <h3>Historial completo</h3>
                  <p>Asignaciones, avances, pausas, sesiones y consumos, del más reciente al más antiguo.</p>
                </div>
                <Badge variant="primary">{historyEntries.length} registros</Badge>
              </div>
              <ul className="history-timeline">
                {historyEntries.map(entry => {
                  const Icon = entry.kind === 'assignment' ? UserRound
                    : entry.kind === 'material' ? Wrench
                      : entry.kind === 'creation' ? Factory
                        : entry.kind === 'paused' ? CirclePause
                          : CheckCircle2;
                  const expanded = expandedHistoryEntryId === entry.id;
                  return (
                    <li key={entry.id} className={`history-entry history-entry--${entry.kind}${expanded ? ' is-expanded' : ''}`}>
                      <div className="history-entry__icon"><Icon size={15} /></div>
                      <div className="history-entry__content">
                        <div className="history-entry__summary">
                          <strong>{entry.title} <span>— {entry.actor ?? 'Sistema'}</span></strong>
                          <time>{formatHistoryDate(entry.at)}</time>
                          <button
                            className="history-entry__toggle"
                            type="button"
                            aria-expanded={expanded}
                            aria-label={expanded ? 'Ocultar detalle del movimiento' : 'Ver detalle del movimiento'}
                            title={expanded ? 'Ocultar detalle' : 'Ver detalle'}
                            onClick={() => setExpandedHistoryEntryId(current => current === entry.id ? null : entry.id)}
                          >
                            <ChevronDown size={15} />
                          </button>
                        </div>
                        {expanded && (
                          <div className="history-entry__details">
                            {entry.stage && <span className="history-entry__stage">{entry.stage}</span>}
                            {entry.detail && <p>{entry.detail}</p>}
                            <small>Responsable del registro: <strong>{entry.actor ?? 'Sistema'}</strong></small>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
                {!historyEntries.length && <li className="empty-state">Todavía no hay movimientos históricos registrados.</li>}
              </ul>
            </section>
          </div>
        )}
      </Dialog>

      {/* ── MODAL CONTROL DE CALIDAD ─────────────────────── */}
      <Dialog
        open={!!approveModalOrder}
        onOpenChange={(open) => { if (!open) { setApproveModalOrder(null); setRejectMode(false); setReworkStageId(''); } }}
        title={`Control de calidad: ${approveModalOrder?.code}`}
        description={rejectMode
          ? 'Elegí qué etapa hay que reabrir para corregir el defecto.'
          : 'Registrá una calificación y observación sobre el trabajo antes de aprobar.'}
        className="quality-review-dialog"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingTop: '0.5rem' }}>

          <div className="quality-review-tabs" style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={() => setRejectMode(false)}
              className={!rejectMode ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}>
              ✔ Aprobar
            </button>
            <button type="button" onClick={() => setRejectMode(true)}
              className={rejectMode ? 'btn btn-danger btn-sm' : 'btn btn-secondary btn-sm'}>
              ✖ Rechazar
            </button>
          </div>

          {!rejectMode ? (
            <div>
              <p style={{ fontSize: '0.82rem', color: 'var(--ink-soft)', fontWeight: 600, marginBottom: '0.6rem' }}>
                CALIFICACIÓN DEL TRABAJO
              </p>
              <div className="quality-rating-grid" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setApproveRating(n)}
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.6rem',
                      border: `2px solid ${approveRating === n ? 'var(--primary)' : 'var(--border)'}`,
                      background: approveRating === n ? 'color-mix(in srgb, var(--primary) 12%, var(--panel))' : 'var(--panel)',
                      color: approveRating === n ? 'var(--primary)' : 'var(--ink-soft)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {'⭐'.repeat(n)}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--ink-soft)', marginTop: '0.4rem' }}>
                {['', 'Deficiente', 'Regular', 'Aceptable', 'Bueno', 'Excelente'][approveRating]}
              </p>
            </div>
          ) : (
            <label style={{ display: 'grid', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--ink-soft)', fontWeight: 600 }}>
              ETAPA A REABRIR
              <select className="input" value={reworkStageId} onChange={e => setReworkStageId(e.target.value)}>
                <option value="">Elegir etapa...</option>
                {(approveModalOrder?.stages ?? [])
                  .filter(s => s.status === 'COMPLETADA' && !s.isQualityGate)
                  .map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
              </select>
            </label>
          )}

          <label style={{ display: 'grid', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--ink-soft)', fontWeight: 600 }}>
            OBSERVACIONES {rejectMode ? '' : '(OPCIONAL)'}
            <Textarea
              value={approveNote}
              onChange={e => setApproveNote(e.target.value)}
              placeholder={rejectMode
                ? 'Ej: Terminación con marcas de pintura, corregir antes de reenviar a calidad...'
                : 'Ej: Trabajo prolijo, sin reprocesos. Tiempo de ejecución dentro de lo esperado...'}
              rows={3}
            />
          </label>

          <div className="quality-review-actions" style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
            {!rejectMode ? (
              <Button
                onClick={handleConfirmApprove}
                disabled={approveMutation.isPending}
                style={{ background: 'var(--success)', color: 'white', flex: 1 }}
              >
                {approveMutation.isPending ? '⏳ Aprobando...' : '✔ Confirmar Aprobación'}
              </Button>
            ) : (
              <Button
                onClick={handleConfirmReject}
                disabled={rejectMutation.isPending || !reworkStageId}
                style={{ background: 'var(--destructive)', color: 'white', flex: 1 }}
              >
                {rejectMutation.isPending ? '⏳ Rechazando...' : '✖ Confirmar Rechazo'}
              </Button>
            )}
            <Button variant="secondary" onClick={() => setApproveModalOrder(null)} disabled={approveMutation.isPending || rejectMutation.isPending}>
              Cancelar
            </Button>
          </div>
        </div>
      </Dialog>

    </div>
  );
}
