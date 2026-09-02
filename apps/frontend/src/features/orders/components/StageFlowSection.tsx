import { CSSProperties, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2, CirclePause, Clock3, Edit2, LockKeyhole, PlayCircle,
  RotateCcw, Save, Trash2, UserPlus, X
} from 'lucide-react';
import { api } from '../../../shared/api/http';
import { Button } from '../../../shared/ui/Button';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { Progress } from '../../../shared/ui/Progress';
import {
  assignToOrder, deleteAssignment, updateAssignment,
  type Order, type OrderAssignment, type OrderStageStatus
} from '../api/ordersApi';

const STATUS: Record<OrderStageStatus, { label: string; color: string; icon: typeof Clock3 }> = {
  BLOQUEADA: { label: 'Bloqueada', color: 'var(--ink-muted)', icon: LockKeyhole },
  DISPONIBLE: { label: 'Disponible', color: 'var(--primary)', icon: Clock3 },
  EN_PROCESO: { label: 'En proceso', color: 'var(--success)', icon: PlayCircle },
  PAUSADA: { label: 'Pausada', color: 'var(--color-warning)', icon: CirclePause },
  COMPLETADA: { label: 'Completada', color: 'var(--color-success)', icon: CheckCircle2 },
  RETRABAJO: { label: 'Retrabajo', color: 'var(--color-warning)', icon: RotateCcw },
  CANCELADA: { label: 'Cancelada', color: 'var(--destructive)', icon: Clock3 }
};

interface UserOption {
  id: string;
  fullName: string;
}

interface ResourceOption {
  id: string;
  name: string;
  type: string;
  linkedUserId?: string | null;
}

interface Props {
  order: Order;
  userRole: string;
  onRefresh: () => void;
}

function normalized(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function errorMessage(error: any) {
  const value = error?.response?.data?.message;
  if (Array.isArray(value)) return value.join(', ');
  return value || error?.message || 'No se pudo actualizar la asignación';
}

export function StageFlowSection({ order, userRole, onRefresh }: Props) {
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ stageId: string; assignment: OrderAssignment } | null>(null);

  const canManage = ['DUENO', 'SUPERVISOR', 'ADMIN'].includes(userRole) &&
    !['ENTREGADA', 'CANCELADA'].includes(order.productionStatus ?? '');

  const operatorsQuery = useQuery({
    queryKey: ['stage-assignment-operators'],
    queryFn: async () => (await api.get<UserOption[]>('/users', { params: { role: 'OPERARIO', active: 'true' } })).data,
    enabled: canManage
  });

  const resourcesQuery = useQuery({
    queryKey: ['stage-assignment-human-resources'],
    queryFn: async () => (await api.get<ResourceOption[]>('/resources', { params: { type: 'HUMANO' } })).data,
    enabled: canManage
  });

  if (!order.stages?.length) return null;
  const model = order.cabinModelRevision?.cabinModel;
  const progress = Math.round(Number(order.progressPct ?? 0));
  const orderIsDelayed = Boolean(
    order.commitmentDate &&
    new Date(order.commitmentDate).getTime() < Date.now() &&
    !['FINALIZADA', 'ENTREGADA', 'CANCELADA'].includes(order.productionStatus ?? '')
  );

  const closeEditor = () => {
    setEditingStageId(null);
    setEditingAssignmentId(null);
    setSelectedUserId('');
  };

  const beginAdd = (stageId: string) => {
    setFeedback(null);
    setEditingStageId(stageId);
    setEditingAssignmentId(null);
    setSelectedUserId('');
  };

  const beginEdit = (stageId: string, assignment: OrderAssignment) => {
    setFeedback(null);
    setEditingStageId(stageId);
    setEditingAssignmentId(assignment.id);
    setSelectedUserId(assignment.userId ?? '');
  };

  const saveAssignment = async (stageId: string) => {
    const operator = operatorsQuery.data?.find(item => item.id === selectedUserId);
    if (!operator) {
      setFeedback({ type: 'error', text: 'Seleccioná un operario.' });
      return;
    }
    const operatorName = normalized(operator.fullName);
    const resource = resourcesQuery.data?.find(item => item.linkedUserId === operator.id) ??
      resourcesQuery.data?.find(item => normalized(item.name) === operatorName) ??
      resourcesQuery.data?.find(item => normalized(item.name).includes(operatorName) || operatorName.includes(normalized(item.name)));
    if (!resource) {
      setFeedback({ type: 'error', text: `${operator.fullName} no tiene un recurso humano asociado.` });
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      if (editingAssignmentId) {
        await updateAssignment(order.id, editingAssignmentId, {
          resourceId: resource.id,
          userId: operator.id,
          orderStageId: stageId
        });
      } else {
        await assignToOrder(order.id, resource.id, operator.id, stageId);
      }
      closeEditor();
      setFeedback({
        type: 'success',
        text: editingAssignmentId ? 'Responsable actualizado.' : 'Responsable asignado.'
      });
      onRefresh();
    } catch (error) {
      setFeedback({ type: 'error', text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const removeAssignment = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    setFeedback(null);
    try {
      await deleteAssignment(order.id, deleteTarget.assignment.id);
      setDeleteTarget(null);
      closeEditor();
      setFeedback({ type: 'success', text: 'Responsable quitado de la etapa.' });
      onRefresh();
    } catch (error) {
      setFeedback({ type: 'error', text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="stage-flow">
        <div className="stage-flow__head">
          <div>
            <h3>Flujo de fabricación y responsables</h3>
            <p>
              {model ? `${model.code} — ${model.name}` : 'Casilla rural'}
              {order.serialNumber ? ` · Serie ${order.serialNumber}` : ''}
            </p>
          </div>
          <div className="stage-flow__progress-copy">
            <strong>{progress}%</strong>
            <span>completado</span>
          </div>
        </div>

        <Progress value={progress} label={`Avance de ${order.code}`} />

        {feedback && (
          <div className={`stage-flow__feedback stage-flow__feedback--${feedback.type}`}>
            {feedback.text}
          </div>
        )}

        <div className="stage-flow__grid">
          {order.stages.map(stage => {
            const status = STATUS[stage.status];
            const Icon = status.icon;
            const isEditing = editingStageId === stage.id;
            const isAssigned = stage.assignments.length > 0;
            const isDelayed = orderIsDelayed && !['COMPLETADA', 'CANCELADA'].includes(stage.status);
            const isManagementStage = Boolean(stage.isQualityGate || stage.isDeliveryGate);
            const canAssign = canManage && !isManagementStage;
            return (
              <article
                key={stage.id}
                id={`order-stage-${stage.id}`}
                className={`stage-flow-card stage-card--${stage.status.toLowerCase()}${isAssigned ? ' stage-card--assigned' : ''}${isDelayed ? ' stage-card--delayed' : ''}`}
                style={{ '--stage-color': status.color } as CSSProperties}
              >
                <div className="stage-flow-card__head">
                  <div>
                    <span>Etapa {stage.position + 1}</span>
                    <strong>{stage.name}</strong>
                  </div>
                  <span className="stage-flow-card__status">
                    <Icon size={13} /> {status.label}
                  </span>
                </div>
                {isDelayed && (
                  <div className="stage-flow-card__signals" aria-label="Indicadores de la etapa">
                    {isDelayed && <span className="stage-signal stage-signal--delayed">Retrasada</span>}
                  </div>
                )}

                <div className="stage-flow-card__assignments">
                  <div className="stage-flow-card__assignment-title">
                    <span>Responsables</span>
                    {canAssign && !isEditing && (
                      <Button variant="ghost" size="sm" type="button" onClick={() => beginAdd(stage.id)}>
                        <UserPlus size={13} /> Asignar
                      </Button>
                    )}
                  </div>

                  {isManagementStage ? (
                    <span className="stage-flow-card__empty">Gestionada directamente por dueño/supervisor, sin asignación</span>
                  ) : stage.assignments.length ? (
                    <div className="stage-flow-card__people">
                      {stage.assignments.map(assignment => (
                        <div key={assignment.id} className="stage-flow-person">
                          <span className="stage-flow-person__avatar">
                            {(assignment.user?.fullName ?? assignment.resource.name).charAt(0)}
                          </span>
                          <span className="stage-flow-person__name">
                            {assignment.user?.fullName ?? assignment.resource.name}
                          </span>
                          {canAssign && (
                            <span className="stage-flow-person__actions">
                              <button type="button" className="btn-icon" aria-label="Editar responsable"
                                title="Editar responsable" onClick={() => beginEdit(stage.id, assignment)}>
                                <Edit2 size={12} />
                              </button>
                              <button type="button" className="btn-icon btn-icon--danger" aria-label="Quitar responsable"
                                title="Quitar responsable" onClick={() => setDeleteTarget({ stageId: stage.id, assignment })}>
                                <Trash2 size={12} />
                              </button>
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="stage-flow-card__empty">Sin responsable asignado</span>
                  )}

                  {isEditing && (
                    <div className="stage-flow-card__editor">
                      <select value={selectedUserId} onChange={event => setSelectedUserId(event.target.value)}
                        aria-label={`Responsable de ${stage.name}`} disabled={busy}>
                        <option value="">Seleccionar operario…</option>
                        {(operatorsQuery.data ?? []).map(operator => (
                          <option key={operator.id} value={operator.id}>{operator.fullName}</option>
                        ))}
                      </select>
                      <Button variant="success" size="sm" type="button" disabled={busy || !selectedUserId}
                        onClick={() => saveAssignment(stage.id)}>
                        <Save size={13} /> {editingAssignmentId ? 'Guardar cambio' : 'Agregar'}
                      </Button>
                      <Button variant="ghost" size="sm" type="button" disabled={busy} onClick={closeEditor}>
                        <X size={13} /> Cancelar
                      </Button>
                    </div>
                  )}
                </div>

                {stage.dependencies.length > 0 && (
                  <div className="stage-flow-card__dependencies">
                    Depende de: {stage.dependencies.map(item => item.dependsOnStage.name).join(', ')}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={open => { if (!open && !busy) setDeleteTarget(null); }}
        title="Quitar responsable"
        description={`¿Querés quitar a ${deleteTarget?.assignment.user?.fullName ?? deleteTarget?.assignment.resource.name ?? 'este responsable'} de esta etapa? El cambio quedará registrado en el historial.`}
        confirmLabel="Quitar responsable"
        cancelLabel="Cancelar"
        variant="destructive"
        onConfirm={removeAssignment}
        isPending={busy}
      />
    </>
  );
}
