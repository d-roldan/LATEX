import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Clock3, Download, FileSpreadsheet, Gauge, PackageCheck, Radio, Search } from 'lucide-react';
import { api } from '../../shared/api/http';
import { Button } from '../../shared/ui/Button';
import { Dialog } from '../../shared/ui/Dialog';
import { getSessionUser } from '../auth/session';
import { useActivePlant } from './useActivePlant';

type Attention = 'OK' | 'WARNING' | 'CRITICAL';
interface ManagementTank {
  id: string; name: string; state: string; stateStartedAt: string; stateElapsedSeconds: number; stateTargetSeconds: number | null; stateAttention: Attention;
  telemetryMode: 'AUTOMATIC' | 'NOT_INSTALLED' | 'PENDING';
  activeLot: null | { id: string; manufacturingOrder: string; materialCode: string; description: string; priority: string; plannedQuantityKg: number | null };
  telemetry: { grossKg: number | null; online: boolean };
}
interface DailyReport {
  date: string; generatedAt: string; isLive: boolean; snapshotAt: string; currentByState: Record<string, number>; onlineScales: number | null;
  completedLots: Array<{ id: string; manufacturingOrder: string; description: string; durationSeconds: number }>;
  quality: Record<string, number>; packaging: { producedKg: number; wasteKg: number; producedUnits: number; completedOrders: number };
  laboratory: { awaitingReceipt: number; inAnalysis: number; received: number; resolved: number; averageReceiptSeconds: number | null; averageAnalysisSeconds: number | null };
  durationByState: Record<string, number>; tanks: ManagementTank[]; attention: ManagementTank[];
  closure?: { notes?: string; createdAt: string; createdBy: { fullName: string } } | null;
}
interface Timeline {
  id: string; manufacturingOrder: string; materialCode: string; description: string; totalDurationSeconds: number;
  stateHistory: Array<{ id: string; state: string; description?: string; startedAt: string; endedAt?: string; durationSeconds: number; weightKg?: number; targetSeconds?: number; user?: { fullName: string } }>;
  laboratorySamples?: Array<{ id: string; iteration: number; status: string; requestedAt: string; receivedAt?: string; resolvedAt?: string; waitingForReceiptSeconds?: number | null; analysisSeconds?: number | null; requestedBy?: { fullName: string }; receivedBy?: { fullName: string } }>;
}

const stateLabel: Record<string, string> = {
  VACIO: 'Vacío', FABRICANDO: 'Fabricando', LABORATORIO: 'Laboratorio', AJUSTE: 'Ajuste', RECHAZADO: 'Rechazado',
  APROBADO: 'Aprobado', ENVASANDO: 'Envasando', TRASVASANDO: 'Trasvase', FUERA_DE_SERVICIO: 'Fuera de servicio'
};

const previousPlantDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() - 86_400_000));
const duration = (seconds?: number | null) => {
  const value = Math.max(0, seconds ?? 0);
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  return hours ? `${hours} h ${minutes} min` : `${minutes} min`;
};
const localTime = (value: string) => new Date(value).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit' });

export function PlantManagementPage() {
  const { active } = useActivePlant();
  const base = `/plants/${active?.code ?? 'LATEX'}`;
  const client = useQueryClient();
  const user = getSessionUser();
  const [date, setDate] = useState(previousPlantDay);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [closureOpen, setClosureOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [targets, setTargets] = useState({ fabricando: 480, laboratorio: 30, ajuste: 60, rechazado: 60, aprobado: 120, envasando: 360, fueraDeServicio: 480 });
  const config = useQuery({ queryKey: ['plant-config-management', active?.code], enabled: Boolean(active), queryFn: async () => (await api.get<{ stageTargetsMinutes: Record<string, number> }>(`${base}/config`)).data });
  const report = useQuery({
    queryKey: ['plant-management', active?.code, date], enabled: Boolean(active),
    queryFn: async () => api.get<DailyReport>(`${base}/management/daily`, { params: { date } }).then((response) => response.data),
    refetchInterval: 30_000
  });
  const timeline = useQuery({
    queryKey: ['plant-lot-timeline', active?.code, selectedLotId], enabled: Boolean(active && selectedLotId),
    queryFn: () => api.get<Timeline>(`${base}/management/lots/${selectedLotId}/timeline`).then((response) => response.data)
  });
  const closure = useMutation({
    mutationFn: () => api.post(`${base}/management/closures`, { date, notes: notes.trim() || undefined }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['plant-management', date] }); setClosureOpen(false); }
  });
  const saveTargets = useMutation({ mutationFn: () => api.patch(`${base}/management/targets`, targets), onSuccess: async () => { await Promise.all([client.invalidateQueries({ queryKey: ['plant-management'] }), client.invalidateQueries({ queryKey: ['plant-config-management'] })]); setTargetsOpen(false); } });
  const data = report.data;
  const qualityIncidents = (data?.quality.AJUSTE ?? 0) + (data?.quality.RECHAZADO_RECUPERAR ?? 0) + (data?.quality.RECHAZADO_DESTRUIR ?? 0);
  const kpis = useMemo(() => data ? [
    { label: 'Fabricando', value: data.currentByState.FABRICANDO ?? 0, icon: <Gauge />, tone: 'blue' },
    { label: 'Esperando muestra', value: data.laboratory.awaitingReceipt, icon: <Clock3 />, tone: 'yellow' },
    { label: 'En análisis', value: data.laboratory.inAnalysis, icon: <Search />, tone: 'blue' },
    { label: 'Esperando envasado', value: data.currentByState.APROBADO ?? 0, icon: <Clock3 />, tone: 'green' },
    { label: 'Finalizados', value: data.completedLots.length, icon: <CheckCircle2 />, tone: 'green' },
    { label: 'Kg envasados', value: Math.round(data.packaging.producedKg).toLocaleString('es-AR'), icon: <PackageCheck />, tone: 'blue' },
    { label: 'Alertas', value: data.attention.length, icon: <AlertTriangle />, tone: data.attention.length ? 'red' : 'green' }
  ] : [], [data]);

  const download = async (format: 'pdf' | 'xls') => {
    const response = await api.get(`${base}/management/export`, { params: { date, format }, responseType: 'blob' });
    const href = URL.createObjectURL(response.data);
    const link = document.createElement('a'); link.href = href; link.download = `DISAL-resumen-${date}.${format}`; link.click();
    URL.revokeObjectURL(href);
  };

  return <div className="plant-page management-page">
    <header className="plant-page-head management-head">
      <div><p>REUNIÓN DIARIA · INFORMACIÓN DE LA FECHA SELECCIONADA</p><h1>Estado de la producción</h1></div>
      <div className="management-head__actions">
        <input aria-label="Fecha del informe" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <Button size="sm" variant="secondary" onClick={() => download('pdf')}><Download size={16}/> PDF</Button>
        <Button size="sm" variant="secondary" onClick={() => download('xls')}><FileSpreadsheet size={16}/> Excel</Button>
        {user?.role === 'ADMIN' ? <Button size="sm" variant="secondary" onClick={() => { const current = config.data?.stageTargetsMinutes; if (current) setTargets({ fabricando: current.FABRICANDO, laboratorio: current.LABORATORIO, ajuste: current.AJUSTE, rechazado: current.RECHAZADO, aprobado: current.APROBADO, envasando: current.ENVASANDO, fueraDeServicio: current.FUERA_DE_SERVICIO }); setTargetsOpen(true); }}>Objetivos</Button> : null}
        <Button size="sm" disabled={Boolean(data?.closure)} onClick={() => { setNotes(''); setClosureOpen(true); }}>{data?.closure ? 'Jornada cerrada' : 'Cerrar jornada'}</Button>
      </div>
    </header>

    {report.isLoading ? <div className="management-loading">Preparando resumen de producción…</div> : null}
    {report.isError ? <div className="plant-error"><AlertTriangle/> No se pudo preparar el resumen diario.</div> : null}
    {data ? <>
      <section className="management-kpis">{kpis.map((kpi) => <article className={`management-kpi tone-${kpi.tone}`} key={kpi.label}><span>{kpi.icon}{kpi.label}</span><strong>{kpi.value}</strong></article>)}</section>
      <section className="management-summary">
        {data.isLive ? data.tanks.some(t => t.telemetryMode === 'AUTOMATIC') ? <span><Radio size={16}/><b>{data.onlineScales}/{data.tanks.filter(t => t.telemetryMode === 'AUTOMATIC').length}</b> balanzas en línea</span> : <span><Radio size={16}/><b>{data.tanks.some(t => t.telemetryMode === 'PENDING') ? 'Mapeo pendiente' : 'Sin medición de peso'}</b></span> : <span><Clock3 size={16}/><b>Cierre del día</b> seleccionado</span>}
        <span><b>{qualityIncidents}</b> ajustes/rechazos</span>
        <span><b>{duration(data.laboratory.averageReceiptSeconds)}</b> promedio hasta recibir muestra</span>
        <span><b>{duration(data.laboratory.averageAnalysisSeconds)}</b> promedio de análisis</span>
        <span><b>{Math.round(data.packaging.wasteKg).toLocaleString('es-AR')} kg</b> de merma</span>
        {data.closure ? <span className="is-closed"><CheckCircle2 size={16}/> Jornada cerrada por {data.closure.createdBy.fullName}</span> : <span>{data.isLive ? 'Informe en vivo' : 'Reconstrucción histórica'}</span>}
      </section>
      <section className="management-table-wrap">
        <table className="management-table"><thead><tr><th>Tanque</th><th>OF / Producto</th><th>Estado</th><th>Desde</th><th>Duración</th><th>Peso</th><th>Situación</th></tr></thead>
          <tbody>{data.tanks.map((tank) => <tr className={`attention-${tank.stateAttention.toLowerCase()}${data.isLive && !tank.telemetry.online ? ' is-offline' : ''}`} key={tank.id}>
            <td><strong>{tank.name}</strong></td>
            <td>{tank.activeLot ? <button className="management-lot-link" onClick={() => setSelectedLotId(tank.activeLot!.id)}><b>{tank.activeLot.manufacturingOrder}</b><span>{tank.activeLot.materialCode} · {tank.activeLot.description}</span></button> : <span className="management-muted">Sin OF activa</span>}</td>
            <td><span className={`history-state state-${tank.state.toLowerCase()}`}>{stateLabel[tank.state] ?? tank.state}</span></td>
            <td>{localTime(tank.stateStartedAt)}</td><td><strong>{duration(tank.stateElapsedSeconds)}</strong></td>
            <td>{tank.telemetry.grossKg === null ? '—' : `${Math.round(tank.telemetry.grossKg).toLocaleString('es-AR')} kg`}</td>
            <td>{data.isLive && !tank.telemetry.online ? <span className="management-alert">Sin señal</span> : tank.stateAttention === 'CRITICAL' ? <span className="management-alert">Tiempo excedido</span> : tank.stateAttention === 'WARNING' ? <span className="management-warning">Próximo al límite</span> : <span className="management-ok">Normal</span>}</td>
          </tr>)}</tbody>
        </table>
      </section>
      {data.attention.length ? <section className="management-attention"><h2><AlertTriangle/> Situaciones que requieren atención</h2><div>{data.attention.map((tank) => <span key={tank.id}><b>{tank.name}</b> · {stateLabel[tank.state] ?? tank.state} · {duration(tank.stateElapsedSeconds)} {data.isLive && !tank.telemetry.online ? '· balanza sin señal' : ''}</span>)}</div></section> : null}
    </> : null}

    <Dialog open={Boolean(selectedLotId)} onOpenChange={(open) => !open && setSelectedLotId(null)} title={timeline.data ? `OF ${timeline.data.manufacturingOrder}` : 'Línea de tiempo'} description={timeline.data ? `${timeline.data.materialCode} · ${timeline.data.description} · Total ${duration(timeline.data.totalDurationSeconds)}` : 'Cargando trazabilidad…'}>
      <div className="lot-timeline">{timeline.data?.stateHistory.map((period) => <article key={period.id}><span className={`timeline-dot state-${period.state.toLowerCase()}`}/><div><strong>{stateLabel[period.state] ?? period.state}</strong><small>{localTime(period.startedAt)} — {period.endedAt ? localTime(period.endedAt) : 'En curso'} · {duration(period.durationSeconds)}</small>{period.description ? <p>{period.description}</p> : null}{period.weightKg !== null && period.weightKg !== undefined ? <em>Peso al ingresar: {Math.round(period.weightKg).toLocaleString('es-AR')} kg</em> : null}</div></article>)}</div>
      {timeline.data?.laboratorySamples?.length ? <section className="management-laboratory-cycles"><h3>Ciclos de Laboratorio</h3>{timeline.data.laboratorySamples.map((sample) => <article key={sample.id}><strong>Muestra {sample.iteration}</strong><span>Solicitada {localTime(sample.requestedAt)}</span><span>Recibida {sample.receivedAt ? localTime(sample.receivedAt) : 'Pendiente'}</span><span>Espera: {duration(sample.waitingForReceiptSeconds)}</span><span>Resultado {sample.resolvedAt ? localTime(sample.resolvedAt) : 'Pendiente'}</span><span>Análisis: {duration(sample.analysisSeconds)}</span></article>)}</section> : null}
    </Dialog>
    <Dialog open={closureOpen} onOpenChange={setClosureOpen} title="Cerrar jornada" description="Guarda una fotografía inmutable de los indicadores para la reunión y los informes posteriores.">
      <label className="closure-notes">Observaciones del jefe<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Pendientes, desvíos, prioridades para el próximo turno…"/></label>
      {closure.isError ? <p className="error-text">No se pudo guardar el cierre.</p> : null}
      <div className="plant-form-actions"><Button variant="secondary" onClick={() => setClosureOpen(false)}>Cancelar</Button><Button disabled={closure.isPending} onClick={() => closure.mutate()}>{closure.isPending ? 'Guardando…' : 'Guardar cierre'}</Button></div>
    </Dialog>
    <Dialog open={targetsOpen} onOpenChange={setTargetsOpen} title="Tiempos objetivo" description="Minutos máximos esperados por etapa. El 80% del límite se muestra en amarillo y el 100% en rojo.">
      <div className="target-form">{[
        ['fabricando','Fabricación'],['laboratorio','Laboratorio'],['ajuste','Ajuste'],['rechazado','Rechazado'],['aprobado','Aprobado esperando envasado'],['envasando','Envasado'],['fueraDeServicio','Fuera de servicio']
      ].map(([key,label]) => <label key={key}>{label}<input type="number" min="1" max="10080" value={targets[key as keyof typeof targets]} onChange={(event) => setTargets({ ...targets, [key]: Number(event.target.value) })}/><span>min</span></label>)}</div>
      <div className="plant-form-actions"><Button variant="secondary" onClick={() => setTargetsOpen(false)}>Cancelar</Button><Button disabled={saveTargets.isPending} onClick={() => saveTargets.mutate()}>Guardar objetivos</Button></div>
    </Dialog>
  </div>;
}
