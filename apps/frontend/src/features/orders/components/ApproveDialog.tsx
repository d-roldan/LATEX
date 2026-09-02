import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { approveOrder } from '../api/ordersApi';
import { CheckCircle, Calendar, AlertTriangle } from 'lucide-react';
import { api } from '../../../shared/api/http';

interface CabinModel {
  id: string;
  code: string;
  name: string;
  revisions: Array<{ id: string; version: number; isDefault: boolean }>;
}

interface Props {
  orderId: string;
  orderCode: string;
  onSuccess: () => void;
  onCancel: () => void;
  alreadyInProduction?: boolean;
}

export function ApproveDialog({ orderId, orderCode, onSuccess, onCancel, alreadyInProduction = false }: Props) {
  const [commitmentDate, setCommitmentDate] = useState('');
  const [priority, setPriority] = useState(3);
  const [cabinModelRevisionId, setCabinModelRevisionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const models = useQuery({
    queryKey: ['cabin-models'],
    queryFn: async () => (await api.get<CabinModel[]>('/cabin-models')).data,
    enabled: !alreadyInProduction
  });

  const handleApprove = async () => {
    setError(null);
    setLoading(true);
    try {
      await approveOrder(
        orderId,
        commitmentDate || undefined,
        priority,
        cabinModelRevisionId || undefined
      );
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Error al aprobar el presupuesto');
    } finally {
      setLoading(false);
    }
  };

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
        className="modal-panel"
        style={{ maxWidth: '480px', width: '100%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={18} className="color-success" />
            Aprobar presupuesto
          </span>
        </div>

        <div className="modal-body">
          <p style={{ color: 'var(--ink-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Al aprobar <strong>{orderCode}</strong>, el presupuesto quedará congelado
            {alreadyInProduction ? ' y se mantendrá el estado actual de producción.' : ' y se activará la fase de producción.'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {!alreadyInProduction && (
              <div className="form-group">
                <label htmlFor="approve-cabin-model" className="form-label">Modelo a fabricar</label>
                <select
                  id="approve-cabin-model"
                  className="input"
                  value={cabinModelRevisionId}
                  onChange={event => setCabinModelRevisionId(event.target.value)}
                >
                  <option value="">Seleccionar modelo...</option>
                  {models.data?.flatMap(model => model.revisions.map(revision => (
                    <option key={revision.id} value={revision.id}>
                      {model.code} — {model.name} (v{revision.version})
                    </option>
                  )))}
                </select>
              </div>
            )}
            <div className="form-group">
              <label htmlFor="approve-commitment-date" className="form-label">
                <Calendar size={14} /> Fecha compromiso de entrega
                {alreadyInProduction && (
                  <span style={{ color: 'var(--ink-muted)', fontWeight: 400, marginLeft: '0.25rem' }}>(opcional)</span>
                )}
              </label>
              <input
                id="approve-commitment-date"
                type="date"
                className="input"
                value={commitmentDate}
                onChange={(e) => setCommitmentDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="approve-priority" className="form-label">
                Prioridad (1 = más baja, 5 = más alta)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <input
                  id="approve-priority"
                  type="range"
                  min={1}
                  max={5}
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontWeight: 700, minWidth: '1.5rem', textAlign: 'center' }}>
                  {priority}
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: '0.25rem' }}>
                {priority === 5 ? '🔴 Urgente' : priority === 4 ? '🟠 Alta' : priority === 3 ? '🟡 Normal' : priority === 2 ? '🟢 Baja' : '⚪ Mínima'}
              </p>
            </div>
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={14} />
              {error}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={handleApprove}
            disabled={loading || (!alreadyInProduction && (!commitmentDate || !cabinModelRevisionId))}
            id="btn-confirm-approve"
          >
            {loading ? <span className="spinner-xs" /> : <CheckCircle size={15} />}
            {alreadyInProduction ? 'Aprobar presupuesto' : 'Aprobar y activar producción'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
