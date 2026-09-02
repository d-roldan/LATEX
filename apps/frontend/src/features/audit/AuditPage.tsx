import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../shared/api/http';
import { Badge } from '../../shared/ui/Badge';

interface AuditLogItem {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  createdAt: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  user?: {
    fullName: string;
    role: string;
    email: string;
  } | null;
}

interface AuditLogPage {
  items: AuditLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const ENTITY_TYPES = [
  'COMPANY', 'USER', 'CLIENT', 'ORDER', 'RESOURCE', 'MATERIAL', 'AUTH'
];

const ACTIONS = [
  'CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'ASSIGN', 'DELIVERY_CLOSE',
  'PASSWORD_CHANGE', 'ROLE_CHANGE', 'SETTINGS_CHANGE', 'LOGIN'
];

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Creación', UPDATE: 'Modificación', DELETE: 'Eliminación',
  STATUS_CHANGE: 'Cambio de estado', ASSIGN: 'Asignación',
  DELIVERY_CLOSE: 'Cierre entrega', PASSWORD_CHANGE: 'Cambio contraseña',
  ROLE_CHANGE: 'Cambio de rol', SETTINGS_CHANGE: 'Config. empresa', LOGIN: 'Inicio sesión'
};

const ENTITY_LABELS: Record<string, string> = {
  COMPANY: 'Empresa', USER: 'Usuario', CLIENT: 'Cliente', ORDER: 'Orden de producción',
  RESOURCE: 'Recurso', MATERIAL: 'Material', AUTH: 'Acceso'
};

const ACTION_COLORS: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'primary'> = {
  CREATE: 'success', UPDATE: 'primary', DELETE: 'destructive',
  STATUS_CHANGE: 'warning', ASSIGN: 'primary', DELIVERY_CLOSE: 'success',
  PASSWORD_CHANGE: 'warning', ROLE_CHANGE: 'warning', SETTINGS_CHANGE: 'default', LOGIN: 'default'
};

function formatJson(obj: Record<string, unknown> | null | undefined): string {
  if (!obj) return '—';
  return JSON.stringify(obj, null, 2);
}

export function AuditPage() {
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const logsQuery = useQuery({
    queryKey: ['audit-logs', entityType, action, dateFrom, dateTo, page, limit],
    queryFn: async () => {
      const toExclusive = dateTo
        ? new Date(new Date(`${dateTo}T00:00:00`).getTime() + 24 * 60 * 60 * 1000).toISOString()
        : undefined;
      const response = await api.get<AuditLogPage>('/audit-logs', {
        params: {
          entityType: entityType || undefined,
          action: action || undefined,
          from: dateFrom ? new Date(`${dateFrom}T00:00:00`).toISOString() : undefined,
          to: toExclusive,
          page,
          limit
        }
      });
      return response.data;
    }
  });

  return (
    <div className="stack-lg page-enter">

      {/* ── HERO ─────────────────────────────────────────── */}
      <header className="page-hero panel stagger-1">
        <div className="page-hero__left">
          <p className="eyebrow" style={{ color: 'var(--accent-orange)' }}>🔍 AUDITORÍA</p>
          <h2 className="page-hero__title">Historial de Actividad</h2>
          <p className="page-hero__sub">Registro completo de acciones realizadas en el sistema. Quién hizo qué y cuándo.</p>
        </div>
        <div className="page-hero__actions">
          <div className="dash-period-badge">{logsQuery.data?.total ?? 0} registros</div>
        </div>
      </header>

      {/* ── FILTROS ──────────────────────────────────────── */}
      <section className="stagger-2">
        <div className="control-bar">
          <div className="control-bar__filters">
            <select className="control-bar__select" value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }}>
              <option value="">Todas las entidades</option>
              {ENTITY_TYPES.map((t) => <option key={t} value={t}>{ENTITY_LABELS[t] ?? t}</option>)}
            </select>
            <select className="control-bar__select" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
              <option value="">Todas las acciones</option>
              {ACTIONS.map((a) => <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>)}
            </select>
            <label className="audit-date-filter">
              <span>Desde</span>
              <input type="date" className="input" value={dateFrom} max={dateTo || undefined} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
            </label>
            <label className="audit-date-filter">
              <span>Hasta</span>
              <input type="date" className="input" value={dateTo} min={dateFrom || undefined} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
            </label>
            {(dateFrom || dateTo) && (
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}>
                Limpiar fechas
              </button>
            )}
          </div>
        </div>

        <div className="premium-table-wrap">
          <table className="premium-table interactive">
            <thead>
              <tr>
                <th>Fecha / Hora</th>
                <th>Usuario</th>
                <th>Entidad</th>
                <th>Acción</th>
                <th>ID afectado</th>
                <th style={{ textAlign: 'right' }}>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {logsQuery.isLoading ? (
                <tr><td colSpan={6} className="empty-state">Cargando historial...</td></tr>
              ) : logsQuery.data?.items.length ? (
                logsQuery.data.items.map((log) => (
                  <Fragment key={log.id}>
                    <tr key={log.id}>
                      <td style={{ fontSize: '0.82rem', color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>
                        {new Date(log.createdAt).toLocaleString('es-AR', {
                          day: '2-digit', month: '2-digit', year: '2-digit',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td>
                        {log.user ? (
                          <span style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                            <strong style={{ fontSize: '0.85rem' }}>{log.user.fullName}</strong>
                            <span style={{ fontSize: '0.75rem', color: 'var(--ink-soft)' }}>{log.user.role}</span>
                          </span>
                        ) : <span style={{ color: 'var(--ink-soft)' }}>Sistema</span>}
                      </td>
                      <td>
                        <Badge variant="default">{ENTITY_LABELS[log.entityType] ?? log.entityType}</Badge>
                      </td>
                      <td>
                        <Badge variant={ACTION_COLORS[log.action] ?? 'default'}>
                          {ACTION_LABELS[log.action] ?? log.action}
                        </Badge>
                      </td>
                      <td style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--ink-soft)' }}>
                        {log.entityId.slice(0, 12)}…
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {(log.before || log.after || log.metadata) && (
                          <button
                            type="button"
                            style={{
                              background: 'none', border: '1px solid var(--border)',
                              borderRadius: '0.35rem', padding: '0.25rem 0.6rem',
                              fontSize: '0.78rem', cursor: 'pointer', color: 'var(--ink-soft)'
                            }}
                            onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                          >
                            {expandedId === log.id ? '▲ Ocultar' : '▼ Ver'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedId === log.id && (
                      <tr key={`${log.id}-detail`}>
                        <td colSpan={6} style={{ padding: '0.5rem 1rem 1rem' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            {log.before && (
                              <div>
                                <p style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.3rem', color: 'var(--ink-soft)', textTransform: 'uppercase' }}>Antes</p>
                                <pre style={{ fontSize: '0.78rem', background: 'var(--panel)', padding: '0.6rem', borderRadius: '0.4rem', border: '1px solid var(--border)', overflow: 'auto', maxHeight: '120px' }}>
                                  {formatJson(log.before as Record<string, unknown>)}
                                </pre>
                              </div>
                            )}
                            {log.after && (
                              <div>
                                <p style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.3rem', color: 'var(--accent-lime)', textTransform: 'uppercase' }}>Después</p>
                                <pre style={{ fontSize: '0.78rem', background: 'var(--panel)', padding: '0.6rem', borderRadius: '0.4rem', border: '1px solid var(--border)', overflow: 'auto', maxHeight: '120px' }}>
                                  {formatJson(log.after as Record<string, unknown>)}
                                </pre>
                              </div>
                            )}
                          </div>
                          {log.metadata && (
                            <div style={{ marginTop: '0.5rem' }}>
                              <p style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.3rem', color: 'var(--accent-cyan)', textTransform: 'uppercase' }}>Metadata</p>
                              <pre style={{ fontSize: '0.78rem', background: 'var(--panel)', padding: '0.6rem', borderRadius: '0.4rem', border: '1px solid var(--border)' }}>
                                {formatJson(log.metadata as Record<string, unknown>)}
                              </pre>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">
                      <span className="empty-state__icon">🔍</span>
                      <p>No se encontraron registros para los filtros seleccionados.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {logsQuery.data && logsQuery.data.total > 0 && (
          <div className="audit-pagination">
            <div className="audit-pagination__summary">
              Mostrando {(logsQuery.data.page - 1) * logsQuery.data.limit + 1}–{Math.min(logsQuery.data.page * logsQuery.data.limit, logsQuery.data.total)} de {logsQuery.data.total}
            </div>
            <div className="audit-pagination__controls">
              <label>
                <span>Por página</span>
                <select className="control-bar__select" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </label>
              <button className="btn btn-secondary btn-sm" type="button" disabled={page <= 1 || logsQuery.isFetching} onClick={() => setPage(current => current - 1)}>
                Anterior
              </button>
              <span>Página {logsQuery.data.page} de {logsQuery.data.totalPages}</span>
              <button className="btn btn-secondary btn-sm" type="button" disabled={page >= logsQuery.data.totalPages || logsQuery.isFetching} onClick={() => setPage(current => current + 1)}>
                Siguiente
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
