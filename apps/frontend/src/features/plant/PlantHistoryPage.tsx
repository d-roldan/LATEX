import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/http';
import { useActivePlant } from './useActivePlant';
import { Dialog } from '../../shared/ui/Dialog';

interface HistoryRow {
  id: string; state: string; description?: string; startedAt: string; endedAt?: string; durationSeconds: number;
  tank: { number: number; name: string }; lot?: { id: string; manufacturingOrder: string; materialCode: string; description: string };
  user?: { fullName: string; username: string };
}
interface Timeline { manufacturingOrder: string; materialCode: string; description: string; totalDurationSeconds: number; stateHistory: Array<{ id: string; state: string; description?: string; startedAt: string; endedAt?: string; durationSeconds: number; weightKg?: number; user?: { fullName: string } }> }
const states = ['VACIO','FABRICANDO','LABORATORIO','AJUSTE','RECHAZADO','APROBADO','ENVASANDO','FUERA_DE_SERVICIO'];
const duration = (seconds: number) => { const hours = Math.floor(seconds / 3600); const minutes = Math.floor((seconds % 3600) / 60); return hours ? `${hours} h ${minutes} min` : `${minutes} min`; };
const dateTime = (value: string) => new Date(value).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

export function PlantHistoryPage() {
  const { active } = useActivePlant();
  const base = `/plants/${active?.code ?? 'LATEX'}`;
  const [state, setState] = useState('');
  const [tankId, setTankId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [selectedLot, setSelectedLot] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['plant-history', active?.code, tankId, state, from, to], enabled: Boolean(active), queryFn: async () => (await api.get<HistoryRow[]>(`${base}/history/states`, { params: { tankId: tankId || undefined, state: state || undefined, from: from || undefined, to: to || undefined } })).data });
  const tanks = useQuery({ queryKey: ['plant-tanks-history-filter', active?.code], enabled: Boolean(active), queryFn: async () => (await api.get<Array<{ id: string; name: string }>>(`${base}/tanks`)).data });
  const timeline = useQuery({ queryKey: ['plant-history-timeline', active?.code, selectedLot], enabled: Boolean(active && selectedLot), queryFn: async () => (await api.get<Timeline>(`${base}/management/lots/${selectedLot}/timeline`)).data });
  const filteredRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es-AR');
    if (!term) return query.data ?? [];
    return (query.data ?? []).filter((row) => [
      row.tank.name, String(row.tank.number), row.lot?.manufacturingOrder, row.lot?.materialCode,
      row.lot?.description, row.description, row.user?.fullName, row.user?.username
    ].some((value) => value?.toLocaleLowerCase('es-AR').includes(term)));
  }, [query.data, search]);
  return <div className="plant-page history-page">
    <header className="plant-page-head"><div><p>TRAZABILIDAD</p><h1>Historial de estados</h1></div><span>{filteredRows.length} registros</span></header>
    <div className="history-filters">
      <label className="history-search">Buscar<input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="OF, material, producto, responsable o tanque…"/></label>
      <label>Tanque<select value={tankId} onChange={(e) => setTankId(e.target.value)}><option value="">Todos</option>{tanks.data?.map((tank) => <option value={tank.id} key={tank.id}>{tank.name}</option>)}</select></label>
      <label>Estado<select value={state} onChange={(e) => setState(e.target.value)}><option value="">Todos</option>{states.map((value) => <option key={value}>{value.replaceAll('_',' ')}</option>)}</select></label>
      <label>Desde<input type="date" value={from} onChange={(e) => setFrom(e.target.value)}/></label>
      <label>Hasta<input type="date" value={to} onChange={(e) => setTo(e.target.value)}/></label>
    </div>
    <div className="history-table"><table><thead><tr><th>Tanque</th><th>Estado</th><th>OF / Material</th><th>Descripción</th><th>Responsable</th><th>Inicio</th><th>Fin</th><th>Duración</th></tr></thead><tbody>{filteredRows.map((row) => <tr key={row.id}><td>{row.tank.name}</td><td><span className={`history-state state-${row.state.toLowerCase()}`}>{row.state.replaceAll('_',' ')}</span></td><td>{row.lot ? <button className="history-lot-link" onClick={() => setSelectedLot(row.lot!.id)}>{row.lot.manufacturingOrder} / {row.lot.materialCode}</button> : '—'}</td><td>{row.description ?? row.lot?.description ?? '—'}</td><td>{row.user?.fullName ?? 'Sistema'}</td><td>{dateTime(row.startedAt)}</td><td>{row.endedAt ? dateTime(row.endedAt) : 'En curso'}</td><td><strong>{duration(row.durationSeconds)}</strong></td></tr>)}</tbody></table></div>
    <Dialog open={Boolean(selectedLot)} onOpenChange={(open) => !open && setSelectedLot(null)} title={timeline.data ? `OF ${timeline.data.manufacturingOrder}` : 'Trazabilidad de la OF'} description={timeline.data ? `${timeline.data.materialCode} · ${timeline.data.description} · Duración total ${duration(timeline.data.totalDurationSeconds)}` : 'Cargando etapas…'}>
      <div className="lot-timeline">{timeline.data?.stateHistory.map((period) => <article key={period.id}><span className={`timeline-dot state-${period.state.toLowerCase()}`}/><div><strong>{period.state.replaceAll('_',' ')}</strong><small>{dateTime(period.startedAt)} — {period.endedAt ? dateTime(period.endedAt) : 'En curso'} · {duration(period.durationSeconds)}</small>{period.description ? <p>{period.description}</p> : null}{period.weightKg !== null && period.weightKg !== undefined ? <em>{Math.round(period.weightKg).toLocaleString('es-AR')} kg al ingresar</em> : null}</div></article>)}</div>
    </Dialog>
  </div>;
}
