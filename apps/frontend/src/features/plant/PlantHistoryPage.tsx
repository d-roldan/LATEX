import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/http';

interface HistoryRow {
  id: string; state: string; description?: string; startedAt: string; endedAt?: string;
  tank: { number: number; name: string }; lot?: { manufacturingOrder: string; materialCode: string; description: string };
  user?: { fullName: string; username: string };
}

export function PlantHistoryPage() {
  const [state, setState] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const query = useQuery({ queryKey: ['plant-history', state, from, to], queryFn: async () => (await api.get<HistoryRow[]>('/plant/history/states', { params: { state: state || undefined, from: from || undefined, to: to || undefined } })).data });
  return <div className="plant-page history-page">
    <header className="plant-page-head"><div><p>TRAZABILIDAD</p><h1>Historial de estados</h1></div><span>{query.data?.length ?? 0} registros</span></header>
    <div className="history-filters"><label>Estado<select value={state} onChange={(e) => setState(e.target.value)}><option value="">Todos</option>{['VACIO','FABRICANDO','LABORATORIO','AJUSTE','RECHAZADO','APROBADO','ENVASANDO','FUERA_DE_SERVICIO'].map((value) => <option key={value}>{value}</option>)}</select></label><label>Desde<input type="date" value={from} onChange={(e) => setFrom(e.target.value)}/></label><label>Hasta<input type="date" value={to} onChange={(e) => setTo(e.target.value)}/></label></div>
    <div className="history-table"><table><thead><tr><th>Tanque</th><th>Estado</th><th>OF / Material</th><th>Descripción</th><th>Responsable</th><th>Inicio</th><th>Fin</th></tr></thead><tbody>{query.data?.map((row) => <tr key={row.id}><td>TK {row.tank.number}</td><td><span className={`history-state state-${row.state.toLowerCase()}`}>{row.state.replaceAll('_',' ')}</span></td><td>{row.lot ? `${row.lot.manufacturingOrder} / ${row.lot.materialCode}` : '—'}</td><td>{row.description ?? row.lot?.description ?? '—'}</td><td>{row.user?.fullName ?? 'Sistema'}</td><td>{new Date(row.startedAt).toLocaleString('es-AR')}</td><td>{row.endedAt ? new Date(row.endedAt).toLocaleString('es-AR') : 'En curso'}</td></tr>)}</tbody></table></div>
  </div>;
}
