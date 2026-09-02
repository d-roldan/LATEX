import { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listOrders, getOrderStats, type ListOrdersParams } from './api/ordersApi';
import { OrderList } from './components/OrderList';
import { OrderDetail } from './components/OrderDetail';
import { CreateOrderModal } from './components/CreateOrderModal';
import { getSessionUser } from '../auth/session';
import { Package, Search, Plus, RefreshCw, FileText, Clock, CheckCircle2, XCircle, ShoppingCart } from 'lucide-react';

type Tab = 'all' | 'quotations' | 'production' | 'closed' | 'noPurchaseOrder';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'Todos', icon: <Package size={14} /> },
  { id: 'quotations', label: 'Presupuestos', icon: <FileText size={14} /> },
  { id: 'production', label: 'En Producción', icon: <Clock size={14} /> },
  { id: 'closed', label: 'Cerrados', icon: <CheckCircle2 size={14} /> },
  { id: 'noPurchaseOrder', label: 'Sin Orden de Compra', icon: <ShoppingCart size={14} /> },
];

export function OrdersPage() {
  const queryClient = useQueryClient();
  const user = getSessionUser();
  const userRole = user?.role ?? '';
  const location = useLocation();
  const navigate = useNavigate();
  const navigationState = location.state as
    { tab?: Tab; orderId?: string; highlightOrderId?: string; highlightStageId?: string } | null;

  const [activeTab, setActiveTab] = useState<Tab>(navigationState?.tab ?? 'all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(navigationState?.orderId ?? null);
  const [showCreate, setShowCreate] = useState(false);
  const [highlightRequest, setHighlightRequest] = useState<{ stageId?: string; nonce: string } | null>(null);

  // Permite abrir una orden puntual desde otras pantallas (tablero, supervisor, notificaciones)
  // vía navigate(state). Se lee de location.key (no de navigationState?.orderId) para que también
  // funcione si el usuario ya está en /orders cuando llega la notificación.
  useEffect(() => {
    if (!navigationState?.orderId) return;
    setActiveTab(navigationState.tab ?? 'all');
    setSelectedId(navigationState.orderId);
    if (navigationState.highlightOrderId) {
      setHighlightRequest({ stageId: navigationState.highlightStageId, nonce: location.key });
    }
    navigate(location.pathname, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  const filters = useMemo((): ListOrdersParams => {
    const params: ListOrdersParams = {};
    if (activeTab !== 'all') params.tab = activeTab;
    if (search.trim()) params.search = search.trim();
    return params;
  }, [activeTab, search]);

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['orders', filters],
    queryFn: () => listOrders(filters),
    staleTime: 10000
  });

  const { data: stats } = useQuery({
    queryKey: ['orders-stats'],
    queryFn: getOrderStats,
    staleTime: 30000
  });

  const handleCreateSuccess = () => {
    setShowCreate(false);
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['orders-stats'] });
  };

  const handleSelectOrder = (id: string) => {
    setSelectedId(prev => prev === id ? null : id);
  };

  const canCreate = ['DUENO', 'SUPERVISOR', 'ADMIN'].includes(userRole);

  return (
    <div className="stack-lg page-enter orders-page">

      {/* HERO */}
      <header className="page-hero panel stagger-1">
        <div className="page-hero__left">
          <p className="eyebrow" style={{ color: 'var(--primary)' }}>📦 GESTIÓN UNIFICADA</p>
          <h2 className="page-hero__title">Órdenes de Producción</h2>
          <p className="page-hero__sub">
            Presupuestos y órdenes de trabajo en un solo lugar. Un código, dos fases.
          </p>
        </div>
        <div className="page-hero__actions">
          {stats && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {stats.pendingQuotations > 0 && (
                <div style={{
                  padding: '0.4rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 700,
                  background: 'var(--color-warning-surface)',
                  color: 'var(--color-warning)', border: '1px solid color-mix(in srgb, var(--color-warning) 35%, transparent)'
                }}>
                  {stats.pendingQuotations} presup. pendientes
                </div>
              )}
              <div style={{
                padding: '0.4rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 700,
                background: 'color-mix(in srgb, var(--primary) 12%, transparent 88%)',
                color: 'var(--primary)', border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent 70%)'
              }}>
                {stats.total} en total
              </div>
            </div>
          )}
          {canCreate && (
            <button
              className="btn btn-primary"
              id="btn-new-order"
              onClick={() => setShowCreate(true)}
            >
              <Plus size={16} /> Nueva Orden
            </button>
          )}
        </div>
      </header>

      {/* STATS KPI mini */}
      {stats && (
        <section className="stagger-2 orders-kpis" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {[
            { label: 'En proceso', value: stats.production.EN_PROCESO ?? 0, color: 'var(--color-industrial)' },
            { label: 'No iniciadas', value: (stats.production.PENDIENTE ?? 0) + (stats.production.PLANIFICADA ?? 0), color: 'var(--color-text-muted)' },
            { label: 'Finalizadas', value: stats.production.FINALIZADA ?? 0, color: 'var(--color-success)' },
            { label: 'Entregadas', value: stats.production.ENTREGADA ?? 0, color: 'var(--color-success)' },
            { label: 'Vencidas/err', value: (stats.production.CANCELADA ?? 0) + (stats.commercial?.VENCIDO ?? 0), color: 'var(--color-danger)' },
          ].map(kpi => (
            <div key={kpi.label} style={{
              padding: '0.5rem 0.9rem', borderRadius: '0.6rem',
              background: `color-mix(in srgb, ${kpi.color} 10%, var(--panel) 90%)`,
              border: `1px solid color-mix(in srgb, ${kpi.color} 25%, transparent 75%)`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '80px'
            }}>
              <span style={{ fontSize: '1.35rem', fontWeight: 800, color: kpi.color }}>{kpi.value}</span>
              <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center' }}>{kpi.label}</span>
            </div>
          ))}
        </section>
      )}

      {/* TABS */}
      <section className="stagger-3">
        {/* Tab bar */}
        <div className="orders-tabs-toolbar" style={{
          display: 'flex', gap: '0.25rem', flexWrap: 'wrap',
          borderBottom: '2px solid var(--border)', marginBottom: '1rem', paddingBottom: '0'
        }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              id={`tab-orders-${tab.id}`}
              onClick={() => { setActiveTab(tab.id); setSelectedId(null); }}
              style={{
                padding: '0.5rem 1rem', borderRadius: '0.4rem 0.4rem 0 0', fontWeight: 600, fontSize: '0.85rem',
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
                background: activeTab === tab.id ? 'var(--panel)' : 'transparent',
                color: activeTab === tab.id ? 'var(--primary)' : 'var(--ink-muted)',
                borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                marginBottom: '-2px', transition: 'all 0.15s'
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}

          {/* Search */}
          <div className="orders-search-tools" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', paddingBottom: '0.4rem' }}>
            <div className="orders-search-field" style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-muted)' }} />
              <input
                type="search"
                placeholder="Buscar OP, título, cliente u OC..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                id="orders-search"
                style={{
                  padding: '0.4rem 0.75rem 0.4rem 2rem', border: '1px solid var(--border)',
                  borderRadius: '0.4rem', background: 'var(--panel)', color: 'var(--ink)',
                  fontSize: '0.83rem', minWidth: '220px'
                }}
              />
            </div>
            <button
              className="btn-icon"
              onClick={() => refetch()}
              title="Recargar"
              aria-label="Recargar lista"
            >
              <RefreshCw size={14} />
            </button>
            <span style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', whiteSpace: 'nowrap' }}>
              {orders.length} resultado{orders.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Modal Detail rendering handled internally by OrderDetail now */}

        {/* List */}
        <OrderList
          orders={orders}
          loading={isLoading}
          selectedId={selectedId}
          onSelect={handleSelectOrder}
          onDeselect={() => setSelectedId(null)}
        />
      </section>

      {/* Create modal */}
      {showCreate && (
        <CreateOrderModal
          onSuccess={handleCreateSuccess}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {selectedId && (
        <OrderDetail
          orderId={selectedId}
          userRole={userRole}
          onClose={() => setSelectedId(null)}
          highlightStageId={highlightRequest?.stageId}
          highlightNonce={highlightRequest?.nonce}
        />
      )}
    </div>
  );
}
