import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CirclePause, Clock3, Download, Edit2, Eye, Factory, LockKeyhole, MessageSquare, Package, Paperclip, Play, RotateCcw, Save, Search, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { api } from '../../shared/api/http';
import { Dialog } from '../../shared/ui/Dialog';
import { getSessionUser } from '../auth/session';
import { addConsumption, fetchAttachmentFile, type Order, type OrderAttachment, type OrderStage, type OrderStageStatus } from '../orders/api/ordersApi';
import { useHighlightTarget } from '../../shared/utils/highlightTarget';

const STAGE_LABEL: Record<OrderStageStatus, string> = {
  BLOQUEADA: 'Bloqueada',
  DISPONIBLE: 'Lista para iniciar',
  EN_PROCESO: 'En proceso',
  PAUSADA: 'Pausada',
  COMPLETADA: 'Completada',
  RETRABAJO: 'Retrabajo',
  CANCELADA: 'Cancelada'
};

interface Task { order: Order; stage: OrderStage }
interface MaterialOption { id: string; name: string; unit: string; stock: number }
interface ConsumptionDraft { materialId: string; quantity: string; note: string }
interface StageComment {
  id: string;
  content: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; fullName: string; role: string };
}

function groupTasksByOrder(taskList: Task[]) {
  const groups = new Map<string, { order: Order; tasks: Task[] }>();
  for (const task of taskList) {
    const current = groups.get(task.order.id);
    if (current) current.tasks.push(task);
    else groups.set(task.order.id, { order: task.order, tasks: [task] });
  }
  return Array.from(groups.values());
}

function orderTone(orderId: string) {
  return Array.from(orderId).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 6;
}

export function OperatorPage() {
  const user = getSessionUser();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [highlightRequest, setHighlightRequest] = useState<{ stageId: string; nonce: string } | null>(null);

  // Igual que en /orders y /supervisor: se lee de location.key para que funcione
  // aunque el operario ya esté en esta pantalla cuando llega la notificación.
  useEffect(() => {
    const incoming = (location.state as { highlightStageId?: string } | null)?.highlightStageId;
    if (!incoming) return;
    setHighlightRequest({ stageId: incoming, nonce: location.key });
    navigate(location.pathname, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  useHighlightTarget(
    highlightRequest ? `order-stage-${highlightRequest.stageId}` : null,
    highlightRequest
  );

  const [search, setSearch] = useState('');
  const [consumption, setConsumption] = useState<Record<string, ConsumptionDraft>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeStageConflict, setActiveStageConflict] = useState<Task | 'unknown' | null>(null);
  const [completionTarget, setCompletionTarget] = useState<Task | null>(null);
  const [commentsTarget, setCommentsTarget] = useState<Task | null>(null);
  const [commentText, setCommentText] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentBusy, setCommentBusy] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<OrderAttachment | null>(null);
  const [previewAttachmentUrl, setPreviewAttachmentUrl] = useState<string | null>(null);
  const [previewAttachmentOrderId, setPreviewAttachmentOrderId] = useState<string | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);

  useEffect(() => () => {
    if (previewAttachmentUrl) URL.revokeObjectURL(previewAttachmentUrl);
  }, [previewAttachmentUrl]);

  const closeAttachment = () => {
    if (previewAttachmentUrl) URL.revokeObjectURL(previewAttachmentUrl);
    setPreviewAttachmentUrl(null);
    setPreviewAttachment(null);
    setPreviewAttachmentOrderId(null);
    setPreviewZoom(1);
  };

  const openAttachment = async (orderId: string, attachment: OrderAttachment) => {
    try {
      const blob = await fetchAttachmentFile(orderId, attachment.id);
      if (previewAttachmentUrl) URL.revokeObjectURL(previewAttachmentUrl);
      setPreviewAttachmentUrl(URL.createObjectURL(blob));
      setPreviewAttachment(attachment);
      setPreviewAttachmentOrderId(orderId);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message ?? 'No se pudo abrir el adjunto' });
    }
  };

  const downloadAttachment = async (orderId: string, attachment: OrderAttachment) => {
    try {
      const blob = await fetchAttachmentFile(orderId, attachment.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.fileName;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message ?? 'No se pudo descargar el adjunto' });
    }
  };

  const orders = useQuery({
    queryKey: ['operator-stage-orders'],
    queryFn: async () => (await api.get<Order[]>('/orders', { params: { assignedToMe: true, tab: 'production' } })).data,
    refetchInterval: 20000
  });
  const materials = useQuery({
    queryKey: ['operator-materials'],
    queryFn: async () => (await api.get<MaterialOption[]>('/materials')).data,
    staleTime: 30000
  });
  const commentsQuery = useQuery({
    queryKey: ['stage-comments', commentsTarget?.order.id, commentsTarget?.stage.id],
    queryFn: async () => (
      await api.get<StageComment[]>(`/orders/${commentsTarget!.order.id}/stages/${commentsTarget!.stage.id}/comments`)
    ).data,
    enabled: Boolean(commentsTarget)
  });

  const tasks = useMemo(() => {
    const result: Task[] = [];
    for (const order of orders.data ?? []) {
      for (const stage of order.stages ?? []) {
        if (stage.assignments.some(assignment => assignment.userId === user?.id)) {
          result.push({ order, stage });
        }
      }
    }
    const query = search.trim().toLowerCase();
    return result
      .filter(task => !query || `${task.order.code} ${task.order.title} ${task.stage.name} ${task.order.client.name}`.toLowerCase().includes(query))
      .sort((a, b) => {
        // Pausada queda pegada a En proceso/Retrabajo (arriba de todo): si el operario
        // la pausó un rato, no se le tiene que perder entre el resto de las tareas.
        const rank: Record<OrderStageStatus, number> = { EN_PROCESO: 0, RETRABAJO: 0, PAUSADA: 0, DISPONIBLE: 1, BLOQUEADA: 2, COMPLETADA: 3, CANCELADA: 4 };
        return rank[a.stage.status] - rank[b.stage.status] || b.order.priority - a.order.priority;
      });
  }, [orders.data, search, user?.id]);

  const active = tasks.filter(task => !['COMPLETADA', 'CANCELADA'].includes(task.stage.status));
  const completed = tasks.filter(task => task.stage.status === 'COMPLETADA');
  const activeGroups = groupTasksByOrder(active);
  const completedGroups = groupTasksByOrder(completed);

  const stageMutation = useMutation({
    mutationFn: async ({ task, status }: { task: Task; status: OrderStageStatus }) => {
      await api.patch(`/orders/${task.order.id}/stages/${task.stage.id}/status`, {
        status,
        pauseReason: status === 'PAUSADA' ? 'Pausa operativa' : undefined
      });
    },
    onSuccess: (_data, variables) => {
      setMessage({ type: 'success', text: `${variables.task.stage.name}: ${STAGE_LABEL[variables.status]}.` });
      queryClient.invalidateQueries({ queryKey: ['operator-stage-orders'] });
      setTimeout(() => setMessage(null), 3500);
    },
    onError: (error: any) => {
      const value = error?.response?.data?.message;
      const text = Array.isArray(value) ? value.join(', ') : value || '';
      if (text.includes('otra etapa con cronómetro activo')) {
        setActiveStageConflict(tasks.find(item => item.stage.status === 'EN_PROCESO') ?? 'unknown');
        return;
      }
      setMessage({ type: 'error', text: text || 'No se pudo actualizar la etapa.' });
    }
  });

  const consumptionMutation = useMutation({
    mutationFn: async ({ task, draft }: { task: Task; draft: ConsumptionDraft }) => {
      await addConsumption(task.order.id, draft.materialId, Number(draft.quantity), draft.note.trim() || undefined, task.stage.id);
    },
    onSuccess: (_data, variables) => {
      const material = materials.data?.find(item => item.id === variables.draft.materialId);
      setMessage({ type: 'success', text: `${variables.task.stage.name}: consumo de ${material?.name ?? 'material'} registrado.` });
      setConsumption(current => ({ ...current, [variables.task.stage.id]: { materialId: '', quantity: '', note: '' } }));
      queryClient.invalidateQueries({ queryKey: ['operator-materials'] });
      queryClient.invalidateQueries({ queryKey: ['operator-stage-orders'] });
      setTimeout(() => setMessage(null), 3500);
    },
    onError: (error: any) => {
      const value = error?.response?.data?.message;
      setMessage({ type: 'error', text: Array.isArray(value) ? value.join(', ') : value || 'No se pudo registrar el consumo.' });
    }
  });

  const closeComments = () => {
    if (commentBusy) return;
    setCommentsTarget(null);
    setCommentText('');
    setEditingCommentId(null);
  };

  const saveComment = async () => {
    if (!commentsTarget || !commentText.trim()) return;
    setCommentBusy(true);
    try {
      const base = `/orders/${commentsTarget.order.id}/stages/${commentsTarget.stage.id}/comments`;
      if (editingCommentId) await api.patch(`${base}/${editingCommentId}`, { content: commentText });
      else await api.post(base, { content: commentText });
      setCommentText('');
      setEditingCommentId(null);
      await commentsQuery.refetch();
    } catch (error: any) {
      const value = error?.response?.data?.message;
      setMessage({ type: 'error', text: Array.isArray(value) ? value.join(', ') : value || 'No se pudo guardar el comentario.' });
    } finally {
      setCommentBusy(false);
    }
  };

  const removeComment = async (commentId: string) => {
    if (!commentsTarget) return;
    setCommentBusy(true);
    try {
      await api.delete(`/orders/${commentsTarget.order.id}/stages/${commentsTarget.stage.id}/comments/${commentId}`);
      if (editingCommentId === commentId) {
        setEditingCommentId(null);
        setCommentText('');
      }
      await commentsQuery.refetch();
    } catch (error: any) {
      const value = error?.response?.data?.message;
      setMessage({ type: 'error', text: Array.isArray(value) ? value.join(', ') : value || 'No se pudo borrar el comentario.' });
    } finally {
      setCommentBusy(false);
    }
  };

  const actionButtons = (task: Task) => {
    const disabled = stageMutation.isPending;
    if (task.stage.status === 'DISPONIBLE' || task.stage.status === 'PAUSADA' || task.stage.status === 'RETRABAJO') {
      return (
        <button
          className="btn operator-stage-action operator-stage-action--start"
          disabled={disabled}
          onClick={() => {
            const running = tasks.find(item => item.stage.status === 'EN_PROCESO' && item.stage.id !== task.stage.id);
            if (running) {
              setActiveStageConflict(running);
              return;
            }
            stageMutation.mutate({ task, status: 'EN_PROCESO' });
          }}
        >
          <Play size={14} /> {task.stage.status === 'PAUSADA' ? 'Reanudar' : 'Iniciar etapa'}
        </button>
      );
    }
    if (task.stage.status === 'EN_PROCESO') {
      return (
        <>
          <button className="btn operator-stage-action operator-stage-action--pause" disabled={disabled} onClick={() => stageMutation.mutate({ task, status: 'PAUSADA' })}><CirclePause size={14} /> Pausar</button>
          <button className="btn operator-stage-action operator-stage-action--complete" disabled={disabled} onClick={() => setCompletionTarget(task)}><CheckCircle2 size={14} /> Completar</button>
        </>
      );
    }
    return null;
  };

  const renderTaskCard = (task: Task) => {
    const blocked = task.stage.status === 'BLOQUEADA';
    const canConsume = !['BLOQUEADA', 'COMPLETADA', 'CANCELADA'].includes(task.stage.status);
    const draft = consumption[task.stage.id] ?? { materialId: '', quantity: '', note: '' };
    const selectedMaterial = materials.data?.find(item => item.id === draft.materialId);
    const stageConsumptions = (task.order.materialConsumptions ?? [])
      .filter(item => item.orderStageId === task.stage.id)
      .sort((a, b) => new Date(b.consumedAt).getTime() - new Date(a.consumedAt).getTime());
    const updateDraft = (values: Partial<ConsumptionDraft>) => {
      setConsumption(current => ({ ...current, [task.stage.id]: { ...draft, ...values } }));
    };
    return (
      <article key={task.stage.id} id={`order-stage-${task.stage.id}`} className={`operator-stage-card stage-card--${task.stage.status.toLowerCase()}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
              <span className="operator-stage-position">Etapa {task.stage.position + 1}</span>
              <span className="operator-stage-card__status">{STAGE_LABEL[task.stage.status]}</span>
            </div>
            <h3 style={{ margin: '.45rem 0 .15rem', fontSize: '1rem' }}>{task.stage.name}</h3>
          </div>
          <strong style={{ color: 'var(--success)' }}>{Math.round(Number(task.order.progressPct ?? 0))}%</strong>
        </div>

        {blocked && (
          <div style={{ padding: '.55rem .7rem', borderRadius: '.5rem', background: 'var(--background)', color: 'var(--ink-muted)', fontSize: '.78rem' }}>
            <LockKeyhole size={13} style={{ verticalAlign: 'middle', marginRight: '.3rem' }} />
            Esperando: {task.stage.dependencies.filter(dep => dep.dependsOnStage.status !== 'COMPLETADA').map(dep => dep.dependsOnStage.name).join(', ') || 'dependencias previas'}
          </div>
        )}

        <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button className="btn operator-stage-action operator-stage-action--comments" type="button" onClick={() => {
            setCommentsTarget(task);
            setCommentText('');
            setEditingCommentId(null);
          }}>
            <MessageSquare size={14} /> Comentarios
          </button>
          {actionButtons(task)}
        </div>
        {canConsume && (
          <div className="operator-consumption">
            <div className="operator-consumption__title"><Package size={14} /> Registrar material utilizado</div>
            <div className="operator-consumption__fields">
              <select
                className="input"
                value={draft.materialId}
                onChange={event => updateDraft({ materialId: event.target.value })}
                disabled={materials.isLoading || consumptionMutation.isPending}
                aria-label={`Material consumido en ${task.stage.name}`}
              >
                <option value="">{materials.isLoading ? 'Cargando materiales...' : 'Seleccionar material...'}</option>
                {(materials.data ?? []).map(material => (
                  <option key={material.id} value={material.id} disabled={Number(material.stock) <= 0}>
                    {material.name} · Stock: {Number(material.stock)} {material.unit}
                  </option>
                ))}
              </select>
              <input
                className="input"
                type="number"
                min="0.001"
                step="0.001"
                max={selectedMaterial ? Number(selectedMaterial.stock) : undefined}
                value={draft.quantity}
                onChange={event => updateDraft({ quantity: event.target.value })}
                placeholder={selectedMaterial ? `Cantidad (${selectedMaterial.unit})` : 'Cantidad'}
                disabled={consumptionMutation.isPending}
              />
              <input
                className="input"
                value={draft.note}
                onChange={event => updateDraft({ note: event.target.value })}
                placeholder="Detalle opcional"
                disabled={consumptionMutation.isPending}
              />
              <button
                className="btn operator-consumption-action"
                disabled={
                  consumptionMutation.isPending ||
                  !draft.materialId ||
                  !draft.quantity ||
                  Number(draft.quantity) <= 0 ||
                  (selectedMaterial ? Number(draft.quantity) > Number(selectedMaterial.stock) : true)
                }
                onClick={() => consumptionMutation.mutate({ task, draft })}
              >
                <Save size={14} /> Registrar consumo
              </button>
            </div>
          </div>
        )}
        {stageConsumptions.length > 0 && (
          <div className="operator-consumption-list">
            <div className="operator-consumption__title"><Package size={14} /> Consumos registrados en esta etapa</div>
            <div className="operator-consumption-list__scroll">
              {stageConsumptions.map(item => {
                const material = materials.data?.find(option => option.id === item.materialId);
                return (
                  <div key={item.id} className="operator-consumption-item">
                    <div>
                      <strong>{material?.name ?? 'Material'}</strong>
                      {item.note && <span>{item.note}</span>}
                    </div>
                    <div className="operator-consumption-item__value">
                      <strong>{Number(item.quantity)} {material?.unit ?? ''}</strong>
                      <time>{new Date(item.consumedAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</time>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </article>
    );
  };

  const renderOrderGroup = ({ order, tasks: orderTasks }: { order: Order; tasks: Task[] }, completedGroup = false) => {
    const operatorAttachments = (order.attachments ?? []).filter(attachment => !attachment.isInternal);

    return (
    <article key={order.id} className={`operator-order-group operator-order-group--tone-${orderTone(order.id)}${completedGroup ? ' operator-order-group--completed' : ''}`}>
      <header className="operator-order-group__head">
        <div className="operator-order-group__identity">
          <span className="operator-order-group__icon"><Factory size={17} /></span>
          <div>
            <div className="operator-order-group__code-row">
              <span className="dash-order-code">{order.code}</span>
              <span>{orderTasks.length} etapa{orderTasks.length !== 1 ? 's' : ''}</span>
            </div>
            <strong>{order.title}</strong>
            <small>{order.client.name}</small>
          </div>
        </div>
        <div className="operator-order-group__progress">
          <strong>{Math.round(Number(order.progressPct ?? 0))}%</strong>
          <span>avance de la casilla</span>
        </div>
      </header>
      {operatorAttachments.length > 0 && (
        <section style={{ margin: '0 1rem 1rem', padding: '.75rem', border: '1px solid var(--border)', borderRadius: '.6rem', background: 'var(--panel-soft)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', marginBottom: '.55rem', color: 'var(--ink)', fontSize: '.82rem', fontWeight: 700 }}>
            <Paperclip size={14} />
            Archivos de la orden ({operatorAttachments.length})
          </div>
          <div style={{ display: 'flex', gap: '.45rem', flexWrap: 'wrap' }}>
            {operatorAttachments.map(attachment => (
              <button
                key={attachment.id}
                className="btn btn-secondary btn-sm"
                type="button"
                onClick={() => {
                  void openAttachment(order.id, attachment);
                  setPreviewZoom(1);
                }}
                title={`Ver ${attachment.fileName}`}
                style={{ maxWidth: '100%' }}
              >
                <Eye size={13} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.fileName}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      <div className="operator-order-group__stages">
        {orderTasks.map(renderTaskCard)}
      </div>
    </article>
    );
  };

  return (
    <div className="stack-lg page-enter">
      <header className="page-hero panel">
        <div className="page-hero__left">
          <p className="eyebrow" style={{ color: 'var(--accent-orange)' }}>TERMINAL DE PLANTA</p>
          <h2 className="page-hero__title">Mis etapas asignadas</h2>
          <p className="page-hero__sub">Iniciá, pausá y completá únicamente la etapa de la casilla en la que estás trabajando.</p>
        </div>
        <div className="page-hero__actions operator-hero-actions">
          <label className="operator-hero-search">
            <Search size={16} />
            <input
              className="input"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Buscar casilla, cliente o etapa..."
              aria-label="Buscar entre mis etapas asignadas"
            />
          </label>
          <span className="dash-period-badge">{active.length} tareas activas</span>
        </div>
      </header>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}
      {orders.isLoading ? <div className="empty-state"><Clock3 size={20} /> Cargando trabajos...</div> : (
        <>
          <section className="operator-work-section operator-work-section--active">
            <div className="operator-work-section__head">
              <div>
                <span className="operator-work-section__eyebrow">Producción activa</span>
                <h3>Trabajo disponible y en curso</h3>
                <p>Etapas que requieren tu atención o están actualmente abiertas.</p>
              </div>
              <span className="operator-work-section__count">{active.length}</span>
            </div>
            <div className="operator-work-section__groups">
              {activeGroups.map(group => renderOrderGroup(group))}
              {!active.length && <div className="empty-state">No tenés etapas activas asignadas.</div>}
            </div>
          </section>
          {completed.length > 0 && (
            <section className="operator-work-section operator-work-section--completed">
              <div className="operator-work-section__head">
                <div>
                  <span className="operator-work-section__eyebrow">Historial reciente</span>
                  <h3>Etapas completadas</h3>
                  <p>Trabajos finalizados, agrupados por casilla para su consulta.</p>
                </div>
                <span className="operator-work-section__count">{completed.length}</span>
              </div>
              <div className="operator-work-section__groups">
                {completedGroups.map(group => renderOrderGroup(group, true))}
              </div>
            </section>
          )}
        </>
      )}
      <Dialog
        open={Boolean(previewAttachment)}
        onOpenChange={open => {
          if (!open) {
            closeAttachment();
          }
        }}
        title={previewAttachment?.fileName ?? 'Archivo de la orden'}
        description="Vista previa del archivo adjunto"
        className="operator-attachment-viewer"
      >
        {previewAttachment && (
          <div className="operator-attachment-preview">
            <div className="operator-attachment-preview__toolbar">
              {previewAttachment.mimeType.startsWith('image/') && (
                <>
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => setPreviewZoom(value => Math.max(.25, value - .25))} disabled={previewZoom <= .25}>
                    <ZoomOut size={14} /> Alejar
                  </button>
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => setPreviewZoom(1)}>
                    <RotateCcw size={14} /> {Math.round(previewZoom * 100)}%
                  </button>
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => setPreviewZoom(value => Math.min(5, value + .25))} disabled={previewZoom >= 5}>
                    <ZoomIn size={14} /> Acercar
                  </button>
                </>
              )}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => previewAttachmentOrderId && void downloadAttachment(previewAttachmentOrderId, previewAttachment)}
              >
                <Download size={14} /> Descargar
              </button>
            </div>
            <div className="operator-attachment-preview__canvas">
              {previewAttachment.mimeType.startsWith('image/') ? (
                <img
                  src={previewAttachmentUrl ?? undefined}
                  alt={previewAttachment.fileName}
                  style={{ transform: `scale(${previewZoom})` }}
                />
              ) : previewAttachment.mimeType === 'application/pdf' && previewAttachmentUrl ? (
                <iframe
                  src={previewAttachmentUrl}
                  title={previewAttachment.fileName}
                />
              ) : (
                <div className="empty-state">
                  Este formato no admite vista previa en el navegador. Podés descargarlo para abrirlo con su aplicación correspondiente.
                </div>
              )}
            </div>
          </div>
        )}
      </Dialog>
      <Dialog
        open={Boolean(activeStageConflict)}
        onOpenChange={open => { if (!open) setActiveStageConflict(null); }}
        title="Ya tenés otra etapa abierta"
        description="No se puede iniciar o reanudar una etapa mientras ya tenés otra abierta."
      >
        <div style={{ display: 'grid', gap: '1rem' }}>
          <p style={{ margin: 0, color: 'var(--ink-muted)', lineHeight: 1.55 }}>
            Para continuar, primero tenés que pausar o completar la etapa que está actualmente abierta.
          </p>
          {activeStageConflict && activeStageConflict !== 'unknown' && (
            <div style={{ padding: '.75rem', border: '1px solid var(--border)', borderRadius: '.55rem', background: 'var(--panel-soft)' }}>
              <strong>{activeStageConflict.stage.name}</strong>
              <p style={{ margin: '.2rem 0 0', color: 'var(--ink-muted)', fontSize: '.8rem' }}>
                {activeStageConflict.order.code} · {activeStageConflict.order.title}
              </p>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" type="button" onClick={() => setActiveStageConflict(null)}>Aceptar</button>
          </div>
        </div>
      </Dialog>
      <Dialog
        open={Boolean(completionTarget)}
        onOpenChange={open => { if (!open && !stageMutation.isPending) setCompletionTarget(null); }}
        title="Confirmar etapa completada"
        description="Esta acción marcará la etapa como finalizada y actualizará el avance de la casilla."
        disableClose={stageMutation.isPending}
      >
        <div style={{ display: 'grid', gap: '1rem' }}>
          {completionTarget && (
            <div style={{ padding: '.8rem', border: '1px solid var(--border)', borderRadius: '.55rem', background: 'var(--panel-soft)' }}>
              <strong>{completionTarget.stage.name}</strong>
              <p style={{ margin: '.25rem 0 0', color: 'var(--ink-muted)', fontSize: '.8rem' }}>
                {completionTarget.order.code} · {completionTarget.order.title}
              </p>
            </div>
          )}
          <p style={{ margin: 0, color: 'var(--ink-muted)', lineHeight: 1.55 }}>
            ¿Confirmás que terminaste el trabajo correspondiente a esta etapa?
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.5rem', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" type="button" disabled={stageMutation.isPending} onClick={() => setCompletionTarget(null)}>
              Cancelar
            </button>
            <button
              className="btn operator-stage-action--complete"
              type="button"
              disabled={stageMutation.isPending || !completionTarget}
              onClick={() => {
                if (!completionTarget) return;
                const task = completionTarget;
                setCompletionTarget(null);
                stageMutation.mutate({ task, status: 'COMPLETADA' });
              }}
            >
              <CheckCircle2 size={14} /> Completar etapa
            </button>
          </div>
        </div>
      </Dialog>
      <Dialog
        open={Boolean(commentsTarget)}
        onOpenChange={open => { if (!open) closeComments(); }}
        title={`Comentarios · ${commentsTarget?.stage.name ?? ''}`}
        description={commentsTarget ? `${commentsTarget.order.code} · ${commentsTarget.order.title}` : undefined}
        disableClose={commentBusy}
        className="operator-comments-dialog"
      >
        <div className="operator-comments">
          <div className="operator-comments__editor">
            <textarea
              className="input"
              rows={4}
              maxLength={2000}
              value={commentText}
              onChange={event => setCommentText(event.target.value)}
              placeholder="Escribí un comentario. Podés usar Enter para agregar varias líneas..."
              disabled={commentBusy}
            />
            <div className="operator-comments__editor-actions">
              <span>{commentText.length}/2000</span>
              {editingCommentId && (
                <button className="btn btn-secondary" type="button" disabled={commentBusy} onClick={() => {
                  setEditingCommentId(null);
                  setCommentText('');
                }}>Cancelar edición</button>
              )}
              <button className="btn btn-primary" type="button" disabled={commentBusy || !commentText.trim()} onClick={saveComment}>
                <Save size={14} /> {editingCommentId ? 'Guardar cambios' : 'Agregar comentario'}
              </button>
            </div>
          </div>
          <div className="operator-comments__list">
            {commentsQuery.isLoading ? (
              <div className="empty-state">Cargando comentarios...</div>
            ) : (commentsQuery.data ?? []).length === 0 ? (
              <div className="empty-state">Todavía no hay comentarios en esta etapa.</div>
            ) : (
              commentsQuery.data?.map(comment => (
                <article key={comment.id} className="operator-comment">
                  <div className="operator-comment__head">
                    <div>
                      <strong>{comment.author.fullName}</strong>
                      <time>{new Date(comment.createdAt).toLocaleString('es-AR')}</time>
                    </div>
                    {comment.authorId === user?.id && (
                      <div className="operator-comment__actions">
                        <button className="btn-icon" type="button" title="Editar comentario" disabled={commentBusy} onClick={() => {
                          setEditingCommentId(comment.id);
                          setCommentText(comment.content);
                        }}><Edit2 size={13} /></button>
                        <button className="btn-icon btn-icon--danger" type="button" title="Borrar comentario" disabled={commentBusy} onClick={() => removeComment(comment.id)}><Trash2 size={13} /></button>
                      </div>
                    )}
                  </div>
                  <p>{comment.content}</p>
                  {comment.updatedAt !== comment.createdAt && <small>Editado</small>}
                </article>
              ))
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
}
