import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, BarChart3, Boxes, CheckCircle2, Clock3,
  Factory, Filter, RefreshCw, Users, WalletCards
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../shared/api/http';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { Tab, Tabs } from '../../shared/ui/Tabs';
import './ReportsPage.css';

type View = 'production' | 'people' | 'costs';
interface Analytics {
  period: { from: string; to: string };
  filters: {
    models: Array<{ id: string; code: string; name: string }>;
    operators: Array<{ id: string; fullName: string }>;
    sectors: string[];
  };
  kpis: {
    cabins: number; averageProgressPct: number; estimatedHours: number; workedHours: number;
    timeDeviationPct: number; completedStages: number; blockedStages: number; pausedStages: number;
    activeStages: number; delayedCabins: number; materialCost: number;
  };
  stages: Array<{
    code: string; name: string; sector: string; estimatedHours: number; workedHours: number;
    deviationPct: number; completed: number; total: number; delayed: number;
  }>;
  sectors: Array<{
    sector: string; estimatedHours: number; workedHours: number; deviationPct: number; active: number; blocked: number;
  }>;
  operators: Array<{ id: string; name: string; workedHours: number; sessions: number; stages: number }>;
  orders: Array<{
    id: string; code: string; client: string; model: string; status: string; progressPct: number;
    commitmentDate: string | null; estimatedHours: number; workedHours: number; deviationPct: number;
    materialCost: number; completedStages: number; totalStages: number; blockedStages: number;
  }>;
  commercial: Record<string, number>;
}

const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const hours = (value: number) => `${value.toLocaleString('es-AR', { maximumFractionDigits: 1 })} h`;
const money = (value: number) => value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const deviation = (value: number) => `${value > 0 ? '+' : ''}${value.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`;
const deviationClass = (value: number) => value > 20 ? 'is-bad' : value > 0 ? 'is-warn' : 'is-good';
const statusLabel = (value: string) => value.replaceAll('_', ' ');
const statusVariant = (value: string) =>
  value === 'ENTREGADA' || value === 'FINALIZADA' ? 'success' :
  value === 'PAUSADA' || value === 'RETRABAJO' ? 'warning' : value === 'CANCELADA' ? 'destructive' : 'info';

export function ReportsPage() {
  const initialFrom = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 29);
    return isoDate(date);
  }, []);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(isoDate(new Date()));
  const [modelId, setModelId] = useState('');
  const [sector, setSector] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [view, setView] = useState<View>('production');
  const [search, setSearch] = useState('');

  const query = useQuery({
    queryKey: ['disal-analytics', from, to, modelId, sector, operatorId],
    queryFn: async () => {
      const response = await api.get<Analytics>('/reports/disal-analytics', {
        params: { from, to, modelId: modelId || undefined, sector: sector || undefined, operatorId: operatorId || undefined }
      });
      return response.data;
    }
  });

  const orders = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return query.data?.orders ?? [];
    return (query.data?.orders ?? []).filter((row) =>
      `${row.code} ${row.client} ${row.model}`.toLowerCase().includes(term)
    );
  }, [query.data?.orders, search]);

  const clearFilters = () => {
    setFrom(initialFrom); setTo(isoDate(new Date())); setModelId(''); setSector(''); setOperatorId(''); setSearch('');
  };

  if (query.isLoading) {
    return <div className="reports-state"><RefreshCw className="reports-spin" /><strong>Calculando indicadores desde las sesiones de trabajo…</strong></div>;
  }
  if (query.isError || !query.data) {
    return <div className="reports-state reports-state--error"><AlertTriangle /><strong>No se pudo cargar el análisis productivo.</strong><Button onClick={() => query.refetch()}>Reintentar</Button></div>;
  }

  const data = query.data;
  const commercialTotal = Object.values(data.commercial).reduce((sum, value) => sum + value, 0);
  const approved = data.commercial.APROBADO ?? 0;

  return (
    <div className="disal-reports page-enter">
      <header className="reports-hero panel">
        <div>
          <p className="eyebrow"><BarChart3 size={15} /> INTELIGENCIA PRODUCTIVA DISAL</p>
          <h2>Rendimiento de fabricación</h2>
          <p>Indicadores reales por casilla, etapa, sector, modelo y operario.</p>
        </div>
        <Badge variant={data.kpis.blockedStages || data.kpis.delayedCabins ? 'warning' : 'success'}>
          {data.kpis.blockedStages || data.kpis.delayedCabins
            ? `${data.kpis.blockedStages + data.kpis.delayedCabins} puntos requieren atención`
            : 'Operación sin alertas'}
        </Badge>
      </header>

      <section className="reports-filters panel" aria-label="Filtros del reporte">
        <div className="reports-filter-title"><Filter size={18} /><strong>Período y alcance</strong></div>
        <label>Desde<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>Hasta<input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></label>
        <label>Modelo<select value={modelId} onChange={(event) => setModelId(event.target.value)}>
          <option value="">Todos</option>{data.filters.models.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}
        </select></label>
        <label>Sector<select value={sector} onChange={(event) => setSector(event.target.value)}>
          <option value="">Todos</option>{data.filters.sectors.map((item) => <option key={item} value={item}>{item}</option>)}
        </select></label>
        <label>Operario<select value={operatorId} onChange={(event) => setOperatorId(event.target.value)}>
          <option value="">Todos</option>{data.filters.operators.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
        </select></label>
        <Button variant="secondary" onClick={clearFilters}>Limpiar</Button>
      </section>

      <section className="reports-kpis">
        <Kpi icon={<Factory />} label="Casillas con actividad" value={String(data.kpis.cabins)} detail={`${data.kpis.averageProgressPct.toFixed(0)}% de avance promedio`} />
        <Kpi icon={<Clock3 />} label="Horas reales" value={hours(data.kpis.workedHours)} detail={`${hours(data.kpis.estimatedHours)} previstas`} tone={deviationClass(data.kpis.timeDeviationPct)} />
        <Kpi icon={<BarChart3 />} label="Desvío de tiempo" value={deviation(data.kpis.timeDeviationPct)} detail="Real frente a previsto" tone={deviationClass(data.kpis.timeDeviationPct)} />
        <Kpi icon={<CheckCircle2 />} label="Etapas completadas" value={String(data.kpis.completedStages)} detail={`${data.kpis.activeStages} actualmente en proceso`} />
        <Kpi icon={<AlertTriangle />} label="Bloqueadas / pausadas" value={`${data.kpis.blockedStages} / ${data.kpis.pausedStages}`} detail={`${data.kpis.delayedCabins} casillas fuera de fecha`} tone={data.kpis.blockedStages ? 'is-warn' : 'is-good'} />
      </section>

      <Tabs className="reports-tabs">
        <Tab active={view === 'production'} onClick={() => setView('production')}><Factory size={16} /> Producción</Tab>
        <Tab active={view === 'people'} onClick={() => setView('people')}><Users size={16} /> Personas y sectores</Tab>
        <Tab active={view === 'costs'} onClick={() => setView('costs')}><WalletCards size={16} /> Costos y comercial</Tab>
      </Tabs>

      {view === 'production' && <>
        <section className="reports-grid reports-grid--wide">
          <article className="panel reports-chart">
            <div className="section-head"><h3>Tiempo previsto vs. real por etapa</h3><p>Las primeras son las etapas con mayor desvío.</p></div>
            {data.stages.length ? <ResponsiveContainer width="100%" height={330}>
              <BarChart data={data.stages.slice(0, 10)} layout="vertical" margin={{ left: 18, right: 18 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" horizontal={false} />
                <XAxis type="number" tickFormatter={(value) => `${value}h`} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => hours(Number(value))} />
                <Bar dataKey="estimatedHours" name="Previsto" fill="var(--color-info)" radius={[0, 4, 4, 0]} />
                <Bar dataKey="workedHours" name="Real" radius={[0, 4, 4, 0]}>
                  {data.stages.slice(0, 10).map((row) => <Cell key={row.code} fill={row.deviationPct > 20 ? 'var(--color-danger)' : row.deviationPct > 0 ? 'var(--color-warning)' : 'var(--color-success)'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer> : <Empty text="No hay sesiones de trabajo en el período seleccionado." />}
          </article>
          <article className="panel reports-focus">
            <div className="section-head"><h3>Etapas a revisar</h3><p>Desvíos y recurrencia del atraso.</p></div>
            {data.stages.slice(0, 6).map((stage) => <div className="reports-focus-row" key={stage.code}>
              <div><strong>{stage.name}</strong><span>{stage.sector} · {stage.delayed} de {stage.total} demoradas</span></div>
              <span className={deviationClass(stage.deviationPct)}>{deviation(stage.deviationPct)}</span>
            </div>)}
            {!data.stages.length && <Empty text="Sin etapas para analizar." />}
          </article>
        </section>

        <article className="panel reports-table-panel">
          <div className="reports-table-head">
            <div className="section-head"><h3>Casillas del período</h3><p>Trazabilidad consolidada de fabricación.</p></div>
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar casilla, cliente o modelo" />
          </div>
          <div className="premium-table-wrap"><table className="premium-table">
            <thead><tr><th>Casilla</th><th>Modelo / cliente</th><th>Avance</th><th>Etapas</th><th>Horas</th><th>Desvío</th><th>Compromiso</th><th>Estado</th></tr></thead>
            <tbody>{orders.map((order) => <tr key={order.id}>
              <td><Link to="/orders" state={{ tab: 'production', orderId: order.id }} className="dash-order-code">{order.code}</Link></td>
              <td><strong>{order.model}</strong><small>{order.client}</small></td>
              <td><div className="reports-progress"><span style={{ width: `${order.progressPct}%` }} /></div><small>{order.progressPct}%</small></td>
              <td>{order.completedStages}/{order.totalStages}{order.blockedStages > 0 && <small className="is-warn">{order.blockedStages} bloqueadas</small>}</td>
              <td>{hours(order.workedHours)}<small>de {hours(order.estimatedHours)}</small></td>
              <td className={deviationClass(order.deviationPct)}>{deviation(order.deviationPct)}</td>
              <td>{order.commitmentDate ? new Date(order.commitmentDate).toLocaleDateString('es-AR') : 'Sin fecha'}</td>
              <td><Badge variant={statusVariant(order.status)}>{statusLabel(order.status)}</Badge></td>
            </tr>)}
            {!orders.length && <tr><td colSpan={8}><Empty text="No hay casillas que coincidan con el alcance." /></td></tr>}</tbody>
          </table></div>
        </article>
      </>}

      {view === 'people' && <section className="reports-grid">
        <article className="panel reports-table-panel">
          <div className="section-head"><h3>Horas reales por operario</h3><p>Calculadas únicamente desde sesiones individuales.</p></div>
          <div className="reports-ranking">{data.operators.map((operator, index) => <div key={operator.id}>
            <span className="reports-rank">{index + 1}</span>
            <div><strong>{operator.name}</strong><small>{operator.sessions} sesiones · {operator.stages} etapas diferentes</small></div>
            <strong>{hours(operator.workedHours)}</strong>
          </div>)}{!data.operators.length && <Empty text="No hay sesiones de operarios en este período." />}</div>
        </article>
        <article className="panel reports-table-panel">
          <div className="section-head"><h3>Carga y rendimiento por sector</h3><p>Horas, actividad y bloqueos del flujo.</p></div>
          <div className="premium-table-wrap"><table className="premium-table">
            <thead><tr><th>Sector</th><th>Previstas</th><th>Reales</th><th>Desvío</th><th>Activas</th><th>Bloqueadas</th></tr></thead>
            <tbody>{data.sectors.map((row) => <tr key={row.sector}><td><strong>{row.sector}</strong></td><td>{hours(row.estimatedHours)}</td><td>{hours(row.workedHours)}</td><td className={deviationClass(row.deviationPct)}>{deviation(row.deviationPct)}</td><td>{row.active}</td><td>{row.blocked}</td></tr>)}</tbody>
          </table></div>
        </article>
      </section>}

      {view === 'costs' && <section className="reports-grid">
        <article className="panel reports-cost-summary">
          <WalletCards size={26} />
          <div><span>Materiales consumidos en el período</span><strong>{money(data.kpis.materialCost)}</strong><small>Valorados al costo congelado en cada consumo.</small></div>
        </article>
        <article className="panel reports-commercial">
          <div className="section-head"><h3>Conversión comercial</h3><p>Presupuestos creados en el mismo período.</p></div>
          <div className="reports-commercial-value"><strong>{commercialTotal ? Math.round(approved / commercialTotal * 100) : 0}%</strong><span>{approved} aprobados de {commercialTotal}</span></div>
          <div className="reports-status-list">{Object.entries(data.commercial).map(([status, count]) => <div key={status}><span>{statusLabel(status)}</span><strong>{count}</strong></div>)}</div>
        </article>
        <article className="panel reports-table-panel reports-cost-table">
          <div className="section-head"><h3>Costo real de materiales por casilla</h3><p>Solo consumos registrados dentro del rango.</p></div>
          <div className="premium-table-wrap"><table className="premium-table">
            <thead><tr><th>Casilla</th><th>Modelo</th><th>Cliente</th><th>Costo consumido</th></tr></thead>
            <tbody>{data.orders.filter((row) => row.materialCost > 0).sort((a, b) => b.materialCost - a.materialCost).map((row) =>
              <tr key={row.id}><td>{row.code}</td><td>{row.model}</td><td>{row.client}</td><td className="numeric-cell"><strong>{money(row.materialCost)}</strong></td></tr>)}
            {!data.orders.some((row) => row.materialCost > 0) && <tr><td colSpan={4}><Empty text="No hubo consumos registrados en el período." /></td></tr>}</tbody>
          </table></div>
        </article>
      </section>}
    </div>
  );
}

function Kpi({ icon, label, value, detail, tone = '' }: { icon: React.ReactNode; label: string; value: string; detail: string; tone?: string }) {
  return <article className={`panel reports-kpi ${tone}`}><div>{icon}<span>{label}</span></div><strong>{value}</strong><small>{detail}</small></article>;
}

function Empty({ text }: { text: string }) {
  return <div className="reports-empty"><Boxes size={22} /><span>{text}</span></div>;
}
