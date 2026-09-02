import { useState } from 'react';
import type { Order, CommercialStatus, ProductionStatus } from '../api/ordersApi';
import { Package, FileText, Clock, AlertTriangle, CheckCircle, ArrowUp, ArrowDown, Eye } from 'lucide-react';

interface Props {
  orders: Order[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDeselect: () => void;
}

const CS_LABEL: Partial<Record<CommercialStatus, string>> = {
  BORRADOR: 'Borrador', ENVIADO: 'Enviado', APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado', VENCIDO: 'Vencido'
};
const CS_COLOR: Partial<Record<CommercialStatus, string>> = {
  BORRADOR: 'var(--color-text-muted)', ENVIADO: 'var(--color-warning)', APROBADO: 'var(--color-success)',
  RECHAZADO: 'var(--color-danger)', VENCIDO: 'var(--color-danger)'
};
const PS_LABEL: Partial<Record<ProductionStatus, string>> = {
  PENDIENTE: 'No iniciada', PLANIFICADA: 'No iniciada', EN_PROCESO: 'En proceso',
  PAUSADA: 'Pausada', FINALIZADA: 'Finalizada', ENTREGADA: 'Entregada',
  CANCELADA: 'Cancelada', RETRABAJO: 'Retrabajo'
};
const PS_COLOR: Partial<Record<ProductionStatus, string>> = {
  PENDIENTE: 'var(--color-text-muted)', PLANIFICADA: 'var(--color-text-muted)', EN_PROCESO: 'var(--color-industrial)',
  PAUSADA: 'var(--color-warning)', FINALIZADA: 'var(--color-success)', ENTREGADA: 'var(--color-success)',
  CANCELADA: 'var(--color-danger)', RETRABAJO: 'var(--color-warning)'
};
const PRIORITY_DOT = (p: number) => {
  if (p >= 5) return 'var(--color-danger)';
  if (p >= 4) return 'var(--color-warning)';
  if (p >= 3) return 'var(--color-warning)';
  return 'var(--color-text-muted)';
};
const PRIORITY_META = (p: number) => {
  if (p >= 5) return { label: 'Urgente', color: 'var(--color-danger)' };
  if (p >= 4) return { label: 'Alta', color: 'var(--color-warning)' };
  if (p >= 3) return { label: 'Normal', color: 'var(--color-warning)' };
  if (p >= 2) return { label: 'Baja', color: 'var(--color-text-muted)' };
  return { label: 'Mínima', color: 'var(--color-text-muted)' };
};

function isDelayed(order: Order) {
  return !!(
    order.commitmentDate &&
    new Date(order.commitmentDate) < new Date() &&
    order.productionStatus &&
    !['FINALIZADA', 'ENTREGADA', 'CANCELADA'].includes(order.productionStatus)
  );
}

function isExpired(order: Order) {
  return !!(
    order.validUntil &&
    new Date(order.validUntil) < new Date() &&
    order.commercialStatus &&
    !['APROBADO', 'RECHAZADO', 'VENCIDO'].includes(order.commercialStatus)
  );
}

function getEffectiveCS(order: Order): CommercialStatus | null {
  if (!order.commercialStatus) return null;
  if (isExpired(order)) return 'VENCIDO';
  return order.commercialStatus;
}

export function OrderList({ orders, loading, selectedId, onSelect, onDeselect }: Props) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(d => d === 1 ? -1 : 1);
    } else {
      setSortCol(col);
      setSortDir(1);
    }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return null;
    return sortDir === 1 ? <ArrowUp size={12} style={{ display: 'inline', marginLeft: '2px' }} /> : <ArrowDown size={12} style={{ display: 'inline', marginLeft: '2px' }} />;
  };
  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner" style={{ margin: '0 auto 1rem' }} />
        Cargando órdenes...
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-state__icon"><Package size={32} /></span>
        <p>No se encontraron órdenes con los filtros actuales</p>
      </div>
    );
  }

  const sortedOrders = [...orders].sort((a, b) => {
    if (!sortCol) return 0;
    let valA: any = ''; let valB: any = '';
    
    switch (sortCol) {
      case 'code': valA = a.code; valB = b.code; break;
      case 'client': valA = a.client.name; valB = b.client.name; break;
      case 'cs': valA = getEffectiveCS(a) || ''; valB = getEffectiveCS(b) || ''; break;
      case 'ps': valA = a.productionStatus || ''; valB = b.productionStatus || ''; break;
      case 'priority': valA = a.priority || 99; valB = b.priority || 99; break;
      case 'commitment': 
        valA = a.commitmentDate ? new Date(a.commitmentDate).getTime() : Number.MAX_SAFE_INTEGER;
        valB = b.commitmentDate ? new Date(b.commitmentDate).getTime() : Number.MAX_SAFE_INTEGER;
        break;
      case 'cost': valA = Number(a.estimatedCost || 0); valB = Number(b.estimatedCost || 0); break;
    }
    
    if (valA < valB) return -1 * sortDir;
    if (valA > valB) return 1 * sortDir;
    return 0;
  });

  return (
    <div className="premium-table-wrap">
      <table className="premium-table interactive" id="orders-table">
        <thead>
          <tr>
            <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('code')}>Código <SortIcon col="code" /></th>
            <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('client')}>Cliente / Proyecto <SortIcon col="client" /></th>
            <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('cs')}>Estado Comercial <SortIcon col="cs" /></th>
            <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('ps')}>Estado Producción <SortIcon col="ps" /></th>
            <th style={{ textAlign: 'center', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('priority')}>Prior. <SortIcon col="priority" /></th>
            <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('commitment')}>Compromiso <SortIcon col="commitment" /></th>
            <th style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('cost')}>Costo Est. <SortIcon col="cost" /></th>
            <th style={{ textAlign: 'right' }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {sortedOrders.map(order => {
            const isSelected = selectedId === order.id;
            const delayed = isDelayed(order);
            const cs = getEffectiveCS(order);
            const ps = order.productionStatus;
            const priority = PRIORITY_META(order.priority);

            return (
              <tr
                key={order.id}
                style={{
                  background: isSelected ? 'color-mix(in srgb, var(--primary) 5%, var(--panel) 95%)' : undefined,
                  borderLeft: isSelected ? '3px solid var(--primary)' : '3px solid transparent',
                }}
              >
                {/* Código */}
                <td data-label="Código">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <span className="dash-order-code">{order.code}</span>
                    {order.purchaseOrderNumber && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>OC: {order.purchaseOrderNumber}</span>
                    )}
                  </div>
                </td>

                {/* Cliente / Proyecto */}
                <td data-label="Cliente / Proyecto">
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <strong style={{ fontSize: '0.9rem' }}>{order.title}</strong>
                    <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>{order.client.name}</span>
                  </div>
                </td>

                {/* Estado comercial */}
                <td data-label="Estado comercial">
                  {cs ? (
                    <span style={{
                      padding: '0.2rem 0.5rem', borderRadius: '0.35rem', fontSize: '0.78rem', fontWeight: 700,
                      background: `color-mix(in srgb, ${CS_COLOR[cs] ?? 'var(--color-text-muted)'} 15%, transparent 85%)`,
                      color: CS_COLOR[cs] ?? 'var(--color-text-muted)',
                      display: 'inline-flex', alignItems: 'center', gap: '0.25rem'
                    }}>
                      <FileText size={11} />
                      {CS_LABEL[cs]}
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', fontStyle: 'italic' }}>Sin presupuesto</span>
                  )}
                </td>

                {/* Estado producción */}
                <td data-label="Estado producción">
                  {ps ? (
                    <span style={{
                      padding: '0.2rem 0.5rem', borderRadius: '0.35rem', fontSize: '0.78rem', fontWeight: 700,
                      background: `color-mix(in srgb, ${PS_COLOR[ps] ?? 'var(--color-text-muted)'} 15%, transparent 85%)`,
                      color: PS_COLOR[ps] ?? 'var(--color-text-muted)',
                      display: 'inline-flex', alignItems: 'center', gap: '0.25rem'
                    }}>
                      <Clock size={11} />
                      {PS_LABEL[ps]}
                      {delayed && (
                        <span title="Vencida" aria-label="Vencida" style={{ display: 'inline-flex', alignItems: 'center' }}>
                          <AlertTriangle size={10} style={{ color: 'var(--color-danger)' }} />
                        </span>
                      )}
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', fontStyle: 'italic' }}>Fase comercial</span>
                  )}
                </td>

                {/* Prioridad */}
                <td data-label="Prioridad" style={{ textAlign: 'center' }}>
                  {ps && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', justifyContent: 'center' }} title={`Prioridad ${priority.label}`}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: priority.color }}>{priority.label}</span>
                      <span style={{ display: 'flex', gap: '2px' }} aria-hidden="true">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span key={i} style={{
                            width: '6px', height: '6px', borderRadius: '50%',
                            background: i < order.priority ? PRIORITY_DOT(order.priority) : 'var(--border)'
                          }} />
                        ))}
                      </span>
                    </div>
                  )}
                </td>

                {/* Compromiso */}
                <td data-label="Compromiso" style={{ fontSize: '0.82rem' }}>
                  {order.commitmentDate ? (
                    <span style={{ color: delayed ? 'var(--destructive)' : 'inherit', fontWeight: delayed ? 700 : 400 }}>
                      {new Date(order.commitmentDate).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })}
                      {delayed && ' ⚠'}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--ink-muted)' }}>—</span>
                  )}
                </td>

                {/* Costo */}
                <td data-label="Costo estimado" style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.88rem', color: 'var(--success)' }}>
                  ${Number(order.estimatedCost).toLocaleString('es-AR')}
                </td>

                {/* Acciones */}
                <td data-label="Acciones" style={{ textAlign: 'right' }}>
                  <button
                    className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => isSelected ? onDeselect() : onSelect(order.id)}
                    id={`btn-order-detail-${order.id}`}
                    aria-label={isSelected ? 'Ocultar detalle' : 'Ver detalle'}
                    style={!isSelected ? {
                      background: 'color-mix(in srgb, var(--panel-soft) 78%, transparent 22%)',
                      color: 'var(--ink)',
                      borderColor: 'color-mix(in srgb, var(--border) 78%, transparent 22%)',
                      boxShadow: 'none'
                    } : undefined}
                  >
                    {isSelected ? <><CheckCircle size={13} /> Abierto</> : <><Eye size={13} /> Ficha</>}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
