import { useEffect, useState } from 'react';
import type { Order, OrderItem, OrderCostingHour } from '../api/ordersApi';
import { updateCommercialStatus, type CommercialStatus } from '../api/ordersApi';
import { FileText, Calendar, Check, Save, Printer } from 'lucide-react';
import { ApproveDialog } from './ApproveDialog';

interface Props {
  order: Order;
  userRole: string;
  onRefresh: () => void;
}

const CS_LABEL: Record<CommercialStatus, string> = {
  BORRADOR: 'Borrador', ENVIADO: 'Enviado a cliente', APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado', VENCIDO: 'Vencido'
};
const CS_COLOR: Record<CommercialStatus, string> = {
  BORRADOR: 'var(--color-text-muted)', ENVIADO: 'var(--color-warning)', APROBADO: 'var(--color-success)',
  RECHAZADO: 'var(--color-danger)', VENCIDO: 'var(--color-danger)'
};

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function MoneyLine({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.6rem', borderRadius: '0.35rem', background: 'var(--panel)', border: '1px solid var(--border)', fontSize: '0.85rem' }}>
      <span style={{ color: 'var(--ink-muted)' }}>{label}</span>
      <strong style={{ color: highlight ? 'var(--success)' : 'var(--ink)' }}>${value.toLocaleString('es-AR')}</strong>
    </div>
  );
}

export function CommercialSection({ order, userRole, onRefresh }: Props) {
  const [statusDraft, setStatusDraft] = useState<CommercialStatus>(order.commercialStatus ?? 'BORRADOR');
  const [showApprove, setShowApprove] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManageCommercial = ['DUENO', 'SUPERVISOR', 'ADMIN'].includes(userRole);
  const inProduction = order.productionStatus != null;
  const hasBudget = Boolean(
    order.commercialStatus
    || order.items?.length
    || order.costingHours?.length
    || order.validUntil
    || Number(order.estimatedMaterials) > 0
  );
  const effectiveCommercialStatus: CommercialStatus | null = order.commercialStatus ?? (hasBudget ? 'BORRADOR' : null);
  const isExpired = !!(order.validUntil && new Date(order.validUntil) < new Date() && effectiveCommercialStatus !== 'APROBADO');
  const cs = isExpired && effectiveCommercialStatus !== 'VENCIDO' ? 'VENCIDO' : (effectiveCommercialStatus ?? 'BORRADOR');

  // Item totals
  const itemsTotal = (order.items ?? []).reduce((s, it) => s + Number(it.quantity) * Number(it.estimatedUnitCost), 0);
  const hoursTotal = (order.costingHours ?? []).reduce((s, h) => s + Number(h.hours) * Number(h.ratePerHour), 0);

  useEffect(() => {
    setStatusDraft(order.commercialStatus ?? 'BORRADOR');
  }, [order.commercialStatus]);

  const handleStatusChange = async () => {
    setError(null);
    if (statusDraft === 'APROBADO' && order.commercialStatus !== 'APROBADO') {
      setShowApprove(true);
      return;
    }
    setLoading(true);
    try {
      await updateCommercialStatus(order.id, statusDraft);
      onRefresh();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Error al cambiar estado');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
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

    let itemsHtml = '';
    if (order.items && order.items.length > 0) {
      itemsHtml = order.items.map(it => `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px;">${it.description}</td>
          <td style="padding: 10px; text-align: right;">${it.quantity} ${it.unit}</td>
          <td style="padding: 10px; text-align: right;">$${Number(it.estimatedUnitCost).toLocaleString('es-AR')}</td>
          <td style="padding: 10px; text-align: right;">$${(Number(it.quantity) * Number(it.estimatedUnitCost)).toLocaleString('es-AR')}</td>
        </tr>
      `).join('');
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Presupuesto - ${order.code}</title>
          <style>
            body { font-family: 'Arial', sans-serif; padding: 40px; color: #000; margin: 0; }
            .header { border-bottom: 2px solid #ccc; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; }
            .brand { display: flex; align-items: flex-end; gap: 18px; }
            .brand-logo { width: 118px; height: auto; display: block; }
            h1 { margin: 0; font-size: 28px; text-transform: uppercase; letter-spacing: 1px; color: #000; }
            h2 { margin: 10px 0 0 0; font-size: 16px; color: #555; }
            .date { font-size: 14px; font-weight: bold; }
            .info { margin-bottom: 30px; font-size: 15px; line-height: 1.6; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px; }
            th { background: #f5f5f5; padding: 10px; text-align: left; border-bottom: 1px solid #ccc; }
            .total-box { margin-top: 30px; border-top: 2px solid #ccc; padding-top: 20px; text-align: right; }
            .total-title { font-size: 16px; color: #555; margin-bottom: 5px; }
            .total-amount { font-size: 24px; font-weight: bold; color: #000; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="brand">
              <img class="brand-logo" src="${brandLogoUrl}" alt="DISAL Planta de Látex" />
              <div>
                <h1>Presupuesto</h1>
                <h2>Orden: ${order.code}</h2>
              </div>
            </div>
            <div class="date">Fecha: ${new Date().toLocaleDateString('es-AR')}</div>
          </div>
          <div class="info">
            <p><strong>Cliente:</strong> ${order.client.name}${order.client.email ? ` | ${order.client.email}` : ''}${order.client.phone ? ` | ${order.client.phone}` : ''}</p>
            <p><strong>Casilla / Proyecto:</strong> ${order.title}</p>
            ${order.description ? `<p><strong>Detalle:</strong> ${order.description}</p>` : ''}
            ${order.purchaseOrderNumber ? `<p><strong>OC del Cliente:</strong> ${order.purchaseOrderNumber}</p>` : ''}
            ${order.validUntil ? `<p><strong>Validez de la oferta:</strong> ${new Date(order.validUntil).toLocaleDateString('es-AR')}</p>` : ''}
          </div>
          ${itemsHtml ? `
            <table>
              <thead>
                <tr>
                  <th>Item / Descripción</th>
                  <th style="text-align: right;">Cant.</th>
                  <th style="text-align: right;">Unit.</th>
                  <th style="text-align: right;">Importe</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
            </table>
          ` : ''}
          <div class="total-box">
            <div class="total-title">Total Estimado</div>
            <div class="total-amount">$${Number(order.estimatedCost).toLocaleString('es-AR')}</div>
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

  return (
    <div className="commercial-section" style={{ display: 'grid', gap: '1.25rem' }}>
      {/* Header */}
      <div className="commercial-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="commercial-heading" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <FileText size={18} style={{ color: 'var(--primary)' }} />
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Presupuesto</h3>
            <small style={{ color: 'var(--ink-muted)' }}>Presupuesto — {order.code}</small>
          </div>
          <div style={{
            padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700,
            background: `color-mix(in srgb, ${CS_COLOR[cs as CommercialStatus]} 15%, transparent 85%)`,
            color: CS_COLOR[cs as CommercialStatus],
            border: `1px solid color-mix(in srgb, ${CS_COLOR[cs as CommercialStatus]} 40%, transparent 60%)`
          }}>
            {CS_LABEL[cs as CommercialStatus]}
          </div>
        </div>

        <div className="commercial-actions" style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handlePrint}
            title="Descargar presupuesto (PDF)"
          >
            <Printer size={13} /> PDF
          </button>
          
          {canManageCommercial && Boolean(order.commercialStatus) && (
            <>
              {(cs === 'BORRADOR' || cs === 'ENVIADO') && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowApprove(true)}
                  id="btn-approve-order"
                >
                  <Check size={14} /> Aprobar
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Sin fase comercial badge */}
      {!hasBudget && (
        <div style={{ padding: '0.6rem 1rem', borderRadius: '0.5rem', background: 'color-mix(in srgb, var(--ink-muted) 10%, var(--panel) 90%)', border: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--ink-muted)', textAlign: 'center' }}>
          Sin presupuesto — orden de producción creada directamente
        </div>
      )}

      {hasBudget && (
        <>
          {/* Estado + cambio rapido */}
          {canManageCommercial && Boolean(order.commercialStatus) && (
            <div className="commercial-status-editor" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.75rem', background: 'var(--panel)', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, flex: 1 }}>Cambiar estado:</span>
              <select
                className="input"
                style={{ paddingTop: '0.2rem', paddingBottom: '0.2rem', minWidth: '140px', fontSize: '0.85rem' }}
                value={statusDraft}
                onChange={e => setStatusDraft(e.target.value as CommercialStatus)}
              >
                {(['BORRADOR', 'ENVIADO', 'APROBADO', 'RECHAZADO', 'VENCIDO'] as CommercialStatus[]).map(s => (
                  <option key={s} value={s}>{CS_LABEL[s]}</option>
                ))}
              </select>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleStatusChange}
                disabled={loading || statusDraft === order.commercialStatus}
              >
                {loading ? <span className="spinner-xs" /> : <Save size={13} />}
                Actualizar
              </button>
            </div>
          )}

          {/* Fechas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem' }}>
            {order.validUntil && (
              <div style={{ padding: '0.6rem', background: 'var(--panel)', borderRadius: '0.5rem', border: `1px solid ${isExpired ? 'var(--destructive)' : 'var(--border)'}` }}>
                <p style={{ fontSize: '0.7rem', color: isExpired ? 'var(--destructive)' : 'var(--ink-muted)', fontWeight: 600, margin: '0 0 0.25rem', display: 'flex', gap: '0.3rem' }}>
                  <Calendar size={12} /> Válido hasta {isExpired ? '(VENCIDO)' : ''}
                </p>
                <p style={{ fontWeight: 700, fontSize: '0.9rem', margin: 0, color: isExpired ? 'var(--destructive)' : 'inherit' }}>
                  {formatDate(order.validUntil)}
                </p>
              </div>
            )}
            {order.approvedAt && (
              <div style={{ padding: '0.6rem', background: 'color-mix(in srgb, var(--success) 8%, var(--panel) 92%)', borderRadius: '0.5rem', border: '1px solid color-mix(in srgb, var(--success) 30%, transparent 70%)' }}>
                <p style={{ fontSize: '0.7rem', color: 'var(--success)', fontWeight: 600, margin: '0 0 0.25rem' }}>Aprobado el</p>
                <p style={{ fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>{formatDate(order.approvedAt)}</p>
              </div>
            )}
          </div>

          {/* Items */}
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              Items del presupuesto
            </h4>
            {(order.items?.length ?? 0) > 0 ? (
              <div className="premium-table-wrap">
                <table className="premium-table" id="quotation-items-table" style={{ fontSize: '0.83rem' }}>
                  <thead>
                    <tr>
                      <th>Descripción</th>
                      <th style={{ textAlign: 'right' }}>Cant.</th>
                      <th>Unidad</th>
                      <th style={{ textAlign: 'right' }}>$/u</th>
                      <th style={{ textAlign: 'right' }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items?.map((item: OrderItem) => (
                      <tr key={item.id}>
                        <td>{item.description}</td>
                        <td style={{ textAlign: 'right' }}>{Number(item.quantity).toLocaleString('es-AR')}</td>
                        <td>{item.unit}</td>
                        <td style={{ textAlign: 'right' }}>${Number(item.estimatedUnitCost).toLocaleString('es-AR')}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>
                          ${(Number(item.quantity) * Number(item.estimatedUnitCost)).toLocaleString('es-AR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '1rem', border: '1px dashed var(--border)', borderRadius: '0.5rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--ink-muted)' }}>
                No hay ítems cargados. 
              </div>
            )}
          </div>

          {/* Costing Hours */}
          {(order.costingHours?.length ?? 0) > 0 && (
            <div>
              <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem' }}>
                Costeo de horas
              </h4>
              <div style={{ display: 'grid', gap: '0.3rem' }}>
                {order.costingHours?.map((h: OrderCostingHour) => (
                  <div key={h.id} className="commercial-costing-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.6rem', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '0.35rem', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 600 }}>{h.label}</span>
                    <span>{Number(h.hours)}h × ${Number(h.ratePerHour).toLocaleString('es-AR')}/h = <strong style={{ color: 'var(--success)' }}>${(Number(h.hours) * Number(h.ratePerHour)).toLocaleString('es-AR')}</strong></span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Totales */}
          {(itemsTotal > 0 || hoursTotal > 0) && (
            <div style={{ display: 'grid', gap: '0.4rem' }}>
              {itemsTotal > 0 && <MoneyLine label="Subtotal items" value={itemsTotal} />}
              {hoursTotal > 0 && <MoneyLine label="Subtotal horas" value={hoursTotal} />}
              <MoneyLine label="Total estimado" value={Number(order.estimatedCost)} highlight />
            </div>
          )}

          {order.estimatedMaterials && (
            <div style={{ padding: '0.6rem 0.8rem', background: 'var(--panel)', borderRadius: '0.5rem', border: '1px solid var(--border)', fontSize: '0.85rem' }}>
              <strong style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--ink-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Materiales estimados</strong>
              {order.estimatedMaterials}
            </div>
          )}
        </>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {/* Dialog de aprobación */}
      {showApprove && (
        <ApproveDialog
          orderId={order.id}
          orderCode={order.code}
          onSuccess={() => { setShowApprove(false); onRefresh(); }}
          onCancel={() => setShowApprove(false)}
          alreadyInProduction={inProduction}
        />
      )}
    </div>
  );
}
