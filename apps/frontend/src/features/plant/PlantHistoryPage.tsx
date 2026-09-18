import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileDown } from 'lucide-react';
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
import { api } from '../../shared/api/http';
import { Dialog } from '../../shared/ui/Dialog';
import { useActivePlant } from './useActivePlant';
import { historyStateAt, presentationForHistoryState } from './history-state-presentation';

export interface PackagingOrderSummary {
  id: string;
  packagingOrder: string;
  materialCode: string | null;
  line: string;
  format: string;
  description: string;
  startedAt: string;
  finishedAt?: string;
  producedKg?: number | null;
  wasteKg?: number | null;
  producedUnits?: number | null;
  startedBy?: { fullName: string };
  finishedBy?: { fullName: string };
}

interface HistoryRow {
  id: string;
  state: string;
  description?: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds: number;
  tank: { number: number; name: string };
  lot?: {
    id: string;
    manufacturingOrder: string;
    materialCode: string;
    description: string;
    packagingOrders: PackagingOrderSummary[];
  };
  user?: { fullName: string; username: string };
}

export interface ManufacturingCharge {
  id: string;
  materialCode: string;
  materialDescription?: string;
  startedAt: string;
  setpointKg?: number | null;
  actualKg?: number | null;
}

export interface QualityAdjustment {
  id: string;
  result: string;
  employeeNumber: string;
  reason?: string;
  adjustmentReasons: string[];
  createdAt: string;
  user?: { fullName: string };
  adjustmentItems: Array<{
    id: string;
    materialCode: string;
    quantityKg: number;
  }>;
}

export interface Timeline {
  manufacturingOrder: string;
  materialCode: string;
  description: string;
  totalDurationSeconds: number;
  tank: { number: number; name: string };
  packagingOrders: PackagingOrderSummary[];
  manufacturingCharges: ManufacturingCharge[];
  qualityDecisions: QualityAdjustment[];
  weightHistory: {
    status: 'AVAILABLE' | 'NO_DATA' | 'CONFIGURATION_PENDING' | 'UNAVAILABLE';
    message: string;
    lastTimestamp: string | null;
    points: Array<{ timestamp: string; grossKg: number }>;
  };
  stateHistory: Array<{
    id: string;
    state: string;
    description?: string;
    startedAt: string;
    endedAt?: string;
    durationSeconds: number;
    weightKg?: number;
    user?: { fullName: string };
  }>;
}

const states = [
  'VACIO',
  'FABRICANDO',
  'LABORATORIO',
  'AJUSTE',
  'RECHAZADO',
  'APROBADO',
  'ENVASANDO',
  'FUERA_DE_SERVICIO'
];
const duration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours} h ${minutes} min` : `${minutes} min`;
};
const dateTime = (value: string) =>
  new Date(value).toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires'
  });
const chartTime = (value: string) =>
  new Date(value).toLocaleTimeString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit'
  });
const kilograms = (value: number) => `${Math.round(value).toLocaleString('es-AR')} kg`;

export function PlantHistoryPage() {
  const { active } = useActivePlant();
  const base = `/plants/${active?.code ?? 'LATEX'}`;
  const [state, setState] = useState('');
  const [tankId, setTankId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [selectedLot, setSelectedLot] = useState<string | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['plant-history', active?.code, tankId, state, from, to],
    enabled: Boolean(active),
    queryFn: async () =>
      (
        await api.get<HistoryRow[]>(`${base}/history/states`, {
          params: {
            tankId: tankId || undefined,
            state: state || undefined,
            from: from || undefined,
            to: to || undefined
          }
        })
      ).data
  });
  const tanks = useQuery({
    queryKey: ['plant-tanks-history-filter', active?.code],
    enabled: Boolean(active),
    queryFn: async () => (await api.get<Array<{ id: string; name: string }>>(`${base}/tanks`)).data
  });
  const timeline = useQuery({
    queryKey: ['plant-history-timeline', active?.code, selectedLot],
    enabled: Boolean(active && selectedLot),
    queryFn: async () =>
      (
        await api.get<Timeline>(`${base}/management/lots/${selectedLot}/timeline`, {
          params: { includeWeightHistory: true }
        })
      ).data
  });
  const filteredRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es-AR');
    if (!term) return query.data ?? [];
    return (query.data ?? []).filter((row) =>
      [
        row.tank.name,
        String(row.tank.number),
        row.lot?.manufacturingOrder,
        row.lot?.materialCode,
        row.lot?.description,
        row.description,
        row.user?.fullName,
        row.user?.username,
        ...(row.lot?.packagingOrders.flatMap((order) => [
          order.packagingOrder,
          order.materialCode,
          order.description,
          order.line,
          order.format
        ]) ?? [])
      ].some((value) => value?.toLocaleLowerCase('es-AR').includes(term))
    );
  }, [query.data, search]);

  const downloadPdf = async () => {
    if (!timeline.data) return;

    setIsDownloadingPdf(true);
    setPdfError(null);
    try {
      const { downloadTraceabilityPdf } = await import('./history-pdf');
      await downloadTraceabilityPdf(timeline.data);
    } catch (error) {
      console.error('No se pudo generar el PDF de trazabilidad', error);
      setPdfError('No se pudo generar el PDF. Volvé a intentarlo.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="plant-page history-page">
      <header className="plant-page-head">
        <div>
          <p>TRAZABILIDAD</p>
          <h1>Historial de estados</h1>
        </div>
        <span>{filteredRows.length} registros</span>
      </header>
      <div className="history-filters">
        <label className="history-search">
          Buscar
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="OF, OE, material, producto, responsable o tanque…"
          />
        </label>
        <label>
          Tanque
          <select value={tankId} onChange={(event) => setTankId(event.target.value)}>
            <option value="">Todos</option>
            {tanks.data?.map((tank) => (
              <option value={tank.id} key={tank.id}>
                {tank.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Estado
          <select value={state} onChange={(event) => setState(event.target.value)}>
            <option value="">Todos</option>
            {states.map((value) => (
              <option key={value}>{value.replaceAll('_', ' ')}</option>
            ))}
          </select>
        </label>
        <label>
          Desde
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label>
          Hasta
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
      </div>
      <div className="history-table">
        <table>
          <thead>
            <tr>
              <th>Tanque</th>
              <th>Estado</th>
              <th>Orden / Material</th>
              <th>Descripción</th>
              <th>Responsable</th>
              <th>Inicio</th>
              <th>Fin</th>
              <th>Duración</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => {
              const packaging = row.state === 'ENVASANDO' ? row.lot?.packagingOrders[0] : undefined;
              return (
                <tr key={row.id}>
                  <td>{row.tank.name}</td>
                  <td>
                    <span className={`history-state state-${row.state.toLowerCase()}`}>
                      {row.state.replaceAll('_', ' ')}
                    </span>
                  </td>
                  <td>
                    {row.lot ? (
                      <button
                        className="history-lot-link"
                        onClick={() => {
                          setPdfError(null);
                          setSelectedLot(row.lot!.id);
                        }}
                      >
                        {packaging
                          ? `OE ${packaging.packagingOrder} / ${packaging.materialCode ?? 'Sin material'}`
                          : `${row.lot.manufacturingOrder} / ${row.lot.materialCode}`}
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {packaging?.description ?? row.description ?? row.lot?.description ?? '—'}
                  </td>
                  <td>{row.user?.fullName ?? 'Sistema'}</td>
                  <td>{dateTime(row.startedAt)}</td>
                  <td>{row.endedAt ? dateTime(row.endedAt) : 'En curso'}</td>
                  <td>
                    <strong>{duration(row.durationSeconds)}</strong>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Dialog
        open={Boolean(selectedLot)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedLot(null);
            setPdfError(null);
          }
        }}
        className="traceability-dialog"
        title={timeline.data ? `OF ${timeline.data.manufacturingOrder}` : 'Trazabilidad de la OF'}
        description={
          timeline.data
            ? `${timeline.data.materialCode} · ${timeline.data.description} · ${timeline.data.tank.name} · Duración total ${duration(timeline.data.totalDurationSeconds)}`
            : 'Cargando etapas…'
        }
        headerActions={
          timeline.data ? (
            <button
              className="traceability-pdf-button"
              type="button"
              onClick={downloadPdf}
              disabled={isDownloadingPdf}
              aria-label={isDownloadingPdf ? 'Generando PDF' : 'Descargar informe en PDF'}
              title={isDownloadingPdf ? 'Generando PDF…' : 'Descargar informe en PDF'}
            >
              <FileDown aria-hidden="true" />
              <span>{isDownloadingPdf ? 'Generando…' : 'Descargar PDF'}</span>
            </button>
          ) : undefined
        }
      >
        {pdfError ? (
          <p className="traceability-pdf-error" role="alert">
            {pdfError}
          </p>
        ) : null}
        {timeline.isLoading ? (
          <div className="traceability-loading" role="status">
            Cargando trazabilidad e historial de peso…
          </div>
        ) : null}
        {timeline.isError ? (
          <div className="traceability-empty" role="alert">
            No se pudo cargar la trazabilidad de esta OF.
          </div>
        ) : null}
        {timeline.data ? <TraceabilityContent timeline={timeline.data} /> : null}
      </Dialog>
    </div>
  );
}

function TraceabilityContent({ timeline }: { timeline: Timeline }) {
  const firstPackagingPeriodId = timeline.stateHistory.find(
    (period) => period.state === 'ENVASANDO'
  )?.id;
  const firstManufacturingPeriodId = timeline.stateHistory.find(
    (period) => period.state === 'FABRICANDO'
  )?.id;

  return (
    <div className="traceability-content">
      <WeightChart timeline={timeline} />
      <section className="lot-timeline" aria-label="Etapas de la orden de fabricación">
        {timeline.stateHistory.map((period) => (
          <article key={period.id}>
            <span className={`timeline-dot state-${period.state.toLowerCase()}`} />
            <div>
              <strong>{period.state.replaceAll('_', ' ')}</strong>
              <small>
                {dateTime(period.startedAt)} —{' '}
                {period.endedAt ? dateTime(period.endedAt) : 'En curso'} ·{' '}
                {duration(period.durationSeconds)}
              </small>
              {period.description ? <p>{period.description}</p> : null}
              {period.weightKg !== null && period.weightKg !== undefined ? (
                <em>{kilograms(period.weightKg)} al ingresar</em>
              ) : null}
              {period.state === 'LABORATORIO' ? (
                <LaboratoryAdjustments
                  adjustments={adjustmentsForPeriod(timeline.qualityDecisions, period)}
                />
              ) : null}
              {period.id === firstManufacturingPeriodId ? (
                <ManufacturingCharges charges={timeline.manufacturingCharges} />
              ) : null}
              {period.id === firstPackagingPeriodId ? (
                <PackagingOrders orders={timeline.packagingOrders} />
              ) : null}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function WeightChart({ timeline }: { timeline: Timeline }) {
  const { weightHistory } = timeline;
  const values = weightHistory.points.map((point) => point.grossKg);
  const minimum = values.length ? Math.min(...values) : null;
  const maximum = values.length ? Math.max(...values) : null;
  const chartPoints = weightHistory.points
    .map((point) => {
      const chartTimestamp = new Date(point.timestamp).getTime();
      const statePeriod = historyStateAt(timeline.stateHistory, chartTimestamp);
      const state = statePeriod?.state;
      const presentation = state ? presentationForHistoryState(state) : undefined;
      return {
        ...point,
        chartTimestamp,
        stateLabel: presentation?.label ?? 'Sin estado registrado',
        stateColor: presentation?.color ?? '#8fa2b4'
      };
    })
    .filter((point) => Number.isFinite(point.chartTimestamp))
    .sort((left, right) => left.chartTimestamp - right.chartTimestamp);
  const firstTimestamp = chartPoints[0]?.chartTimestamp;
  const lastTimestamp = chartPoints[chartPoints.length - 1]?.chartTimestamp;
  const visibleStates =
    firstTimestamp === undefined || lastTimestamp === undefined
      ? []
      : timeline.stateHistory
          .map((period) => ({
            ...period,
            start: Math.max(firstTimestamp, new Date(period.startedAt).getTime()),
            end: Math.min(
              lastTimestamp,
              period.endedAt ? new Date(period.endedAt).getTime() : lastTimestamp
            )
          }))
          .filter(
            (period) =>
              Number.isFinite(period.start) &&
              Number.isFinite(period.end) &&
              period.end >= period.start
          )
          .sort((left, right) => left.start - right.start);
  const chartSpan =
    firstTimestamp === undefined || lastTimestamp === undefined
      ? 0
      : Math.max(1, lastTimestamp - firstTimestamp);
  const gradientStops = visibleStates.flatMap((period) => {
    const presentation = presentationForHistoryState(period.state);
    const start = ((period.start - (firstTimestamp ?? 0)) / chartSpan) * 100;
    const end = ((period.end - (firstTimestamp ?? 0)) / chartSpan) * 100;
    return [
      { offset: start, color: presentation.color },
      { offset: end, color: presentation.color }
    ];
  });
  const legendStates = visibleStates.filter(
    (period, index, periods) =>
      periods.findIndex((candidate) => candidate.state === period.state) === index
  );

  return (
    <section className="weight-history" aria-labelledby="weight-history-title">
      <header>
        <div>
          <h3 id="weight-history-title">Peso durante la fabricación</h3>
          <p>
            {timeline.tank.name} · desde el inicio de FABRICANDO hasta la última muestra registrada
          </p>
        </div>
        {weightHistory.lastTimestamp ? (
          <span>Última muestra {dateTime(weightHistory.lastTimestamp)}</span>
        ) : null}
      </header>
      {weightHistory.status === 'AVAILABLE' ? (
        <>
          <div className="weight-history__chart" role="img" aria-label="Evolución del peso bruto">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartPoints} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                <defs>
                  <linearGradient id="weight-state-gradient" x1="0" y1="0" x2="1" y2="0">
                    {(gradientStops.length
                      ? gradientStops
                      : [
                          { offset: 0, color: '#55c6ff' },
                          { offset: 100, color: '#55c6ff' }
                        ]
                    ).map((stop, index) => (
                      <stop
                        key={`${stop.offset}-${stop.color}-${index}`}
                        offset={`${stop.offset}%`}
                        stopColor={stop.color}
                        stopOpacity={0.34}
                      />
                    ))}
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#324353" />
                <XAxis
                  dataKey="chartTimestamp"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(value) => chartTime(new Date(Number(value)).toISOString())}
                  minTickGap={32}
                  stroke="#8fa2b4"
                  fontSize={11}
                />
                <YAxis
                  tickFormatter={(value: number) => Math.round(value).toLocaleString('es-AR')}
                  domain={['auto', 'auto']}
                  stroke="#8fa2b4"
                  fontSize={11}
                  width={66}
                />
                <Tooltip content={<WeightHistoryTooltip />} />
                <Area
                  type="monotone"
                  dataKey="grossKg"
                  stroke="none"
                  fill="url(#weight-state-gradient)"
                  tooltipType="none"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="grossKg"
                  name="Peso bruto"
                  stroke="#55c6ff"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {legendStates.length ? (
            <ul className="weight-history__legend" aria-label="Estados representados en el gráfico">
              {legendStates.map((period) => {
                const presentation = presentationForHistoryState(period.state);
                return (
                  <li key={period.state}>
                    <i style={{ backgroundColor: presentation.color }} />
                    {presentation.label}
                  </li>
                );
              })}
            </ul>
          ) : null}
          <p className="weight-history__summary">
            Rango visible: {kilograms(minimum ?? 0)} — {kilograms(maximum ?? 0)} ·{' '}
            {weightHistory.points.length} puntos
          </p>
        </>
      ) : (
        <div className={`traceability-empty status-${weightHistory.status.toLowerCase()}`}>
          {weightHistory.message}
        </div>
      )}
    </section>
  );
}

interface WeightTooltipPoint {
  timestamp: string;
  grossKg: number;
  stateLabel: string;
  stateColor: string;
}

function WeightHistoryTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: Array<{ payload?: WeightTooltipPoint }>;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="weight-history__tooltip">
      <span>{dateTime(point.timestamp)}</span>
      <strong>
        {kilograms(point.grossKg)} <small>Peso bruto</small>
      </strong>
      <em style={{ color: point.stateColor }}>{point.stateLabel}</em>
    </div>
  );
}

function PackagingOrders({ orders }: { orders: PackagingOrderSummary[] }) {
  return (
    <details className="traceability-disclosure lot-packaging-summary">
      <summary>
        <span>Ver órdenes de envasado</span>
        <b>{orders.length}</b>
      </summary>
      <div className="traceability-disclosure__content">
        {orders.length ? (
          orders.map((order) => (
            <article key={order.id}>
              <header>
                <strong>OE {order.packagingOrder}</strong>
                <span>{order.finishedAt ? 'Finalizada' : 'En curso'}</span>
              </header>
              <dl>
                <div>
                  <dt>Material</dt>
                  <dd>{order.materialCode ?? 'No informado'}</dd>
                </div>
                <div>
                  <dt>Descripción</dt>
                  <dd>{order.description}</dd>
                </div>
                <div>
                  <dt>Celda / Formato</dt>
                  <dd>
                    {order.line} · {order.format}
                  </dd>
                </div>
                <div>
                  <dt>Inicio</dt>
                  <dd>{dateTime(order.startedAt)}</dd>
                </div>
                <div>
                  <dt>Fin</dt>
                  <dd>{order.finishedAt ? dateTime(order.finishedAt) : 'En curso'}</dd>
                </div>
                <div>
                  <dt>Responsable</dt>
                  <dd>{order.startedBy?.fullName ?? '—'}</dd>
                </div>
                <div>
                  <dt>Kg / Merma</dt>
                  <dd>
                    {order.producedKg ?? '—'} / {order.wasteKg ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt>Unidades</dt>
                  <dd>{order.producedUnits ?? '—'}</dd>
                </div>
              </dl>
            </article>
          ))
        ) : (
          <p className="traceability-empty">No hay órdenes de envasado registradas.</p>
        )}
      </div>
    </details>
  );
}

function ManufacturingCharges({ charges }: { charges: ManufacturingCharge[] }) {
  return (
    <details className="traceability-disclosure manufacturing-charges">
      <summary>
        <span>Ver cargas de materias primas</span>
        <b>{charges.length}</b>
      </summary>
      <div className="traceability-disclosure__content">
        {charges.length ? (
          <div className="manufacturing-charges__table">
            <table>
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Material</th>
                  <th>Setpoint</th>
                  <th>Real</th>
                </tr>
              </thead>
              <tbody>
                {charges.map((charge) => (
                  <tr key={charge.id}>
                    <td>{dateTime(charge.startedAt)}</td>
                    <td>
                      {charge.materialCode}
                      {charge.materialDescription ? ` · ${charge.materialDescription}` : ''}
                    </td>
                    <td>{charge.setpointKg == null ? '—' : kilograms(charge.setpointKg)}</td>
                    <td>{charge.actualKg == null ? '—' : kilograms(charge.actualKg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="traceability-empty">
            Sin cargas individuales registradas. Se mostrarán aquí cuando se incorpore la tabla de
            cargas.
          </p>
        )}
      </div>
    </details>
  );
}

function LaboratoryAdjustments({ adjustments }: { adjustments: QualityAdjustment[] }) {
  if (!adjustments.length) return null;
  return (
    <details className="traceability-disclosure laboratory-adjustments">
      <summary>
        <span>Ver ajustes solicitados</span>
        <b>{adjustments.length}</b>
      </summary>
      <div className="traceability-disclosure__content">
        {adjustments.map((adjustment) => (
          <article key={adjustment.id}>
            <header>
              <strong>{adjustment.adjustmentReasons.join(' · ') || adjustment.reason}</strong>
              <span>{dateTime(adjustment.createdAt)}</span>
            </header>
            <small>
              Legajo {adjustment.employeeNumber} ·{' '}
              {adjustment.user?.fullName ?? 'Responsable no informado'}
            </small>
            {adjustment.adjustmentItems.length ? (
              <ul>
                {adjustment.adjustmentItems.map((item) => (
                  <li key={item.id}>
                    <span>Material {item.materialCode}</span>
                    <strong>
                      {item.quantityKg.toLocaleString('es-AR', { maximumFractionDigits: 3 })} kg
                    </strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Sin materiales detallados.</p>
            )}
          </article>
        ))}
      </div>
    </details>
  );
}

function adjustmentsForPeriod(
  decisions: QualityAdjustment[],
  period: Timeline['stateHistory'][number]
) {
  const startedAt = Date.parse(period.startedAt);
  const endedAt = period.endedAt ? Date.parse(period.endedAt) + 5000 : Number.POSITIVE_INFINITY;
  return decisions.filter((decision) => {
    const createdAt = Date.parse(decision.createdAt);
    return decision.result === 'AJUSTE' && createdAt >= startedAt && createdAt <= endedAt;
  });
}
