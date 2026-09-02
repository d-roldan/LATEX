import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getOrder, deleteOrder } from '../api/ordersApi';
import { CommercialSection } from './CommercialSection';
import { ProductionSection } from './ProductionSection';
import { EditQuotationModal } from './EditQuotationModal';
import { X, Trash2, ChevronLeft, ExternalLink, Edit2, FileText, Cpu } from 'lucide-react';
import { getSessionUser } from '../../auth/session';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { StageFlowSection } from './StageFlowSection';
import { useHighlightTarget } from '../../../shared/utils/highlightTarget';

interface Props {
  orderId: string;
  onClose: () => void;
  userRole: string;
  highlightStageId?: string;
  highlightNonce?: string;
}

export function OrderDetail({ orderId, onClose, userRole, highlightStageId, highlightNonce }: Props) {
  const queryClient = useQueryClient();
  const user = getSessionUser();
  const [activeTab, setActiveTab] = useState<'commercial' | 'production'>('production');
  const [showEdit, setShowEdit] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: order, isLoading, refetch } = useQuery({
    queryKey: ['order-detail', orderId],
    queryFn: () => getOrder(orderId),
    staleTime: 5000
  });

  // Si la notificación trae una etapa puntual se resalta esa tarjeta; si no, el popup entero.
  useHighlightTarget(
    highlightNonce ? (highlightStageId ? `order-stage-${highlightStageId}` : 'order-detail-panel') : null,
    highlightNonce
  );

  // La tarjeta de la etapa vive en la pestaña "Producción": si el usuario estaba en
  // "Comercial" cuando llega la notificación, hay que traerlo de vuelta para que exista en el DOM.
  useEffect(() => {
    if (highlightStageId && highlightNonce) setActiveTab('production');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightNonce]);

  const handleRefresh = async () => {
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: ['orders'] }),
      queryClient.invalidateQueries({ queryKey: ['orders-stats'] })
    ]);
  };

  const handleDeleteConfirmed = async () => {
    if (!order) return;
    setDeleting(true);
    try {
      await deleteOrder(order.id);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setConfirmDeleteOpen(false);
      onClose();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Error al eliminar la orden');
    } finally {
      setDeleting(false);
    }
  };


  if (isLoading || !order) {
    return createPortal(
      <div className="modal-overlay">
        <div className="modal-panel" style={{ padding: '3rem', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem' }} />
          Cargando detalle de la orden...
        </div>
      </div>,
      document.body
    );
  }

  const canDelete = ['DUENO', 'ADMIN'].includes(userRole) &&
    order.productionStatus !== 'EN_PROCESO';

  return createPortal(
    <div
      className="modal-overlay modal-overlay--focus"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="modal-panel"
        id="order-detail-panel"
        style={{
          maxWidth: '1200px',
          width: '95%',
          minHeight: '85vh',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '1.5rem',
          display: 'grid',
          gridTemplateRows: 'auto auto 1fr',
          gap: '0',
          animation: 'slideUp 0.3s ease'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div className="no-print order-detail-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
          <div className="order-detail-heading">
            <div className="order-detail-code" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
              <button
                className="btn-icon"
                onClick={onClose}
                title="Volver"
                aria-label="Cerrar detalle"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="dash-order-code" style={{ fontSize: '1rem' }}>{order.code}</span>
              {order.purchaseOrderNumber && (
                <span style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', border: '1px solid var(--border)', borderRadius: '0.35rem', padding: '0.15rem 0.5rem' }}>
                  OC: {order.purchaseOrderNumber}
                </span>
              )}
            </div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>{order.title}</h2>
            <p style={{ margin: '0.25rem 0 0', color: 'var(--ink-muted)', fontSize: '0.9rem' }}>
              {order.client.name}
              {order.description && ` - ${order.description}`}
            </p>
          </div>

          <div className="order-detail-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
            {canDelete && ( /* Si no se borra, se edita al menos! canDelete here limits to not EN_PROCESO, but let's separate edit lock */ null )}
            {['DUENO', 'SUPERVISOR', 'ADMIN'].includes(userRole) && !['ENTREGADA', 'CANCELADA'].includes(order.productionStatus || '') && (
               <button
                 className="btn btn-secondary btn-sm order-detail-edit-button"
                 onClick={() => setShowEdit(true)}
                 title="Editar datos de la orden"
               >
                 <Edit2 size={13} /> Editar OP
               </button>
            )}
            {order.dashboardUrl && (
              <a href={order.dashboardUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                <ExternalLink size={13} /> IoT Dashboard
              </a>
            )}
            {canDelete && (
              <button
                className="btn btn-sm"
                style={{ color: 'var(--destructive)', border: '1px solid var(--destructive)', background: 'transparent' }}
                onClick={() => setConfirmDeleteOpen(true)}
                id="btn-delete-order"
                title="Eliminar orden"
              >
                <Trash2 size={13} />
              </button>
            )}
            <button className="btn-icon" onClick={onClose} aria-label="Cerrar">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* CONTENEDOR TABS */}
        <div className="no-print order-detail-tabs" style={{ display: 'flex', gap: '1.5rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem', paddingBottom: '0.5rem' }}>
          <button
            onClick={() => setActiveTab('commercial')}
            style={{
              background: 'transparent', border: 'none', 
              fontSize: '1rem', fontWeight: 700, 
              color: activeTab === 'commercial' ? 'var(--primary)' : 'var(--ink-muted)',
              borderBottom: activeTab === 'commercial' ? '2px solid var(--primary)' : '2px solid transparent',
              paddingBottom: '0.5rem', marginBottom: '-0.6rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s'
            }}
          >
            <FileText size={16} /> Presupuestos
          </button>
          <button
            onClick={() => setActiveTab('production')}
            style={{
              background: 'transparent', border: 'none', 
              fontSize: '1rem', fontWeight: 700, 
              color: activeTab === 'production' ? 'var(--success)' : 'var(--ink-muted)',
              borderBottom: activeTab === 'production' ? '2px solid var(--success)' : '2px solid transparent',
              paddingBottom: '0.5rem', marginBottom: '-0.6rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s'
            }}
          >
            <Cpu size={16} /> Orden de Producción
          </button>
        </div>

        {/* CONTENIDO ACTIVO */}
        <div className="no-print order-detail-content">
          {activeTab === 'commercial' && (
            <div style={{
              padding: '1.25rem',
              background: 'var(--background)',
              borderRadius: '0.6rem',
              border: '1px solid color-mix(in srgb, var(--primary) 20%, var(--border) 80%)',
            }}>
              <CommercialSection
                order={order}
                userRole={userRole}
                onRefresh={handleRefresh}
              />
            </div>
          )}

          {activeTab === 'production' && (
            <div style={{
              padding: '1.25rem',
              background: 'var(--background)',
              borderRadius: '0.6rem',
              border: '1px solid color-mix(in srgb, var(--success) 20%, var(--border) 80%)',
            }}>
              <StageFlowSection order={order} userRole={userRole} onRefresh={handleRefresh} />
              <ProductionSection
                order={order}
                userRole={userRole}
                userId={user?.id ?? ''}
                onRefresh={handleRefresh}
              />
            </div>
          )}
        </div>
      </div>
      
      {showEdit && (
        <EditQuotationModal
          order={order}
          onSuccess={async (updatedOrder) => {
            queryClient.setQueryData(['order-detail', orderId], (current: typeof order | undefined) => (
              current ? { ...current, ...updatedOrder } : updatedOrder
            ));
            await handleRefresh();
            setShowEdit(false);
          }}
          onCancel={() => setShowEdit(false)}
        />
      )}
      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={`Eliminar ${order.code}`}
        description="Esta accion borra la orden y revierte consumos asociados. Usala solo si se trata de un registro creado por error."
        confirmLabel="Eliminar orden"
        cancelLabel="Conservar"
        variant="destructive"
        isPending={deleting}
        onConfirm={handleDeleteConfirmed}
      />
    </div>,
    document.body
  );
}
