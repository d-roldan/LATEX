import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, CalendarDays, Check, DollarSign, FileText, Package, Plus, Trash2, Users, X } from 'lucide-react';
import { api } from '../../../shared/api/http';
import { createOrder, type CreateCostingHourInput, type CreateOrderDto, type CreateOrderItemInput } from '../api/ordersApi';

interface Client { id: string; name: string }
interface UserOption { id: string; fullName: string; role: string; isActive: boolean }
interface StageTemplate {
  id: string;
  code: string;
  name: string;
  description?: string;
  position: number;
  estimatedTimeMin: number;
  dependencies: Array<{ dependsOnStage: { code: string; name: string } }>;
}
interface CabinRevision { id: string; version: number; isDefault: boolean; stages: StageTemplate[] }
interface CabinModel { id: string; code: string; name: string; description?: string; revisions: CabinRevision[] }

interface Props {
  onSuccess: () => void;
  onCancel: () => void;
}

type OrderType = 'quotation' | 'direct';
const UNIT_OPTIONS = ['u', 'kg', 'm', 'm²', 'm³', 'lt', 'hr', 'set', 'pza'];
const COSTING_PRESETS = ['Soldadura', 'Pintura', 'Torneado', 'Mecanizado', 'Montaje', 'Plegado', 'Corte', 'Pulido'];

function errorMessage(error: any) {
  const message = error?.response?.data?.message;
  return Array.isArray(message) ? message.join(', ') : message || 'No se pudo crear la orden';
}

export function CreateOrderModal({ onSuccess, onCancel }: Props) {
  const [type, setType] = useState<OrderType>('direct');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [items, setItems] = useState<CreateOrderItemInput[]>([
    { description: '', quantity: 1, unit: 'u', estimatedUnitCost: 0 }
  ]);
  const [costingHours, setCostingHours] = useState<CreateCostingHourInput[]>([]);
  const [form, setForm] = useState({
    clientId: '',
    cabinModelRevisionId: '',
    serialNumber: '',
    title: '',
    description: '',
    purchaseOrderNumber: '',
    priority: 3,
    plannedDate: '',
    commitmentDate: '',
    estimatedTimeMin: 0,
    estimatedCost: 0,
    estimatedMaterials: '',
    validUntil: '',
    deliveryTimeDays: 0,
    notes: ''
  });

  const clients = useQuery({
    queryKey: ['clients-options'],
    queryFn: async () => (await api.get<{ items: Client[] }>('/clients')).data.items
  });
  const models = useQuery({
    queryKey: ['cabin-models'],
    queryFn: async () => (await api.get<CabinModel[]>('/cabin-models')).data,
    enabled: type === 'direct'
  });
  const operators = useQuery({
    queryKey: ['operator-options'],
    queryFn: async () => (await api.get<UserOption[]>('/users', { params: { role: 'OPERARIO', active: true } })).data,
    enabled: type === 'direct'
  });

  const selected = useMemo(() => {
    for (const model of models.data ?? []) {
      const revision = model.revisions.find(item => item.id === form.cabinModelRevisionId);
      if (revision) return { model, revision };
    }
    return null;
  }, [models.data, form.cabinModelRevisionId]);

  useEffect(() => {
    if (type !== 'direct' || form.cabinModelRevisionId || !models.data?.length) return;
    const revision = models.data[0].revisions.find(item => item.isDefault) ?? models.data[0].revisions[0];
    if (revision) setForm(current => ({ ...current, cabinModelRevisionId: revision.id }));
  }, [type, models.data, form.cabinModelRevisionId]);

  useEffect(() => {
    if (type !== 'direct' || !selected || form.title.trim()) return;
    setForm(current => ({ ...current, title: `Casilla rural ${selected.model.code}` }));
  }, [type, selected, form.title]);

  const setF = (patch: Partial<typeof form>) => setForm(current => ({ ...current, ...patch }));
  const selectType = (nextType: OrderType) => {
    setType(nextType);
    setError('');
    if (nextType === 'quotation') {
      setAssignments({});
      setForm(current => ({
        ...current,
        title: /^Casilla rural \S+$/.test(current.title.trim()) ? '' : current.title,
        cabinModelRevisionId: '',
        serialNumber: '',
        plannedDate: '',
        commitmentDate: '',
        notes: ''
      }));
    }
  };
  const itemsTotal = items.reduce((sum, item) => sum + item.quantity * item.estimatedUnitCost, 0);
  const costingTotal = costingHours.reduce((sum, row) => sum + row.hours * row.ratePerHour, 0);
  const quotationTotal = itemsTotal + costingTotal;
  const addItem = () => setItems(current => [...current, { description: '', quantity: 1, unit: 'u', estimatedUnitCost: 0 }]);
  const updateItem = (index: number, field: keyof CreateOrderItemInput, value: string | number) =>
    setItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  const removeItem = (index: number) => setItems(current => current.filter((_, itemIndex) => itemIndex !== index));
  const addCosting = (label = '') => setCostingHours(current => [...current, { label, hours: 0, ratePerHour: 0 }]);
  const updateCosting = (index: number, field: keyof CreateCostingHourInput, value: string | number) =>
    setCostingHours(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  const removeCosting = (index: number) => setCostingHours(current => current.filter((_, rowIndex) => rowIndex !== index));
  const toggleOperator = (stageCode: string, userId: string) => {
    setAssignments(current => {
      const values = current[stageCode] ?? [];
      return {
        ...current,
        [stageCode]: values.includes(userId)
          ? values.filter(id => id !== userId)
          : [...values, userId]
      };
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!form.clientId) return setError('Seleccioná un cliente.');
    if (!form.title.trim()) return setError('Ingresá un título.');
    if (type === 'direct' && !form.cabinModelRevisionId) return setError('Seleccioná un modelo de casilla.');
    if (type === 'quotation' && items.length === 0) return setError('Agregá al menos un ítem al presupuesto.');
    if (type === 'quotation' && items.some(item => !item.description.trim())) {
      return setError('Completá la descripción de todos los ítems.');
    }

    const dto: CreateOrderDto = {
      type,
      clientId: form.clientId,
      title: form.title.trim(),
      description: form.description.trim(),
      purchaseOrderNumber: form.purchaseOrderNumber.trim() || undefined,
      estimatedTimeMin: Number(form.estimatedTimeMin),
      estimatedCost: type === 'quotation' ? quotationTotal : Number(form.estimatedCost)
    };
    if (type === 'quotation') {
      dto.validUntil = form.validUntil || undefined;
      dto.estimatedMaterials = form.estimatedMaterials.trim() || undefined;
      dto.deliveryTimeDays = Number(form.deliveryTimeDays) || undefined;
      dto.items = items;
      dto.costingHours = costingHours;
    } else {
      dto.cabinModelRevisionId = form.cabinModelRevisionId;
      dto.serialNumber = form.serialNumber.trim() || undefined;
      dto.priority = Number(form.priority);
      dto.plannedDate = form.plannedDate || undefined;
      dto.commitmentDate = form.commitmentDate || undefined;
      dto.notes = form.notes.trim() || undefined;
      dto.stageAssignments = selected?.revision.stages.map(stage => ({
        stageCode: stage.code,
        userIds: assignments[stage.code] ?? []
      }));
    }

    setLoading(true);
    try {
      await createOrder(dto);
      onSuccess();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="modal-overlay" onMouseDown={event => event.target === event.currentTarget && onCancel()}>
      <div className="modal-panel create-order-modal" style={{ width: 'min(1100px, 96vw)', maxWidth: '1100px', maxHeight: '94vh', overflowY: 'auto' }}>
        <div className="order-create-modal__header">
          <span className="order-create-modal__title">
            <Package size={18} /> Nueva Orden de Producción
          </span>
          <button
            type="button"
            className="btn-icon order-create-modal__close"
            onClick={onCancel}
            aria-label="Cerrar nueva orden"
            title="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="order-type-tabs" style={{ display: 'flex', gap: '.5rem', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
          <button type="button" className={`btn ${type === 'direct' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => selectType('direct')}>
            <Package size={15} /> Nueva casilla
          </button>
          <button type="button" className={`btn ${type === 'quotation' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => selectType('quotation')}>
            <FileText size={15} /> Presupuesto
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'grid', gap: '1.25rem' }}>
            <section>
              <h4 className="form-section__title">Identificación</h4>
              <div className="form-grid-2">
                <label>Cliente *
                  <select className="input" value={form.clientId} onChange={e => setF({ clientId: e.target.value })}>
                    <option value="">Seleccionar cliente...</option>
                    {clients.data?.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
                  </select>
                </label>
                <label>Orden de compra del cliente
                  <input className="input" value={form.purchaseOrderNumber} onChange={e => setF({ purchaseOrderNumber: e.target.value })} placeholder="OC-2026-..." />
                </label>
                <label style={{ gridColumn: '1 / -1' }}>Título *
                  <input className="input" value={form.title} onChange={e => setF({ title: e.target.value })} placeholder="Casilla rural..." />
                </label>
                <label style={{ gridColumn: '1 / -1' }}>Descripción y configuración especial
                  <textarea className="input" rows={3} value={form.description} onChange={e => setF({ description: e.target.value })} placeholder="Uso, equipamiento, medidas o requerimientos especiales..." />
                </label>
              </div>
            </section>

            {type === 'quotation' && (
              <>
                <section>
                  <h4 className="form-section__title"><FileText size={15} /> Datos comerciales</h4>
                  <div className="form-grid-2">
                    <label>Validez del presupuesto
                      <input className="input" type="date" value={form.validUntil} onChange={e => setF({ validUntil: e.target.value })} />
                    </label>
                    <label>Plazo estimado de entrega (días)
                      <input className="input" type="number" min={0} value={form.deliveryTimeDays} onChange={e => setF({ deliveryTimeDays: Number(e.target.value) })} />
                    </label>
                    <label style={{ gridColumn: '1 / -1' }}>Materiales estimados
                      <textarea className="input" rows={2} value={form.estimatedMaterials} onChange={e => setF({ estimatedMaterials: e.target.value })} placeholder="Detalle general de materiales incluidos o considerados..." />
                    </label>
                  </div>
                </section>

                <section>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.65rem' }}>
                    <h4 className="form-section__title" style={{ margin: 0 }}><DollarSign size={15} /> Ítems del presupuesto</h4>
                    <button type="button" className="btn btn-sm btn-secondary" onClick={addItem}>
                      <Plus size={13} /> Agregar ítem
                    </button>
                  </div>
                  <div style={{ display: 'grid', gap: '.65rem' }}>
                    <div className="quotation-item-head" style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1.3fr auto', gap: '.4rem', fontSize: '.72rem', fontWeight: 800, textTransform: 'uppercase' }}>
                      <span>Descripción</span><span>Cantidad</span><span>Unidad</span><span>Precio unitario</span><span />
                    </div>
                    {items.map((item, index) => (
                      <div key={index} className="quotation-item-row" style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1.3fr auto', gap: '.4rem', alignItems: 'center' }}>
                        <input className="input" value={item.description} onChange={e => updateItem(index, 'description', e.target.value)} placeholder="Producto, servicio o componente" />
                        <input className="input" type="number" min={0.001} step="any" value={item.quantity} onChange={e => updateItem(index, 'quantity', Number(e.target.value))} />
                        <select className="input" value={item.unit} onChange={e => updateItem(index, 'unit', e.target.value)}>
                          {UNIT_OPTIONS.map(unit => <option key={unit}>{unit}</option>)}
                        </select>
                        <input className="input" type="number" min={0} step="any" value={item.estimatedUnitCost} onChange={e => updateItem(index, 'estimatedUnitCost', Number(e.target.value))} />
                        <button type="button" className="btn-icon btn-icon--danger" onClick={() => removeItem(index)} aria-label={`Eliminar ítem ${index + 1}`}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    {items.length === 0 && <div className="empty-state">Agregá al menos un ítem para poder crear el presupuesto.</div>}
                    <strong style={{ textAlign: 'right', color: 'var(--success)' }}>Subtotal ítems: ${itemsTotal.toLocaleString('es-AR')}</strong>
                  </div>
                </section>

                <section style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: '.65rem', background: 'var(--panel)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '.5rem', marginBottom: '.65rem', flexWrap: 'wrap' }}>
                    <h4 className="form-section__title" style={{ margin: 0 }}>Horas de costeo</h4>
                    <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap' }}>
                      {COSTING_PRESETS.map(label => (
                        <button key={label} type="button" className="btn btn-sm btn-secondary" onClick={() => addCosting(label)}>+ {label}</button>
                      ))}
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => addCosting()}><Plus size={13} /> Otra</button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: '.45rem' }}>
                    {costingHours.map((row, index) => (
                      <div key={index} className="costing-item-row" style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1.4fr auto', gap: '.4rem', alignItems: 'center' }}>
                        <input className="input" value={row.label} onChange={e => updateCosting(index, 'label', e.target.value)} placeholder="Tipo de trabajo" />
                        <input className="input" type="number" min={0} step=".5" value={row.hours} onChange={e => updateCosting(index, 'hours', Number(e.target.value))} placeholder="Horas" />
                        <input className="input" type="number" min={0} step="any" value={row.ratePerHour} onChange={e => updateCosting(index, 'ratePerHour', Number(e.target.value))} placeholder="Valor por hora" />
                        <button type="button" className="btn-icon btn-icon--danger" onClick={() => removeCosting(index)} aria-label={`Eliminar costeo ${index + 1}`}><Trash2 size={14} /></button>
                      </div>
                    ))}
                    <strong style={{ textAlign: 'right', color: 'var(--success)' }}>Subtotal horas: ${costingTotal.toLocaleString('es-AR')}</strong>
                  </div>
                </section>

                <div style={{ padding: '1rem', borderRadius: '.65rem', background: 'color-mix(in srgb, var(--success) 10%, var(--panel))', textAlign: 'right' }}>
                  <span style={{ color: 'var(--ink-muted)', marginRight: '.75rem' }}>Total estimado del presupuesto</span>
                  <strong style={{ fontSize: '1.25rem', color: 'var(--success)' }}>${quotationTotal.toLocaleString('es-AR')}</strong>
                </div>
              </>
            )}
            {type === 'direct' && (
              <>
                <section style={{ padding: '1rem', border: '1px solid color-mix(in srgb, var(--success) 30%, var(--border))', borderRadius: '.75rem', background: 'color-mix(in srgb, var(--success) 5%, var(--panel))' }}>
                  <h4 className="form-section__title"><Building2 size={15} /> Casilla a fabricar</h4>
                  <div className="form-grid-2">
                    <label>Modelo *
                      <select className="input" value={form.cabinModelRevisionId} onChange={e => {
                        const revisionId = e.target.value;
                        const model = models.data?.find(item => item.revisions.some(revision => revision.id === revisionId));
                        setF({ cabinModelRevisionId: revisionId, title: model ? `Casilla rural ${model.code}` : form.title });
                        setAssignments({});
                      }}>
                        <option value="">Seleccionar modelo...</option>
                        {models.data?.flatMap(model => model.revisions.map(revision => (
                          <option key={revision.id} value={revision.id}>{model.code} — {model.name} (v{revision.version})</option>
                        )))}
                      </select>
                    </label>
                    <label>Número de serie / identificación
                      <input className="input" value={form.serialNumber} onChange={e => setF({ serialNumber: e.target.value })} placeholder="DISAL-RC4400-..." />
                    </label>
                    <label><CalendarDays size={13} /> Inicio planificado
                      <input className="input" type="date" value={form.plannedDate} onChange={e => setF({ plannedDate: e.target.value })} />
                    </label>
                    <label>Fecha compromiso
                      <input className="input" type="date" value={form.commitmentDate} onChange={e => setF({ commitmentDate: e.target.value })} />
                    </label>
                    <label>Prioridad
                      <select className="input" value={form.priority} onChange={e => setF({ priority: Number(e.target.value) })}>
                        <option value={1}>Mínima</option><option value={2}>Baja</option><option value={3}>Normal</option><option value={4}>Alta</option><option value={5}>Urgente</option>
                      </select>
                    </label>
                    <label>Horas estimadas globales
                      <input className="input" type="number" min={0} step=".5" value={form.estimatedTimeMin / 60} onChange={e => setF({ estimatedTimeMin: Math.round(Number(e.target.value) * 60) })} />
                    </label>
                  </div>
                </section>

                <section>
                  <h4 className="form-section__title"><Users size={15} /> Responsables por etapa</h4>
                  <p style={{ margin: '-.25rem 0 .75rem', color: 'var(--ink-muted)', fontSize: '.82rem' }}>
                    Se puede asignar más de un operario. Las etapas se habilitarán automáticamente al completar sus dependencias.
                  </p>
                  {!selected ? <div className="empty-state">Seleccioná un modelo para ver su flujo productivo.</div> : (
                    <div style={{ display: 'grid', gap: '.55rem' }}>
                      {selected.revision.stages.map(stage => (
                        <div key={stage.code} className="new-order-stage-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) 2fr', gap: '1rem', padding: '.75rem', border: '1px solid var(--border)', borderRadius: '.65rem', background: 'var(--panel)' }}>
                          <div>
                            <strong>{stage.position + 1}. {stage.name}</strong>
                            <div style={{ fontSize: '.75rem', color: 'var(--ink-muted)', marginTop: '.2rem' }}>
                              {stage.dependencies.length
                                ? `Requiere: ${stage.dependencies.map(dep => dep.dependsOnStage.name).join(', ')}`
                                : 'Etapa inicial'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
                            {operators.data?.map(operator => {
                              const checked = (assignments[stage.code] ?? []).includes(operator.id);
                              return (
                                <button key={operator.id} type="button" onClick={() => toggleOperator(stage.code, operator.id)}
                                  style={{ border: `1px solid ${checked ? 'var(--success)' : 'var(--border)'}`, background: checked ? 'color-mix(in srgb, var(--success) 12%, var(--panel))' : 'var(--background)', color: checked ? 'var(--success)' : 'var(--ink)', borderRadius: '999px', padding: '.32rem .6rem', cursor: 'pointer', fontSize: '.78rem' }}>
                                  {checked && <Check size={12} style={{ verticalAlign: 'middle', marginRight: '.25rem' }} />}{operator.fullName}
                                </button>
                              );
                            })}
                            {!operators.data?.length && <span style={{ color: 'var(--ink-muted)', fontSize: '.8rem' }}>No hay operarios activos.</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <label>Notas internas de planificación
                  <textarea className="input" rows={2} value={form.notes} onChange={e => setF({ notes: e.target.value })} />
                </label>
              </>
            )}

            {error && <div className="alert alert-error">{error}</div>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading || clients.isLoading || models.isLoading}>
              {loading ? 'Creando...' : type === 'direct' ? 'Crear casilla y flujo' : 'Crear presupuesto'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
