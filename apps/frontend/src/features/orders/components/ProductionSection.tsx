import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../shared/api/http';
import type { Order, ProductionStatus, OperationLog, MaterialConsumption } from '../api/ordersApi';
import {
  addConsumption, updateConsumption, deleteConsumption,
  closeDelivery, updateStageStatus, rejectQualityControl
} from '../api/ordersApi';
import {
  Cpu, Clock, Package, Truck,
  CheckCircle, AlertTriangle, FileText, ShieldCheck, ShieldAlert,
  Edit2, Trash2, Save, ChevronDown
} from 'lucide-react';
import { AttachmentList } from './AttachmentList';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { repairText } from '../../../shared/utils/textEncoding';

interface Props {
  order: Order;
  userRole: string;
  userId: string;
  onRefresh: () => void;
}

const PS_LABEL: Record<ProductionStatus, string> = {
  PENDIENTE: 'No iniciada', PLANIFICADA: 'No iniciada', EN_PROCESO: 'En proceso',
  PAUSADA: 'Pausada', FINALIZADA: 'Finalizada', ENTREGADA: 'Entregada',
  CANCELADA: 'Cancelada', RETRABAJO: 'Retrabajo'
};
const PS_COLOR: Record<ProductionStatus, string> = {
  PENDIENTE: 'var(--color-text-muted)', PLANIFICADA: 'var(--color-text-muted)', EN_PROCESO: 'var(--color-industrial)',
  PAUSADA: 'var(--color-warning)', FINALIZADA: 'var(--color-success)', ENTREGADA: 'var(--color-success)',
  CANCELADA: 'var(--color-danger)', RETRABAJO: 'var(--color-warning)'
};

const getPriorityText = (priority: number) => {
  if (priority >= 5) return 'Urgente';
  if (priority >= 4) return 'Alta';
  if (priority >= 3) return 'Normal';
  if (priority >= 2) return 'Baja';
  return 'Mínima';
};

function formatDate(d?: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatDateTime(d?: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function getErrorMessage(err: any) {
  const msg = err?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  if (typeof msg === 'string' && msg.trim()) return msg;
  if (typeof err?.message === 'string' && err.message.trim()) return err.message;
  return 'Error inesperado';
}

export function ProductionSection({ order, userRole, userId, onRefresh }: Props) {
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | 'approveDelivery' | 'closeDelivery'>(null);

  // Event
  const [eventType, setEventType] = useState('');
  const [eventNote, setEventNote] = useState('');
  const [pauseReason, setPauseReason] = useState('');

  // Consumption
  const [materialId, setMaterialId] = useState('');
  const [consumeQty, setConsumeQty] = useState('');
  const [consumeNote, setConsumeNote] = useState('');
  const [consumptionPanelOpen, setConsumptionPanelOpen] = useState(false);
  const [editingConsumptionId, setEditingConsumptionId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<null | { type: 'consumption'; id: string; label: string }>(null);

  // Close delivery
  const [closeForm, setCloseForm] = useState({ deliveryChecklist: '', deliveryNote: '', deliveredAt: '', isSigned: false });

  const canManage = ['DUENO', 'SUPERVISOR', 'ADMIN'].includes(userRole);
  const isAssigned = order.assignments?.some(a => a.userId === userId && !a.unassignedAt) ?? false;
  const canOperate = canManage || (userRole === 'OPERARIO' && isAssigned);

  const materialsQuery = useQuery({ queryKey: ['materials-list'], queryFn: async () => (await api.get<any[]>('/materials', { params: { active: 'true' } })).data });

  const act = async (fn: () => Promise<void>, successMsg: string) => {
    setMessage(null);
    setLoading(true);
    try {
      await fn();
      setMessage({ type: 'success', text: successMsg });
      onRefresh();
    } catch (err) {
      setMessage({ type: 'error', text: getErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConsumption = () => act(async () => {
    if (!materialId || !consumeQty) throw new Error('Selecciona material y cantidad');
    if (editingConsumptionId) {
      await updateConsumption(order.id, editingConsumptionId, {
        materialId,
        quantity: Number(consumeQty),
        note: consumeNote || undefined
      });
    } else {
      await addConsumption(order.id, materialId, Number(consumeQty), consumeNote || undefined);
    }
    setMaterialId('');
    setConsumeQty('');
    setConsumeNote('');
    setEditingConsumptionId(null);
    setConsumptionPanelOpen(false);
  }, editingConsumptionId ? 'Consumo actualizado' : 'Consumo registrado');

  const startEditConsumption = (consumption: MaterialConsumption) => {
    setEditingConsumptionId(consumption.id);
    setMaterialId(consumption.materialId);
    setConsumeQty(String(Number(consumption.quantity)));
    setConsumeNote(consumption.note ?? '');
    setConsumptionPanelOpen(true);
  };

  const clearConsumptionForm = () => {
    setEditingConsumptionId(null);
    setMaterialId('');
    setConsumeQty('');
    setConsumeNote('');
  };

  const handleDeleteTarget = async () => {
    if (!deleteTarget) return;
    await act(async () => {
      await deleteConsumption(order.id, deleteTarget.id);
    }, 'Consumo eliminado');
    setDeleteTarget(null);
  };

  const handleFooterSave = () => {
    if (consumptionPanelOpen || materialId || consumeQty || editingConsumptionId) {
      handleSaveConsumption();
      return;
    }
    setMessage({ type: 'success', text: 'La orden de producción ya está actualizada' });
  };

  const qualityStage = order.stages?.find(s => s.isQualityGate);
  const qualityPending = Boolean(
    qualityStage && ['DISPONIBLE', 'EN_PROCESO', 'PAUSADA'].includes(qualityStage.status)
  );
  const reworkCandidates = (order.stages ?? []).filter(
    s => s.id !== qualityStage?.id && s.status === 'COMPLETADA'
  );
  const [qualityNote, setQualityNote] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reworkStageId, setReworkStageId] = useState('');

  const handleApproveQuality = () => act(async () => {
    if (!qualityStage) return;
    await updateStageStatus(order.id, qualityStage.id, 'COMPLETADA', qualityNote || undefined);
    setQualityNote('');
  }, 'Control de calidad aprobado');

  const handleRejectQuality = () => act(async () => {
    if (!qualityStage || !reworkStageId) throw new Error('Elegí qué etapa hay que reabrir');
    await rejectQualityControl(order.id, qualityStage.id, reworkStageId, qualityNote || undefined);
    setQualityNote('');
    setReworkStageId('');
    setRejectOpen(false);
  }, 'Control de calidad rechazado');

  const handleConfirmApproveDelivery = async () => {
    await act(async () => {
      await closeDelivery(order.id, { isSigned: false });
    }, 'Entregada');
    setConfirmAction(null);
  };

  const handleConfirmCloseDelivery = async () => {
    await act(async () => {
      await closeDelivery(order.id, {
        deliveryChecklist: closeForm.deliveryChecklist || undefined,
        deliveryNote: closeForm.deliveryNote || undefined,
        deliveredAt: closeForm.deliveredAt || undefined,
        isSigned: closeForm.isSigned
      });
    }, 'Orden entregada y bloqueada');
    setConfirmAction(null);
  };

  const handlePrintRemito = () => {
    const brandLogoUrl = `${window.location.origin}/brand/LOGO-DISAL.svg`;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Remito - ${order.code}</title>
          <style>
            body { font-family: 'Arial', sans-serif; padding: 40px; color: #000; margin: 0; }
            .header { border-bottom: 2px solid #ccc; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; }
            .brand { display: flex; align-items: flex-end; gap: 18px; }
            .brand-logo { width: 118px; height: auto; display: block; }
            h1 { margin: 0; font-size: 28px; text-transform: uppercase; letter-spacing: 1px; color: #000; }
            h2 { margin: 10px 0 0 0; font-size: 16px; color: #555; }
            .date { font-size: 14px; font-weight: bold; }
            .info { margin-bottom: 30px; font-size: 15px; line-height: 1.6; border: 1px solid #ccc; padding: 15px; border-radius: 4px; }
            .signature-area { margin-top: 120px; display: flex; justify-content: space-between; }
            .signature-box { width: 45%; border-top: 1px solid #000; padding-top: 10px; text-align: center; font-size: 14px; }
            .checklist { margin-top: 30px; padding: 20px; border: 1px dashed #aaa; background: #fafafa; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="brand">
              <img class="brand-logo" src="${brandLogoUrl}" alt="DISAL Planta de Látex" />
              <div>
                <h1>R E M I T O</h1>
                <h2>Comprobante de entrega - OP: ${order.code}</h2>
              </div>
            </div>
            <div class="date">Fecha de Entrega: ${order.deliveredAt ? new Date(order.deliveredAt).toLocaleDateString('es-AR') : new Date().toLocaleDateString('es-AR')}</div>
          </div>
          <div class="info">
            <p><strong>Cliente:</strong> ${order.client.name}</p>
            <p><strong>Casilla / Proyecto:</strong> ${order.title}</p>
            ${order.purchaseOrderNumber ? `<p><strong>OC Cliente:</strong> ${order.purchaseOrderNumber}</p>` : ''}
          </div>

          <h3>Detalle / Concepto:</h3>
          <p>${order.description || 'Cumplimiento de la orden de producción referenciada.'}</p>

          ${order.deliveryChecklist || order.deliveryNote ? `
          <div class="checklist">
            <h4>Registro de Entrega:</h4>
            ${order.deliveryChecklist ? `<p><strong>Checklist:</strong><br/>${order.deliveryChecklist.replace(/\n/g, '<br/>')}</p>` : ''}
            ${order.deliveryNote ? `<p><strong>Notas:</strong><br/>${order.deliveryNote.replace(/\n/g, '<br/>')}</p>` : ''}
          </div>
          ` : ''}

          <div class="signature-area">
            <div class="signature-box">
              Firma y aclaración (DISAL)
            </div>
            <div class="signature-box">
              <br/><br/>Recibi Conforme (Firma, Aclaracion y DNI del Cliente)
            </div>
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 2000);
    }, 250);
  };

  const ps = order.productionStatus;

  if (!ps) {
    return (
      <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--ink-muted)', fontSize: '0.9rem' }}>
        <Cpu size={32} style={{ opacity: 0.3, display: 'block', margin: '0 auto 0.75rem' }} />
        <p>Esta orden aun no esta en fase de produccion.</p>
        <small>Aproba el presupuesto para activar la produccion.</small>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      {/* Header estado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Cpu size={18} style={{ color: 'var(--success)' }} />
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Orden de Producción</h3>
            <small style={{ color: 'var(--ink-muted)' }}>OP - {order.code}</small>
          </div>
          <div style={{
            padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700,
            background: `color-mix(in srgb, ${PS_COLOR[ps]} 15%, transparent 85%)`,
            color: PS_COLOR[ps], border: `1px solid color-mix(in srgb, ${PS_COLOR[ps]} 40%, transparent 60%)`
          }}>
            {PS_LABEL[ps]}
          </div>
        </div>

        <div style={{ fontSize: '0.85rem', color: 'var(--ink-muted)' }}>
          <strong>Prioridad:</strong> {getPriorityText(order.priority)}
        </div>
      </div>

      {/* Fechas de produccion */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem' }}>
        {[
          { label: 'Compromiso', value: formatDate(order.commitmentDate), warn: !!(order.commitmentDate && new Date(order.commitmentDate) < new Date() && !['FINALIZADA', 'ENTREGADA', 'CANCELADA'].includes(ps)) },
          { label: 'Inicio', value: formatDate(order.startedAt) },
          { label: 'Finalizacion', value: formatDate(order.finishedAt) },
          { label: 'Entrega', value: formatDate(order.deliveredAt) },
        ].filter(r => r.value !== '-').map(row => (
          <div key={row.label} style={{
            padding: '0.5rem 0.6rem', borderRadius: '0.5rem',
            background: row.warn ? 'color-mix(in srgb, var(--destructive) 8%, var(--panel) 92%)' : 'var(--panel)',
            border: `1px solid ${row.warn ? 'var(--destructive)' : 'var(--border)'}`
          }}>
            <p style={{ fontSize: '0.7rem', color: row.warn ? 'var(--destructive)' : 'var(--ink-muted)', fontWeight: 600, margin: '0 0 0.2rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              {row.warn && <AlertTriangle size={10} />} {row.label} {row.warn ? '(VENCIDA)' : ''}
            </p>
            <p style={{ fontWeight: 700, fontSize: '0.88rem', margin: 0, color: row.warn ? 'var(--destructive)' : 'inherit' }}>{row.value}</p>
          </div>
        ))}
      </div>

      {/* El estado de la orden se deriva automáticamente de sus etapas. Desde acá un gestor
          no inicia/pausa/reanuda/finaliza a mano: solo interviene en el control de calidad
          y en el cierre de entrega. */}
      {canManage && qualityStage && qualityPending && (
        <div style={{ padding: '1rem', background: 'color-mix(in srgb, var(--primary) 6%, var(--panel) 94%)', borderRadius: '0.65rem', border: '2px solid color-mix(in srgb, var(--primary) 30%, transparent 70%)', display: 'grid', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <ShieldCheck size={16} /> Control de calidad pendiente de tu revisión
          </span>
          <textarea className="input" rows={2} placeholder="Observación (opcional)" value={qualityNote} onChange={e => setQualityNote(e.target.value)} />
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button className="btn" style={{ background: 'var(--success)', color: 'white', border: 'none' }}
              onClick={handleApproveQuality} disabled={loading}>
              <ShieldCheck size={15} /> Aprobar control de calidad
            </button>
            <button className="btn btn-danger" onClick={() => setRejectOpen(v => !v)} disabled={loading}>
              <ShieldAlert size={15} /> Rechazar
            </button>
          </div>
          {rejectOpen && (
            <div style={{ display: 'grid', gap: '0.5rem', padding: '0.75rem', background: 'var(--panel)', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', fontWeight: 600 }}>
                ¿Qué etapa hay que reabrir para corregir?
              </label>
              <select className="input" value={reworkStageId} onChange={e => setReworkStageId(e.target.value)}>
                <option value="">Elegir etapa...</option>
                {reworkCandidates.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <button className="btn" style={{ background: 'var(--destructive)', color: 'white', border: 'none' }}
                onClick={handleRejectQuality} disabled={loading || !reworkStageId}>
                Confirmar rechazo y reabrir etapa
              </button>
            </div>
          )}
        </div>
      )}

      {/* Gestion de consumos */}
      <div className="work-order-tools">
        <section className="work-order-card work-order-card--material">
          <div className="work-order-card__head">
            <div>
              <h4><Package size={15} /> Consumo de material</h4>
              <p>Registra, corrige o elimina insumos imputados a la orden.</p>
            </div>
          </div>

          {canOperate && ps !== 'ENTREGADA' && ps !== 'CANCELADA' && (
            <div className={`work-order-editor ${consumptionPanelOpen ? 'is-open' : ''}`}>
              <button className="work-order-editor__summary" onClick={() => setConsumptionPanelOpen(v => !v)} type="button">
                <span>{editingConsumptionId ? 'Editar consumo' : 'Registrar consumo de material'}</span>
                <ChevronDown size={15} />
              </button>
              {consumptionPanelOpen && (
                <div className="work-order-editor__body work-order-editor__body--wide">
                  <select className="input" value={materialId} onChange={e => setMaterialId(e.target.value)}>
                    <option value="">Material...</option>
                    {materialsQuery.data?.map((m: any) => <option key={m.id} value={m.id}>{m.name} (stock: {m.stock} {m.unit})</option>)}
                  </select>
                  <input className="input" type="number" min={0.01} step={0.01} placeholder="Cantidad" value={consumeQty} onChange={e => setConsumeQty(e.target.value)} />
                  <input className="input" placeholder="Nota (opcional)" value={consumeNote} onChange={e => setConsumeNote(e.target.value)} />
                  <button className="btn btn-primary" onClick={handleSaveConsumption} disabled={loading || !materialId || !consumeQty}>
                    <Save size={14} /> {editingConsumptionId ? 'Guardar consumo' : 'Guardar'}
                  </button>
                  {editingConsumptionId && (
                    <button className="btn btn-secondary" onClick={clearConsumptionForm} disabled={loading}>Cancelar</button>
                  )}
                </div>
              )}
            </div>
          )}

          {(order.materialConsumptions?.length ?? 0) === 0 ? (
            <p className="work-order-empty">Sin consumos registrados</p>
          ) : (
            <div className="work-order-list">
              {order.materialConsumptions?.map((c: MaterialConsumption) => (
                <div key={c.id} className="work-order-row">
                  <div>
                    <strong>{c.material?.name ?? c.materialId} x {Number(c.quantity)} {c.material?.unit}</strong>
                    <span>${(Number(c.quantity) * Number(c.unitCostSnapshot)).toLocaleString('es-AR')} - {c.createdByUser?.fullName ?? 'Sin usuario'}</span>
                  </div>
                  {canOperate && ps !== 'ENTREGADA' && ps !== 'CANCELADA' && (
                    <div className="work-order-row__actions">
                      <button className="btn-icon" title="Editar consumo" onClick={() => startEditConsumption(c)}>
                        <Edit2 size={13} />
                      </button>
                      <button className="btn-icon btn-icon--danger" title="Eliminar consumo" onClick={() => setDeleteTarget({ type: 'consumption', id: c.id, label: c.material?.name ?? 'consumo' })}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      {/* Cierre de entrega */}
      {canManage && ps === 'FINALIZADA' && (
        <div id="delivery-section" style={{ padding: '1rem', background: 'color-mix(in srgb, var(--success) 5%, var(--panel) 95%)', borderRadius: '0.6rem', border: '2px solid color-mix(in srgb, var(--success) 30%, transparent 70%)' }}>
          <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 700, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Truck size={16} /> Completar Cierre de Entrega
          </h4>
          <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--ink-muted)' }}>
            1) Descargá el remito. 2) Hacé firmar al cliente y escaneálo. 3) Subilo como adjunto abajo. 4) Confirmá el cierre.
          </p>
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            <button type="button" className="btn btn-secondary" style={{ justifySelf: 'start' }} onClick={handlePrintRemito}>
              <FileText size={15} /> Descargar Remito (PDF)
            </button>
            <textarea id="delivery-checklist" className="input" rows={2} placeholder="Checklist de entrega..." value={closeForm.deliveryChecklist} onChange={e => setCloseForm({ ...closeForm, deliveryChecklist: e.target.value })} />
            <textarea className="input" rows={2} placeholder="Notas de entrega / remito..." value={closeForm.deliveryNote} onChange={e => setCloseForm({ ...closeForm, deliveryNote: e.target.value })} />
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input className="input" type="datetime-local" style={{ flex: 1 }} value={closeForm.deliveredAt} onChange={e => setCloseForm({ ...closeForm, deliveredAt: e.target.value })} />
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={closeForm.isSigned} onChange={e => setCloseForm({ ...closeForm, isSigned: e.target.checked })} />
                Remito firmado por cliente
              </label>
            </div>
            <button
              className="btn btn-primary"
              style={{ background: 'var(--success)', borderColor: 'var(--success)' }}
              onClick={() => setConfirmAction('closeDelivery')}
              disabled={loading}
            >
              <Truck size={15} /> Confirmar cierre y bloquear orden
            </button>
          </div>
        </div>
      )}

      {/* Descarga / Visualizacion post-entrega */}
      {ps === 'ENTREGADA' && (
        <div style={{ padding: '1.25rem', background: 'var(--panel)', borderRadius: '0.6rem', border: '1px solid var(--border)', display: 'grid', gap: '1rem', textAlign: 'center' }}>
          <div>
            <CheckCircle size={32} style={{ color: 'var(--success)', margin: '0 auto 0.5rem' }} />
            <h4 style={{ margin: '0 0 0.25rem', fontSize: '1rem', fontWeight: 700, color: 'var(--success)' }}>
              Orden cerrada - modo consulta
            </h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--ink-muted)' }}>
              Esta orden de producción está cerrada. Quedan disponibles el remito, adjuntos e historial para consulta.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary"
              onClick={handlePrintRemito}
            >
              <FileText size={15} /> Descargar Remito (PDF)
            </button>
          </div>
        </div>
      )}

      {/* Archivos visibles para producción */}
      <div style={{ padding: '1rem', background: 'var(--panel)', borderRadius: '0.6rem', border: '1px solid var(--border)' }}>
        <AttachmentList
          orderId={order.id}
          attachments={(order.attachments || []).filter(att => !att.isInternal)}
          canUpload={canManage && ps !== 'CANCELADA'}
          title={ps === 'ENTREGADA' ? 'Remito firmado y documentación de entrega' : 'Adjuntos para operadores'}
          description={ps === 'ENTREGADA'
            ? 'Subí aquí el remito firmado por el cliente y cualquier documentación final de la entrega.'
            : 'Planos, instrucciones y archivos que pueden consultar los operarios asignados.'}
          onRefresh={onRefresh}
        />
      </div>

      {canManage && (
        <div style={{ padding: '1rem', background: 'color-mix(in srgb, var(--primary) 4%, var(--panel) 96%)', borderRadius: '0.6rem', border: '1px solid color-mix(in srgb, var(--primary) 25%, var(--border) 75%)' }}>
          <AttachmentList
            orderId={order.id}
            attachments={(order.attachments || []).filter(att => att.isInternal)}
            canUpload={ps !== 'CANCELADA'}
            title="Adjuntos internos"
            description="Documentación confidencial, visible únicamente para dueño, supervisores y administradores."
            isInternal
            onRefresh={onRefresh}
          />
        </div>
      )}

      {/* Log de eventos */}
      {(order.operationLogs?.length ?? 0) > 0 && (
        <div>
          <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Clock size={13} /> Historial de eventos
          </h4>
          <div style={{ display: 'grid', gap: '0.3rem', maxHeight: '280px', overflowY: 'auto' }}>
            {[...(order.operationLogs || [])].sort((a, b) => new Date(b.eventAt).getTime() - new Date(a.eventAt).getTime()).map((log: OperationLog) => (
              <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.6rem', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '0.35rem', fontSize: '0.82rem' }}>
                <div>
                  <strong>{log.eventType.replace(/_/g, ' ')}</strong>
                  {log.note && <span style={{ color: 'var(--ink-muted)', marginLeft: '0.5rem' }}>- {repairText(log.note)}</span>}
                  {log.user && <span style={{ color: 'var(--ink-muted)', marginLeft: '0.5rem' }}>({log.user.fullName})</span>}
                </div>
                <span style={{ color: 'var(--ink-muted)', whiteSpace: 'nowrap', marginLeft: '0.5rem' }}>{formatDateTime(log.eventAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notas */}
      {order.notes && (
        <div style={{ padding: '0.6rem 0.8rem', background: 'var(--panel)', borderRadius: '0.5rem', border: '1px solid var(--border)', fontSize: '0.85rem' }}>
          <strong style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--ink-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notas</strong>
          {repairText(order.notes)}
        </div>
      )}

      {canOperate && ps !== 'ENTREGADA' && ps !== 'CANCELADA' && (
        <div className="work-order-savebar">
          <span>Los cambios de asignaciones, consumos y adjuntos se guardan en esta orden de producción.</span>
          <button className="btn btn-primary" onClick={handleFooterSave} disabled={loading}>
            <Save size={15} /> Guardar cambios
          </button>
        </div>
      )}

      {/* Mensaje */}
      {message && (
        <div className={`alert alert-${message.type === 'error' ? 'error' : 'success'}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {message.type === 'error' ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
          {message.text}
        </div>
      )}

      <ConfirmDialog
        open={confirmAction === 'approveDelivery'}
        onOpenChange={(open) => setConfirmAction(open ? 'approveDelivery' : null)}
        title="Aprobar entrega"
        description="La orden de producción se marcará como entregada y quedará bloqueada para nuevas modificaciones."
        confirmLabel="Aprobar entrega"
        cancelLabel="Volver"
        variant="default"
        isPending={loading}
        onConfirm={handleConfirmApproveDelivery}
      />
      <ConfirmDialog
        open={confirmAction === 'closeDelivery'}
        onOpenChange={(open) => setConfirmAction(open ? 'closeDelivery' : null)}
        title="Cerrar orden de producción"
        description="Se guardaran los datos de entrega, se generara el estado Entregada y la orden quedara en modo consulta."
        confirmLabel="Cerrar OP"
        cancelLabel="Volver"
        variant="default"
        isPending={loading}
        onConfirm={handleConfirmCloseDelivery}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Eliminar consumo"
        description={`Se quitará "${deleteTarget?.label ?? 'el registro'}" de esta orden de producción.`}
        confirmLabel="Eliminar"
        cancelLabel="Conservar"
        variant="destructive"
        isPending={loading}
        onConfirm={handleDeleteTarget}
      />
    </div>
  );
}
