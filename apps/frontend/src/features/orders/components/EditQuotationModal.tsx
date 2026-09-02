import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../shared/api/http';
import { updateOrder, type Order, type UpdateOrderDto, type CreateOrderItemInput, type CreateCostingHourInput } from '../api/ordersApi';
import { X, FileText, DollarSign, Plus, Trash2, Building2, Save } from 'lucide-react';

interface Client { id: string; name: string; }

interface Props {
  order: Order;
  onSuccess: (updatedOrder: Order) => void | Promise<void>;
  onCancel: () => void;
}

const UNIT_OPTIONS = ['u', 'kg', 'm', 'm²', 'm³', 'lt', 'hr', 'set', 'pza'];
const COSTING_PRESETS = ['Soldadura', 'Pintura', 'Torneado', 'Mecanizado', 'Montaje', 'Plegado', 'Corte', 'Pulido'];

function getErrorMessage(error: any, fallback: string) {
  const msg = error?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  if (typeof msg === 'string' && msg.trim()) return msg;
  return fallback;
}

export function EditQuotationModal({ order, onSuccess, onCancel }: Props) {
  const [form, setForm] = useState({
    clientId: order.clientId,
    title: order.title,
    description: order.description,
    purchaseOrderNumber: order.purchaseOrderNumber ?? '',
    estimatedTimeMin: order.estimatedTimeMin,
    estimatedCost: order.estimatedCost,
    estimatedMaterials: order.estimatedMaterials ?? '',
    validUntil: order.validUntil ? new Date(order.validUntil).toISOString().split('T')[0] : '',
    deliveryTimeDays: order.deliveryTimeDays ?? 0,
  });

  const [items, setItems] = useState<CreateOrderItemInput[]>(
    (order.items ?? []).map(it => ({
      description: it.description,
      quantity: Number(it.quantity),
      unit: it.unit,
      estimatedUnitCost: Number(it.estimatedUnitCost),
      estimatedHoursMin: it.estimatedHoursMin
    }))
  );

  const [costingHours, setCostingHours] = useState<CreateCostingHourInput[]>(
    (order.costingHours ?? []).map(h => ({
      label: h.label,
      hours: Number(h.hours),
      ratePerHour: Number(h.ratePerHour)
    }))
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientsQuery = useQuery({
    queryKey: ['clients-options'],
    queryFn: async () => {
      const res = await api.get<{ items: Client[] }>('/clients');
      return res.data.items;
    }
  });

  const itemsTotal = items.reduce((s, it) => s + it.quantity * it.estimatedUnitCost, 0);
  const costingTotal = costingHours.reduce((s, c) => s + c.hours * c.ratePerHour, 0);
  const totalCalculated = itemsTotal + costingTotal;

  useEffect(() => {
    if (items.length > 0 || costingHours.length > 0) {
      setForm(f => ({ ...f, estimatedCost: Math.round(totalCalculated * 100) / 100 }));
    }
  }, [totalCalculated]);

  const addItem = () => setItems(prev => [...prev, { description: '', quantity: 1, unit: 'u', estimatedUnitCost: 0 }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof CreateOrderItemInput, value: string | number) =>
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));

  const addCosting = (preset?: string) => setCostingHours(prev => [...prev, { label: preset ?? '', hours: 0, ratePerHour: 0 }]);
  const removeCosting = (idx: number) => setCostingHours(prev => prev.filter((_, i) => i !== idx));
  const updateCosting = (idx: number, field: keyof CreateCostingHourInput, value: string | number) =>
    setCostingHours(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.clientId) { setError('Seleccioná un cliente'); return; }
    if (!form.title.trim()) { setError('El título es obligatorio'); return; }

    setLoading(true);
    try {
      const dto: UpdateOrderDto = {
        clientId: form.clientId,
        title: form.title.trim(),
        description: form.description.trim(),
        purchaseOrderNumber: form.purchaseOrderNumber.trim() || undefined,
        estimatedTimeMin: Number(form.estimatedTimeMin),
        estimatedCost: Number(form.estimatedCost),
        estimatedMaterials: form.estimatedMaterials.trim() || undefined,
        validUntil: form.validUntil || null,
        deliveryTimeDays: null,
        items,
        costingHours
      };

      const updatedOrder = await updateOrder(order.id, dto);
      await onSuccess(updatedOrder);
    } catch (err) {
      setError(getErrorMessage(err, 'Error al actualizar la orden'));
    } finally {
      setLoading(false);
    }
  };

  const f = form;
  const setF = (patch: Partial<typeof form>) => setForm(prev => ({ ...prev, ...patch }));

  return createPortal(
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        className="modal-panel edit-quotation-modal"
        style={{ maxWidth: '720px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={18} />
            Editar Presupuesto — {order.code}
          </span>
          <button className="btn-icon" onClick={onCancel}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            <section className="edit-budget-identification">
              <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Identificación
              </h4>
              <div className="edit-quotation-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label" htmlFor="edit-client"><Building2 size={13} /> Cliente *</label>
                  <select
                    id="edit-client"
                    className="input"
                    value={f.clientId}
                    onChange={e => setF({ clientId: e.target.value })}
                    required
                  >
                    <option value="">Seleccionar cliente...</option>
                    {clientsQuery.data?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label" htmlFor="edit-title">Título *</label>
                  <input id="edit-title" className="input" value={f.title} onChange={e => setF({ title: e.target.value })} required />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label" htmlFor="edit-description">Descripción</label>
                  <textarea id="edit-description" className="input" rows={2} value={f.description} onChange={e => setF({ description: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-purchase-number">Orden de compra</label>
                  <input id="edit-purchase-number" className="input" value={f.purchaseOrderNumber} onChange={e => setF({ purchaseOrderNumber: e.target.value })} />
                </div>
              </div>
            </section>

            <section className="edit-budget-commercial">
              <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Datos Comerciales
              </h4>
              <div className="edit-quotation-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-valid-until">Válido hasta</label>
                  <input id="edit-valid-until" className="input" type="date" value={f.validUntil} onChange={e => setF({ validUntil: e.target.value })} />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label" htmlFor="edit-est-materials">Materiales estimados</label>
                  <textarea id="edit-est-materials" className="input" rows={2} value={f.estimatedMaterials} onChange={e => setF({ estimatedMaterials: e.target.value })} />
                </div>
              </div>
            </section>

            <section className="edit-budget-items">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Items del presupuesto
                </h4>
                <button type="button" className="btn btn-sm btn-secondary" onClick={addItem}>
                  <Plus size={13} /> Agregar item
                </button>
              </div>

              {items.length === 0 ? (
                <p style={{ color: 'var(--ink-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem', border: '1px dashed var(--border)', borderRadius: '0.5rem' }}>
                  Sin items
                </p>
              ) : (
                <div style={{ display: 'grid', gap: '0.65rem' }}>
                  <div className="edit-budget-item-head" style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1fr auto', gap: '0.4rem', padding: '0 0.25rem', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <span>Descripción</span>
                    <span>Cantidad</span>
                    <span>Unidad</span>
                    <span>Precio unit.</span>
                    <span />
                  </div>
                  {items.map((item, idx) => (
                    <div key={idx} className="edit-budget-item-row" style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1fr auto', gap: '0.4rem', alignItems: 'center', padding: '0.55rem', borderRadius: '0.55rem' }}>
                      <input className="input" placeholder="Descripción" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} style={{ fontSize: '0.85rem' }} />
                      <input className="input" type="number" placeholder="Cant." min={0} value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} style={{ fontSize: '0.85rem' }} />
                      <select className="input" value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} style={{ fontSize: '0.85rem' }}>
                        {UNIT_OPTIONS.map(u => <option key={u}>{u}</option>)}
                      </select>
                      <input className="input" type="number" placeholder="$ unit." min={0} value={item.estimatedUnitCost} onChange={e => updateItem(idx, 'estimatedUnitCost', Number(e.target.value))} style={{ fontSize: '0.85rem' }} />
                      <button type="button" className="btn-icon btn-icon--danger" onClick={() => removeItem(idx)}><Trash2 size={13} /></button>
                    </div>
                  ))}
                  <div style={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 700, color: 'var(--success)' }}>
                    Subtotal items: ${itemsTotal.toLocaleString('es-AR')}
                  </div>
                </div>
              )}
            </section>

            <section style={{ padding: '1rem', background: 'var(--panel)', borderRadius: '0.6rem', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Horas de costeo
                </h4>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {COSTING_PRESETS.map(p => (
                    <button key={p} type="button" onClick={() => addCosting(p)}
                      style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem', borderRadius: '0.35rem', border: '1px solid var(--border)', background: 'var(--background)', cursor: 'pointer', color: 'var(--ink)' }}>
                      + {p}
                    </button>
                  ))}
                </div>
              </div>

              {costingHours.length > 0 && (
                <div style={{ display: 'grid', gap: '0.4rem' }}>
                  {costingHours.map((row, idx) => (
                    <div key={idx} className="edit-costing-item-row" style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr auto', gap: '0.4rem', alignItems: 'center' }}>
                      <input className="input" placeholder="Tipo trabajo" value={row.label} onChange={e => updateCosting(idx, 'label', e.target.value)} style={{ fontSize: '0.85rem' }} />
                      <input className="input" type="number" placeholder="Horas" min={0} step={0.5} value={row.hours} onChange={e => updateCosting(idx, 'hours', Number(e.target.value))} style={{ fontSize: '0.85rem' }} />
                      <input className="input" type="number" placeholder="$/hr" min={0} value={row.ratePerHour} onChange={e => updateCosting(idx, 'ratePerHour', Number(e.target.value))} style={{ fontSize: '0.85rem' }} />
                      <button type="button" className="btn-icon btn-icon--danger" onClick={() => removeCosting(idx)}><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="form-group">
              <label className="form-label" htmlFor="edit-est-cost"><DollarSign size={13} /> Costo estimado total</label>
              <input id="edit-est-cost" className="input" type="number" min={0} value={f.estimatedCost} onChange={e => setF({ estimatedCost: Number(e.target.value) })} />
            </div>

            {error && <div className="alert alert-error">⚠️ {error}</div>}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading} id="btn-edit-quotation-submit">
              {loading ? <span className="spinner-xs" /> : <Save size={15} />}
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
