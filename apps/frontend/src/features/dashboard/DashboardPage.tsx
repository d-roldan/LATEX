import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  DollarSign,
  Factory,
  Gauge,
  PackageCheck,
  RefreshCw,
  TrendingUp,
  UserRound,
  WalletCards
} from 'lucide-react';
import { api } from '../../shared/api/http';
import { Badge } from '../../shared/ui/Badge';
import { Card } from '../../shared/ui/Card';

interface ProductionOrderLite {
  id: string;
  code: string;
  title: string;
  productionStatus: string;
  commitmentDate?: string | null;
  client: { name: string };
  stages: Array<{
    id: string;
    status: string;
    isQualityGate?: boolean;
    assignments: Array<{ user?: { id: string; fullName: string } | null }>;
  }>;
}

interface OperatorUser {
  id: string;
  fullName: string;
}

interface ExecutivePeriodSummary {
  revenue: number;
  materialCost: number;
  margin: number;
  workedHours: number;
  closedOrders: number;
}

interface DashboardResponse {
  kpis: {
    openCount: number;
    inProcessCount: number;
    finishedCount: number;
    delayedCount: number;
    hoursToday: number;
    operatorsActive: number;
    pendingQuotations?: number;
    alerts: { total: number; warning: number; critical: number };
  };
  managementAnnual: {
    periodLabel: string;
    closedOrders: number;
    avgHoursPerOrder: number;
    revenueEstimated: number;
    materialCostReal: number;
    gainEstimated: number;
    lossEstimated: number;
    marginEstimated: number;
  };
  executiveSummary?: {
    current: ExecutivePeriodSummary;
    previous: ExecutivePeriodSummary;
  };
  economicEvolution?: {
    granularity: 'daily' | 'monthly';
    buckets: Array<{
      key: string;
      label: string;
      revenue: number;
      materialCost: number;
      margin: number;
      closedOrders: number;
    }>;
  };
  monthlyManagement: Array<{
    monthKey: string;
    monthLabel: string;
    closedOrders: number;
    totalWorkedHours: number;
    avgHours: number;
    revenue: number;
    materialCost: number;
    gain: number;
    loss: number;
  }>;
  profitableJobs?: Array<{
    id: string;
    code: string;
    title: string;
    client: string;
    revenue: number;
    materialCost: number;
    workedHours: number;
    estimatedHours: number;
    margin: number;
    marginPct: number;
    badge?: 'top' | 'low-margin' | 'hours';
  }>;
  profitableClients?: Array<{
    clientId: string;
    clientName: string;
    revenue: number;
    materialCost: number;
    margin: number;
    workedHours: number;
    orders: number;
    marginPct: number;
  }>;
  statusBreakdown: Array<{ status: string; count: number }>;
  deviationAlerts: Array<{ id: string; code: string; client: string; severity: 'warning' | 'critical'; reasons: string[] }>;
  delayedOrders: Array<{ id: string; code: string; title: string; commitmentDate: string }>;
}

type QuickRange = 'last6months' | 'last3months' | 'last30' | 'year' | 'all';
type RangeMode = QuickRange | 'custom';

const QUICK_RANGES: Array<{ key: QuickRange; label: string }> = [
  { key: 'last6months', label: '\u00daltimos 6 meses' },
  { key: 'last3months', label: '\u00daltimos 3 meses' },
  { key: 'last30', label: '\u00daltimos 30 d\u00edas' },
  { key: 'year', label: 'A\u00f1o actual' },
  { key: 'all', label: 'Todo el per\u00edodo' }
];

function toCurrency(value: number): string {
  return `$${Math.round(value || 0).toLocaleString('es-AR')}`;
}

function toNumber(value: number, digits = 0): string {
  return (value || 0).toLocaleString('es-AR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  });
}

function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isoDateTime(date: Date): string {
  return date.toISOString();
}

function dateInputValue(value: string): string {
  return value.slice(0, 10);
}

function formatPeriodValue(value: string): string {
  if (value.includes('T')) {
    return new Date(value).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  return value;
}

function getQuickRange(range: QuickRange) {
  const today = new Date();
  const year = today.getFullYear();
  let from = new Date(year, 0, 1);
  let to = today;

  if (range === 'last6months') {
    from = new Date(today);
    from.setMonth(today.getMonth() - 6);
  }

  if (range === 'last3months') {
    from = new Date(today);
    from.setMonth(today.getMonth() - 3);
  }

  if (range === 'last30') {
    from = new Date(today);
    from.setDate(today.getDate() - 30);
    return { from: isoDateTime(from), to: isoDateTime(today) };
  }

  if (range === 'all') {
    from = new Date(2026, 0, 1);
  }

  return { from: isoDate(from), to: isoDate(to) };
}

function pctChange(current: number, previous: number) {
  if (!previous && !current) return 0;
  if (!previous) return 100;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function Trend({ value, inverse = false }: { value: number; inverse?: boolean }) {
  const good = inverse ? value <= 0 : value >= 0;
  const Icon = good ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`exec-trend ${good ? 'exec-trend--good' : 'exec-trend--bad'}`}>
      <Icon size={14} />
      {Math.abs(value).toFixed(1)}% vs per&iacute;odo anterior
    </span>
  );
}

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="exec-tooltip">
      <p>{label}</p>
      {payload.map((entry) => (
        <span key={entry.name} style={{ color: entry.color }}>
          {entry.name}: <strong>{toCurrency(entry.value)}</strong>
        </span>
      ))}
    </div>
  );
};

export function DashboardPage() {
  const initialRange = useMemo(() => getQuickRange('year'), []);
  const [range, setRange] = useState<RangeMode>('year');
  const [customFrom, setCustomFrom] = useState(initialRange.from);
  const [customTo, setCustomTo] = useState(initialRange.to);
  const [draftFrom, setDraftFrom] = useState(initialRange.from);
  const [draftTo, setDraftTo] = useState(initialRange.to);
  const [quickRefreshToken, setQuickRefreshToken] = useState(0);
  const selectedRange = useMemo(
    () => range === 'custom' ? { from: customFrom, to: customTo } : getQuickRange(range),
    [customFrom, customTo, quickRefreshToken, range]
  );

  const handleQuickRange = (key: QuickRange) => {
    const nextRange = getQuickRange(key);
    setRange(key);
    setDraftFrom(dateInputValue(nextRange.from));
    setDraftTo(dateInputValue(nextRange.to));
    setCustomFrom(dateInputValue(nextRange.from));
    setCustomTo(dateInputValue(nextRange.to));
    setQuickRefreshToken((current) => current + 1);
  };

  const applyCustomRange = () => {
    if (!draftFrom || !draftTo || draftFrom > draftTo) return;
    setRange('custom');
    setCustomFrom(draftFrom);
    setCustomTo(draftTo);
  };

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['dashboard-executive', range, selectedRange.from, selectedRange.to, quickRefreshToken],
    queryFn: async () => {
      const response = await api.get<DashboardResponse>('/reports/dashboard', {
        params: { from: selectedRange.from, to: selectedRange.to }
      });
      return response.data;
    }
  });

  // Estado operativo en vivo de la planta, independiente del rango de fechas del análisis financiero.
  const ordersQuery = useQuery({
    queryKey: ['dashboard-production-orders'],
    queryFn: async () => (await api.get<ProductionOrderLite[]>('/orders', { params: { tab: 'production' } })).data,
    refetchInterval: 30000
  });
  const operatorsQuery = useQuery({
    queryKey: ['dashboard-operators'],
    queryFn: async () => (await api.get<OperatorUser[]>('/users', { params: { role: 'OPERARIO', active: 'true' } })).data,
    refetchInterval: 30000
  });

  const awaitingApproval = useMemo(
    () => (ordersQuery.data ?? []).filter((order) =>
      order.stages.some((stage) => stage.isQualityGate && ['DISPONIBLE', 'EN_PROCESO', 'PAUSADA'].includes(stage.status))
    ),
    [ordersQuery.data]
  );

  const upcomingDeliveries = useMemo(() => {
    const now = Date.now();
    const horizon = now + 7 * 24 * 60 * 60 * 1000;
    return (ordersQuery.data ?? [])
      .filter((order) => !['FINALIZADA', 'ENTREGADA', 'CANCELADA'].includes(order.productionStatus))
      .filter((order) => {
        if (!order.commitmentDate) return false;
        const commitment = new Date(order.commitmentDate).getTime();
        return commitment >= now && commitment <= horizon;
      })
      .sort((a, b) => new Date(a.commitmentDate!).getTime() - new Date(b.commitmentDate!).getTime());
  }, [ordersQuery.data]);

  const operatorsWithoutWork = useMemo(() => {
    const actionableStatuses = new Set(['DISPONIBLE', 'PAUSADA', 'RETRABAJO', 'EN_PROCESO']);
    const busyOperatorIds = new Set<string>();
    (ordersQuery.data ?? [])
      .filter((order) => !['ENTREGADA', 'CANCELADA'].includes(order.productionStatus))
      .forEach((order) => order.stages.forEach((stage) => {
        if (!actionableStatuses.has(stage.status)) return;
        stage.assignments.forEach((assignment) => {
          if (assignment.user) busyOperatorIds.add(assignment.user.id);
        });
      }));
    return (operatorsQuery.data ?? []).filter((operator) => !busyOperatorIds.has(operator.id));
  }, [operatorsQuery.data, ordersQuery.data]);

  if (isLoading) {
    return (
      <div className="dash-loading-state">
        <div className="dash-loading-spinner" />
        <p>Cargando tablero ejecutivo...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="dash-error-state">
        <AlertTriangle size={34} />
        <p>No se pudo cargar el tablero. Verifique la conexi&oacute;n con el servidor.</p>
        <button onClick={() => refetch()} className="btn btn-primary">Reintentar</button>
      </Card>
    );
  }

  const summary = data.executiveSummary?.current ?? {
    revenue: data.managementAnnual.revenueEstimated,
    materialCost: data.managementAnnual.materialCostReal,
    margin: data.managementAnnual.marginEstimated,
    workedHours: data.managementAnnual.avgHoursPerOrder * data.managementAnnual.closedOrders,
    closedOrders: data.managementAnnual.closedOrders
  };
  const previous = data.executiveSummary?.previous ?? { revenue: 0, materialCost: 0, margin: 0, workedHours: 0, closedOrders: 0 };
  const marginPct = summary.revenue > 0 ? (summary.margin / summary.revenue) * 100 : 0;
  const materialPct = summary.revenue > 0 ? (summary.materialCost / summary.revenue) * 100 : 0;

  const evolutionBuckets = data.economicEvolution?.buckets ?? data.monthlyManagement.map((month) => ({
    key: month.monthKey,
    label: month.monthLabel,
    revenue: month.revenue,
    materialCost: month.materialCost,
    margin: month.revenue - month.materialCost,
    closedOrders: month.closedOrders
  }));
  const chartData = evolutionBuckets.map((bucket) => ({
    mes: bucket.label,
    Facturacion: Math.round(bucket.revenue),
    Materiales: Math.round(bucket.materialCost),
    Margen: Math.round(bucket.margin),
    OTs: bucket.closedOrders
  }));
  const chartGranularity = data.economicEvolution?.granularity ?? 'monthly';

  const workshopState = {
    active: data.kpis.inProcessCount,
    finished: data.kpis.finishedCount,
    pending: Math.max(0, data.kpis.openCount - data.kpis.inProcessCount)
  };

  const pausedCount = data.statusBreakdown
    .filter((item) => item.status === 'PAUSADA')
    .reduce((acc, item) => acc + item.count, 0);

  const materialAlerts = data.deviationAlerts.filter((alert) =>
    alert.reasons.some((reason) => reason.toLowerCase().includes('costo'))
  ).length;
  const hourAlerts = data.deviationAlerts.filter((alert) =>
    alert.reasons.some((reason) => reason.toLowerCase().includes('tiempo'))
  ).length;

  return (
    <div className="exec-dashboard page-enter">
      <header className="exec-header panel">
        <div>
          <p className="eyebrow">Dashboard Ejecutivo</p>
          <h2>Control real de la planta</h2>
          <p>Facturaci&oacute;n, costos, margen y alertas para decidir r&aacute;pido.</p>
          <span className="exec-period-note">
            Per&iacute;odo analizado: {formatPeriodValue(selectedRange.from)} al {formatPeriodValue(selectedRange.to)}
          </span>
        </div>
        <div className="exec-header__actions">
          <div className="exec-filters" aria-label={'Filtros r\u00e1pidos'}>
            {QUICK_RANGES.map((item) => (
              <button
                key={item.key}
                type="button"
                className={range === item.key ? 'is-active' : ''}
                onClick={() => handleQuickRange(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="exec-date-range" aria-label="Rango manual">
            <label>
              <span>Desde</span>
              <input
                type="date"
                min="2026-01-01"
                value={draftFrom}
                onChange={(event) => setDraftFrom(event.target.value)}
              />
            </label>
            <label>
              <span>Hasta</span>
              <input
                type="date"
                min="2026-01-01"
                value={draftTo}
                onChange={(event) => setDraftTo(event.target.value)}
              />
            </label>
            <button
              type="button"
              className={range === 'custom' ? 'is-active' : ''}
              onClick={applyCustomRange}
              disabled={!draftFrom || !draftTo || draftFrom > draftTo}
            >
              Aplicar
            </button>
          </div>
          <button
            className="exec-icon-button"
            type="button"
            title="Actualizar datos"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw size={18} className={isFetching ? 'spin-anim' : ''} />
          </button>
        </div>
      </header>

      <section className="stagger-2" aria-label="Requiere tu atención">
        <p className="dash-group-label">🔔 Requiere tu atención</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>

          <Card className={operatorsWithoutWork.length ? 'attention-card attention-card--critical' : 'attention-card'}>
            <div className="section-head-inline" style={{ marginBottom: '.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '.92rem' }}>👷 Operarios sin trabajo disponible</h3>
              <Badge variant={operatorsWithoutWork.length ? 'destructive' : 'default'}>{operatorsWithoutWork.length}</Badge>
            </div>
            {operatorsWithoutWork.length === 0 ? (
              <p className="exec-empty-note">Todos los operarios tienen alguna etapa disponible para trabajar.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '.4rem' }}>
                {operatorsWithoutWork.slice(0, 6).map((operator) => (
                  <li key={operator.id} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.85rem' }}>
                    <UserRound size={14} style={{ color: 'var(--destructive)' }} />
                    {operator.fullName}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="section-head-inline" style={{ marginBottom: '.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '.92rem' }}>✅ Control de calidad pendiente</h3>
              <Badge variant={awaitingApproval.length ? 'warning' : 'default'}>{awaitingApproval.length}</Badge>
            </div>
            {awaitingApproval.length === 0 ? (
              <p className="exec-empty-note">Ninguna OT esperando control de calidad.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '.5rem' }}>
                {awaitingApproval.slice(0, 5).map((order) => (
                  <li key={order.id} className="supervisor-queue-item">
                    <Link
                      to="/supervisor"
                      state={{ highlightOrderId: order.id }}
                      className="supervisor-queue-item__order"
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <span className="dash-order-code" style={{ fontSize: '.78rem' }}>{order.code}</span>
                      <span>{order.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {awaitingApproval.length > 0 && (
              <div className="supervisor-queue-footer">
                <span>{awaitingApproval.length} en total</span>
                <Link to="/supervisor" state={{ highlightOrderId: awaitingApproval[0]?.id }}>Revisar y aprobar <ArrowRight size={13} /></Link>
              </div>
            )}
          </Card>

          <Card>
            <div className="section-head-inline" style={{ marginBottom: '.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '.92rem' }}>🚨 Órdenes atrasadas</h3>
              <Badge variant={data.delayedOrders.length ? 'destructive' : 'default'}>{data.delayedOrders.length}</Badge>
            </div>
            {data.delayedOrders.length === 0 ? (
              <p className="exec-empty-note">Ninguna orden vencida respecto de su fecha comprometida.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '.5rem' }}>
                {data.delayedOrders.slice(0, 5).map((order) => (
                  <li key={order.id} className="supervisor-queue-item">
                    <Link
                      to="/orders"
                      state={{ tab: 'production', orderId: order.id, highlightOrderId: order.id }}
                      className="supervisor-queue-item__order"
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <span className="dash-order-code" style={{ fontSize: '.78rem' }}>{order.code}</span>
                      <span>{order.title}</span>
                    </Link>
                    <span style={{ fontSize: '.72rem', color: 'var(--destructive)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                      vencía {new Date(order.commitmentDate).toLocaleDateString('es-AR')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="section-head-inline" style={{ marginBottom: '.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '.92rem' }}>📦 Próximas a entregar (7 días)</h3>
              <Badge variant={upcomingDeliveries.length ? 'primary' : 'default'}>{upcomingDeliveries.length}</Badge>
            </div>
            {upcomingDeliveries.length === 0 ? (
              <p className="exec-empty-note">Sin compromisos de entrega en los próximos 7 días.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '.5rem' }}>
                {upcomingDeliveries.slice(0, 5).map((order) => (
                  <li key={order.id} className="supervisor-queue-item">
                    <Link
                      to="/orders"
                      state={{ tab: 'production', orderId: order.id, highlightOrderId: order.id }}
                      className="supervisor-queue-item__order"
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <span className="dash-order-code" style={{ fontSize: '.78rem' }}>{order.code}</span>
                      <span>{order.title}</span>
                    </Link>
                    <span style={{ fontSize: '.72rem', color: 'var(--ink-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                      {new Date(order.commitmentDate!).toLocaleDateString('es-AR')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

        </div>
      </section>

      <section className="exec-kpi-grid" aria-label="KPIs principales">
        <article className="exec-kpi-card">
          <div className="exec-kpi-card__top">
            <DollarSign size={22} />
            <Trend value={pctChange(summary.revenue, previous.revenue)} />
          </div>
          <p>Facturaci&oacute;n del per&iacute;odo</p>
          <strong>{toCurrency(summary.revenue)}</strong>
          <span>Total facturado en el rango seleccionado</span>
        </article>

        <article className="exec-kpi-card">
          <div className="exec-kpi-card__top">
            <PackageCheck size={22} />
            <Trend value={pctChange(summary.materialCost, previous.materialCost)} inverse />
          </div>
          <p>Costos de materiales</p>
          <strong>{toCurrency(summary.materialCost)}</strong>
          <span>{toNumber(materialPct, 1)}% de la facturaci&oacute;n</span>
        </article>

        <article className="exec-kpi-card exec-kpi-card--hero">
          <div className="exec-kpi-card__top">
            <TrendingUp size={24} />
            <Trend value={pctChange(summary.margin, previous.margin)} />
          </div>
          <p>Margen estimado</p>
          <strong>{toCurrency(summary.margin)}</strong>
          <span>{toNumber(marginPct, 1)}% de margen sobre facturaci&oacute;n</span>
        </article>

        <article className="exec-kpi-card">
          <div className="exec-kpi-card__top">
            <Clock3 size={22} />
            <Trend value={pctChange(summary.workedHours, previous.workedHours)} />
          </div>
          <p>Horas trabajadas</p>
          <strong>{toNumber(summary.workedHours, 1)} h</strong>
          <span>Horas registradas en OTs cerradas</span>
        </article>

        <article className="exec-kpi-card">
          <div className="exec-kpi-card__top">
            <CheckCircle2 size={22} />
            <Trend value={pctChange(summary.closedOrders, previous.closedOrders)} />
          </div>
          <p>OTs finalizadas</p>
          <strong>{summary.closedOrders}</strong>
          <span>Trabajos completados en el per&iacute;odo</span>
        </article>
      </section>

      <section className="exec-chart-panel panel">
        <div className="section-head-inline">
          <div className="section-head">
            <h3>Evoluci&oacute;n econ&oacute;mica</h3>
            <p>
              {chartGranularity === 'daily' ? (
                <>Lectura diaria del rango seleccionado: facturaci&oacute;n, materiales y margen acumulado.</>
              ) : (
                <>C&oacute;mo viene la planta mes a mes: facturaci&oacute;n, materiales y margen.</>
              )}
            </p>
          </div>
          <Badge variant={summary.margin >= 0 ? 'success' : 'destructive'}>
            Margen {summary.margin >= 0 ? 'positivo' : 'a revisar'}
          </Badge>
        </div>
        <ResponsiveContainer width="100%" height={310}>
          <AreaChart data={chartData} margin={{ top: 14, right: 24, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="execRevenue" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--color-info)" stopOpacity={0.24} />
                <stop offset="95%" stopColor="var(--color-info)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="execMargin" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 6" vertical={false} />
            <XAxis dataKey="mes" tick={{ fill: 'var(--ink-soft)', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--ink-soft)', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => `$${Math.round(value / 1000)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="Facturacion" name="Facturaci\u00f3n" stroke="var(--color-info)" strokeWidth={3} fill="url(#execRevenue)" />
            <Line type="monotone" dataKey="Materiales" stroke="var(--color-warning)" strokeWidth={3} dot={false} />
            <Area
              type="monotone"
              dataKey="Margen"
              name={chartGranularity === 'daily' ? 'Margen acumulado' : 'Margen'}
              stroke="var(--color-success)"
              strokeWidth={3}
              fill="url(#execMargin)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </section>

      <section className="exec-two-col">
        <article className="panel">
          <div className="section-head">
            <h3>Alertas operativas</h3>
            <p>Problemas que el sistema detecta para actuar r&aacute;pido.</p>
          </div>
          <div className="exec-alert-grid">
            <div className={`exec-alert-card ${data.kpis.delayedCount > 0 ? 'exec-alert-card--bad' : 'exec-alert-card--good'}`}>
              <CalendarDays size={20} />
              <strong>{data.kpis.delayedCount}</strong>
              <span>OTs demoradas</span>
            </div>
            <div className={`exec-alert-card ${pausedCount > 0 ? 'exec-alert-card--warn' : 'exec-alert-card--good'}`}>
              <Gauge size={20} />
              <strong>{pausedCount}</strong>
              <span>OTs pausadas</span>
            </div>
            <div className={`exec-alert-card ${hourAlerts > 0 ? 'exec-alert-card--warn' : 'exec-alert-card--good'}`}>
              <Clock3 size={20} />
              <strong>{hourAlerts}</strong>
              <span>Exceso de horas</span>
            </div>
            <div className={`exec-alert-card ${materialAlerts > 0 ? 'exec-alert-card--bad' : 'exec-alert-card--good'}`}>
              <WalletCards size={20} />
              <strong>{materialAlerts}</strong>
              <span>Materiales altos</span>
            </div>
          </div>
          {(data.deviationAlerts ?? []).length > 0 && (
            <ul className="exec-alert-list">
              {data.deviationAlerts.slice(0, 4).map((alert) => (
                <li key={alert.id}>
                  <span className={alert.severity === 'critical' ? 'is-critical' : 'is-warning'} />
                  <div>
                    <strong>{alert.code} - {alert.client}</strong>
                    <p>{alert.reasons.join(' - ')}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="panel">
          <div className="section-head">
            <h3>Clientes y actividad</h3>
            <p>Rentabilidad por cliente y estado r&aacute;pido de la planta.</p>
          </div>
          <div className="exec-workshop-state">
            <div>
              <Factory size={18} />
              <strong>{workshopState.active}</strong>
              <span>Activas</span>
            </div>
            <div>
              <CheckCircle2 size={18} />
              <strong>{workshopState.finished}</strong>
              <span>Finalizadas</span>
            </div>
            <div>
              <BriefcaseBusiness size={18} />
              <strong>{workshopState.pending}</strong>
              <span>Pendientes</span>
            </div>
          </div>
          <div className="exec-client-list">
            {(data.profitableClients ?? []).map((client, index) => (
              <div key={client.clientId} className="exec-client-row">
                <span>{index + 1}</span>
                <div>
                  <strong>{client.clientName}</strong>
                  <p>{client.orders} trabajos - {toNumber(client.marginPct, 1)}% margen</p>
                </div>
                <strong>{toCurrency(client.margin)}</strong>
              </div>
            ))}
            {(data.profitableClients ?? []).length === 0 && (
              <p className="exec-empty-note">Sin clientes con OTs finalizadas en este per&iacute;odo.</p>
            )}
          </div>
        </article>
      </section>

      <section className="exec-table-panel panel">
        <div className="section-head">
          <h3>Trabajos m&aacute;s rentables</h3>
          <p>Qu&eacute; fabricaciones generan margen y cu&aacute;les conviene revisar antes de repetir.</p>
        </div>
        <div className="premium-table-wrap">
          <table className="premium-table exec-profit-table">
            <thead>
              <tr>
                <th>Trabajo</th>
                <th>Cliente</th>
                <th>Facturaci&oacute;n</th>
                <th>Materiales</th>
                <th>Horas</th>
                <th>Margen</th>
              </tr>
            </thead>
            <tbody>
              {(data.profitableJobs ?? []).map((job) => (
                <tr key={job.id}>
                  <td>
                    <div className="exec-job-cell">
                      <strong>{job.code}</strong>
                      <span>{job.title}</span>
                      {job.badge === 'top' && <Badge variant="success">M&aacute;s rentable</Badge>}
                      {job.badge === 'low-margin' && <Badge variant="destructive">Menor margen</Badge>}
                      {job.badge === 'hours' && <Badge variant="warning">Exceso de horas</Badge>}
                    </div>
                  </td>
                  <td>{job.client}</td>
                  <td className="numeric-cell">{toCurrency(job.revenue)}</td>
                  <td className="numeric-cell">{toCurrency(job.materialCost)}</td>
                  <td className="numeric-cell">{toNumber(job.workedHours, 1)} h</td>
                  <td className="numeric-cell strong-cell">
                    {toCurrency(job.margin)}
                    <small>{toNumber(job.marginPct, 1)}%</small>
                  </td>
                </tr>
              ))}
              {(data.profitableJobs ?? []).length === 0 && (
                <tr>
                  <td colSpan={6}>Todav&iacute;a no hay OTs finalizadas en este per&iacute;odo.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
