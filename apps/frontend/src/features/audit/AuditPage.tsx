import { FormEvent, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  Clock3,
  KeyRound,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { api } from '../../shared/api/http';
import { Badge } from '../../shared/ui/Badge';
import { Button } from '../../shared/ui/Button';
import { Input, Select } from '../../shared/ui/Input';

interface AuditUser {
  id: string;
  fullName: string;
  email: string;
  username: string;
  role: string;
  isActive: boolean;
  isProtected: boolean;
  isSystemOwner: boolean;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  daysSinceLogin: number | null;
  loginCount: number;
  lastActivityAt: string | null;
}

interface AuditActor {
  id: string;
  fullName: string;
  username: string;
  role: string;
}

interface AuditEvent {
  id: string;
  source: 'SYSTEM' | 'PLANT';
  createdAt: string;
  action: string;
  entityType: string;
  entityId: string;
  reason: string | null;
  actor: AuditActor | null;
  plant: { id: string; code: string; name: string } | null;
  tank: { id: string; name: string; equipmentCode: string } | null;
  lot: { id: string; manufacturingOrder: string; materialCode: string } | null;
  before: unknown;
  after: unknown;
  metadata: unknown;
}

interface AuditDashboard {
  generatedAt: string;
  period: { from: string; to: string };
  summary: {
    usersTotal: number;
    activeUsers: number;
    disabledUsers: number;
    neverLoggedIn: number;
    inactive30Days: number;
    lockedUsers: number;
    pendingFailedAttempts: number;
    eventsInPeriod: number;
    systemEventsInPeriod: number;
    plantEventsInPeriod: number;
    securityEventsInPeriod: number;
  };
  activityByDay: Array<{ date: string; count: number }>;
  users: AuditUser[];
  activity: {
    items: AuditEvent[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  catalog: {
    users: Array<{ id: string; fullName: string; username: string }>;
    plants: Array<{ id: string; code: string; name: string }>;
    actions: string[];
  };
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Creación',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
  STATUS_CHANGE: 'Cambio de estado',
  ASSIGN: 'Asignación',
  DELIVERY_CLOSE: 'Cierre de entrega',
  PASSWORD_CHANGE: 'Cambio de contraseña',
  ROLE_CHANGE: 'Cambio de perfil',
  SETTINGS_CHANGE: 'Cambio de configuración',
  LOGIN: 'Acceso',
  QUALITY_DECISION: 'Decisión de laboratorio',
  CORRECTION: 'Corrección',
  NEW_ORDER: 'Nueva orden'
};

const ENTITY_LABELS: Record<string, string> = {
  AUTH: 'Seguridad',
  USER: 'Usuario',
  COMPANY: 'Empresa',
  CLIENT: 'Cliente',
  ORDER: 'Orden',
  RESOURCE: 'Recurso',
  MATERIAL: 'Material',
  Tank: 'Tanque',
  ProductionLot: 'Orden de fabricación',
  QualityDecision: 'Laboratorio',
  PackagingOrder: 'Orden de envasado',
  TransferOperation: 'Trasvase'
};

const ROLE_LABELS: Record<string, string> = {
  FABRICACION: 'Fabricación',
  LABORATORIO: 'Laboratorio',
  ENVASADO: 'Envasado',
  MONITOREO: 'Monitoreo',
  JEFATURA: 'Jefatura',
  ADMIN: 'Administrador',
  DUENO: 'Dueño',
  SUPERVISOR: 'Supervisor',
  OPERARIO: 'Operario'
};

const localDate = (value: string) =>
  new Date(value).toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    dateStyle: 'short',
    timeStyle: 'short'
  });

const inputDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const today = inputDate(new Date());
const initialFrom = inputDate(new Date(Date.now() - 30 * 86_400_000));

const relativeAccess = (user: AuditUser) => {
  if (!user.lastLoginAt) return 'Nunca ingresó';
  if (user.daysSinceLogin === 0) return 'Ingresó hoy';
  if (user.daysSinceLogin === 1) return 'Hace 1 día';
  return `Hace ${user.daysSinceLogin} días`;
};

const loginResult = (event: AuditEvent) => {
  if (!event.metadata || Array.isArray(event.metadata) || typeof event.metadata !== 'object') {
    return null;
  }
  const result = (event.metadata as Record<string, unknown>).result;
  return typeof result === 'string' ? result : null;
};

const eventContext = (event: AuditEvent) => {
  const values = [
    event.plant?.name,
    event.tank?.name,
    event.lot ? `OF ${event.lot.manufacturingOrder}` : null
  ].filter(Boolean);
  return values.length ? values.join(' · ') : 'Sistema general';
};

const hasDetails = (event: AuditEvent) =>
  Boolean(event.reason || event.before || event.after || event.metadata);

const jsonText = (value: unknown) => JSON.stringify(value, null, 2);

export function AuditPage() {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(today);
  const [source, setSource] = useState('');
  const [action, setAction] = useState('');
  const [userId, setUserId] = useState('');
  const [plantId, setPlantId] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userStatus, setUserStatus] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const dashboard = useQuery({
    queryKey: ['audit-dashboard', from, to, source, action, userId, plantId, search, page, limit],
    queryFn: async () => {
      const response = await api.get<AuditDashboard>('/audit-logs/dashboard', {
        params: {
          from: `${from}T00:00:00-03:00`,
          to: `${to}T23:59:59.999-03:00`,
          source: source || undefined,
          action: action || undefined,
          userId: userId || undefined,
          plantId: plantId || undefined,
          search: search || undefined,
          page,
          limit
        }
      });
      return response.data;
    },
    staleTime: 30_000
  });

  const visibleUsers = useMemo(() => {
    const normalizedSearch = userSearch.trim().toLocaleLowerCase('es');
    return (dashboard.data?.users ?? []).filter((user) => {
      const matchesSearch =
        !normalizedSearch ||
        [user.fullName, user.email, user.username, ROLE_LABELS[user.role] ?? user.role].some(
          (value) => value.toLocaleLowerCase('es').includes(normalizedSearch)
        );
      const isLocked = Boolean(user.lockedUntil && new Date(user.lockedUntil) > new Date());
      const matchesStatus =
        !userStatus ||
        (userStatus === 'LOCKED' && isLocked) ||
        (userStatus === 'NEVER' && !user.lastLoginAt) ||
        (userStatus === 'INACTIVE' &&
          user.isActive &&
          (user.daysSinceLogin === null || user.daysSinceLogin >= 30)) ||
        (userStatus === 'DISABLED' && !user.isActive) ||
        (userStatus === 'ACTIVE' && user.isActive && !isLocked);
      return matchesSearch && matchesStatus;
    });
  }, [dashboard.data?.users, userSearch, userStatus]);

  const chartDays = (dashboard.data?.activityByDay ?? []).slice(-14);
  const maximumActivity = Math.max(1, ...chartDays.map((day) => day.count));

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchDraft.trim());
  };

  const resetFilters = () => {
    setFrom(initialFrom);
    setTo(today);
    setSource('');
    setAction('');
    setUserId('');
    setPlantId('');
    setSearchDraft('');
    setSearch('');
    setPage(1);
  };

  const data = dashboard.data;

  return (
    <div className="plant-page audit-page">
      <header className="plant-page-head audit-head">
        <div>
          <p>CONTROL, TRAZABILIDAD Y SEGURIDAD</p>
          <h1>Auditoría del sistema</h1>
          <span>
            Accesos, cambios administrativos y movimientos operativos de todas las plantas.
          </span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void dashboard.refetch()}
          disabled={dashboard.isFetching}
        >
          <RefreshCw size={16} className={dashboard.isFetching ? 'is-spinning' : ''} />
          {dashboard.isFetching ? 'Actualizando…' : 'Actualizar'}
        </Button>
      </header>

      {dashboard.isError ? (
        <div className="plant-error" role="alert">
          <AlertTriangle /> No se pudo cargar la auditoría. Verificá tu sesión de Super Usuario.
        </div>
      ) : null}
      {dashboard.isLoading ? (
        <div className="audit-loading" role="status">
          <ShieldCheck /> Preparando el registro integral de auditoría…
        </div>
      ) : null}

      {data ? (
        <>
          <section className="audit-kpis" aria-label="Resumen de auditoría">
            <article className="audit-kpi tone-blue">
              <span>
                <UserCheck /> Usuarios activos
              </span>
              <strong>{data.summary.activeUsers}</strong>
              <small>{data.summary.usersTotal} usuarios registrados</small>
            </article>
            <article className="audit-kpi tone-yellow">
              <span>
                <Clock3 /> Sin ingreso reciente
              </span>
              <strong>{data.summary.inactive30Days}</strong>
              <small>{data.summary.neverLoggedIn} nunca ingresaron</small>
            </article>
            <article className="audit-kpi tone-red">
              <span>
                <ShieldAlert /> Alertas de acceso
              </span>
              <strong>{data.summary.securityEventsInPeriod}</strong>
              <small>
                {data.summary.lockedUsers} bloqueados · {data.summary.pendingFailedAttempts}{' '}
                intentos pendientes
              </small>
            </article>
            <article className="audit-kpi tone-green">
              <span>
                <Activity /> Movimientos
              </span>
              <strong>{data.summary.eventsInPeriod.toLocaleString('es-AR')}</strong>
              <small>
                {data.summary.plantEventsInPeriod} planta · {data.summary.systemEventsInPeriod}{' '}
                sistema
              </small>
            </article>
          </section>

          <section className="audit-panel audit-activity-panel">
            <header>
              <div>
                <p>ÚLTIMOS 14 DÍAS DEL PERÍODO</p>
                <h2>Volumen de actividad</h2>
              </div>
              <span>Actualizado {localDate(data.generatedAt)}</span>
            </header>
            {chartDays.length ? (
              <div className="audit-chart" role="img" aria-label="Movimientos registrados por día">
                {chartDays.map((day) => (
                  <div key={day.date}>
                    <span
                      style={{ height: `${Math.max(8, (day.count / maximumActivity) * 100)}%` }}
                      title={`${day.date}: ${day.count} movimientos`}
                    >
                      <b>{day.count}</b>
                    </span>
                    <small>
                      {new Date(`${day.date}T12:00:00`).toLocaleDateString('es-AR', {
                        day: '2-digit',
                        month: '2-digit'
                      })}
                    </small>
                  </div>
                ))}
              </div>
            ) : (
              <p className="audit-empty">No hay movimientos en el período seleccionado.</p>
            )}
          </section>

          <section className="audit-panel">
            <header className="audit-section-head">
              <div>
                <p>CONTROL DE ACCESO</p>
                <h2>Actividad de usuarios</h2>
              </div>
              <div className="audit-inline-filters">
                <label>
                  <span className="sr-only">Buscar usuario</span>
                  <Input
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                    placeholder="Nombre, usuario o perfil"
                  />
                </label>
                <label>
                  <span className="sr-only">Estado de acceso</span>
                  <Select
                    value={userStatus}
                    onChange={(event) => setUserStatus(event.target.value)}
                  >
                    <option value="">Todos los estados</option>
                    <option value="ACTIVE">Activos</option>
                    <option value="INACTIVE">Sin ingreso hace 30 días</option>
                    <option value="NEVER">Nunca ingresaron</option>
                    <option value="LOCKED">Bloqueados</option>
                    <option value="DISABLED">Deshabilitados</option>
                  </Select>
                </label>
              </div>
            </header>
            <div className="audit-table-wrap">
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Perfil</th>
                    <th>Último ingreso</th>
                    <th>Inactividad</th>
                    <th>Último movimiento</th>
                    <th>Seguridad</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleUsers.map((user) => {
                    const isLocked = Boolean(
                      user.lockedUntil && new Date(user.lockedUntil) > new Date()
                    );
                    return (
                      <tr key={user.id}>
                        <td>
                          <strong>{user.fullName}</strong>
                          <small>
                            @{user.username} · {user.email}
                          </small>
                        </td>
                        <td>
                          <Badge variant={user.isSystemOwner ? 'primary' : 'default'}>
                            {user.isSystemOwner
                              ? 'Super Usuario'
                              : (ROLE_LABELS[user.role] ?? user.role)}
                          </Badge>
                          {!user.isActive ? (
                            <small className="audit-danger">Deshabilitado</small>
                          ) : null}
                        </td>
                        <td>
                          {user.lastLoginAt ? localDate(user.lastLoginAt) : 'Sin ingresos'}
                          <small>{user.loginCount} accesos correctos</small>
                        </td>
                        <td>
                          <strong
                            className={
                              user.daysSinceLogin === null || user.daysSinceLogin >= 30
                                ? 'audit-warning'
                                : ''
                            }
                          >
                            {relativeAccess(user)}
                          </strong>
                        </td>
                        <td>
                          {user.lastActivityAt ? localDate(user.lastActivityAt) : 'Sin movimientos'}
                        </td>
                        <td>
                          {isLocked ? (
                            <Badge variant="danger">Bloqueado</Badge>
                          ) : user.failedLoginAttempts ? (
                            <Badge variant="warning">
                              {user.failedLoginAttempts} intento
                              {user.failedLoginAttempts === 1 ? '' : 's'} fallido
                              {user.failedLoginAttempts === 1 ? '' : 's'}
                            </Badge>
                          ) : (
                            <Badge variant="success">Normal</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!visibleUsers.length ? (
                <p className="audit-empty">No hay usuarios que coincidan con el filtro.</p>
              ) : null}
            </div>
          </section>

          <section className="audit-panel">
            <header className="audit-section-head">
              <div>
                <p>BITÁCORA UNIFICADA</p>
                <h2>Movimientos del software</h2>
              </div>
            </header>
            <form className="audit-filters" onSubmit={submitSearch}>
              <label>
                Desde
                <Input
                  type="date"
                  value={from}
                  max={to}
                  onChange={(event) => {
                    setFrom(event.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <label>
                Hasta
                <Input
                  type="date"
                  value={to}
                  min={from}
                  max={today}
                  onChange={(event) => {
                    setTo(event.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <label>
                Origen
                <Select
                  value={source}
                  onChange={(event) => {
                    setSource(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Sistema y planta</option>
                  <option value="SYSTEM">Sistema</option>
                  <option value="PLANT">Planta</option>
                </Select>
              </label>
              <label>
                Movimiento
                <Select
                  value={action}
                  onChange={(event) => {
                    setAction(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Todos</option>
                  {data.catalog.actions.map((item) => (
                    <option key={item} value={item}>
                      {ACTION_LABELS[item] ?? item.replaceAll('_', ' ')}
                    </option>
                  ))}
                </Select>
              </label>
              <label>
                Responsable
                <Select
                  value={userId}
                  onChange={(event) => {
                    setUserId(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Todos</option>
                  {data.catalog.users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.fullName} (@{user.username})
                    </option>
                  ))}
                </Select>
              </label>
              <label>
                Planta
                <Select
                  value={plantId}
                  onChange={(event) => {
                    setPlantId(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Todas</option>
                  {data.catalog.plants.map((plant) => (
                    <option key={plant.id} value={plant.id}>
                      {plant.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="audit-search-field">
                Buscar
                <span>
                  <Input
                    value={searchDraft}
                    onChange={(event) => setSearchDraft(event.target.value)}
                    placeholder="OF, tanque, persona o motivo"
                  />
                  <Button type="submit" size="sm" aria-label="Buscar movimientos">
                    <Search size={16} />
                  </Button>
                </span>
              </label>
              <Button type="button" size="sm" variant="secondary" onClick={resetFilters}>
                Limpiar
              </Button>
            </form>

            <div className="audit-table-wrap">
              <table className="audit-table audit-events-table">
                <thead>
                  <tr>
                    <th>Fecha y hora</th>
                    <th>Responsable</th>
                    <th>Movimiento</th>
                    <th>Elemento</th>
                    <th>Contexto</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {data.activity.items.map((event) => {
                    const result = loginResult(event);
                    return (
                      <tr key={`${event.source}-${event.id}`}>
                        <td>{localDate(event.createdAt)}</td>
                        <td>
                          <strong>{event.actor?.fullName ?? 'Sistema'}</strong>
                          <small>
                            {event.actor ? `@${event.actor.username}` : 'Proceso automático'}
                          </small>
                        </td>
                        <td>
                          <Badge
                            variant={
                              result && result !== 'SUCCESS'
                                ? 'danger'
                                : event.source === 'PLANT'
                                  ? 'info'
                                  : 'default'
                            }
                          >
                            {ACTION_LABELS[event.action] ?? event.action.replaceAll('_', ' ')}
                          </Badge>
                          {result ? (
                            <small className={result === 'SUCCESS' ? '' : 'audit-danger'}>
                              {result === 'SUCCESS' ? 'Correcto' : result.replaceAll('_', ' ')}
                            </small>
                          ) : null}
                        </td>
                        <td>
                          <strong>{ENTITY_LABELS[event.entityType] ?? event.entityType}</strong>
                          <small title={event.entityId}>{event.entityId}</small>
                        </td>
                        <td>{eventContext(event)}</td>
                        <td>
                          {hasDetails(event) ? (
                            <details className="audit-details">
                              <summary>Ver registro</summary>
                              {event.reason ? <p>{event.reason}</p> : null}
                              {event.before ? (
                                <div>
                                  <b>Antes</b>
                                  <pre>{jsonText(event.before)}</pre>
                                </div>
                              ) : null}
                              {event.after ? (
                                <div>
                                  <b>Después</b>
                                  <pre>{jsonText(event.after)}</pre>
                                </div>
                              ) : null}
                              {event.metadata ? (
                                <div>
                                  <b>Información</b>
                                  <pre>{jsonText(event.metadata)}</pre>
                                </div>
                              ) : null}
                            </details>
                          ) : (
                            <span className="audit-muted">Sin detalle adicional</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!data.activity.items.length ? (
                <p className="audit-empty">No hay movimientos que coincidan con estos filtros.</p>
              ) : null}
            </div>

            <footer className="audit-pagination">
              <span className="audit-pagination__summary">
                {data.activity.total.toLocaleString('es-AR')} movimientos encontrados
              </span>
              <div className="audit-pagination__controls">
                <label>
                  <span>Por página</span>
                  <Select
                    value={limit}
                    onChange={(event) => {
                      setLimit(Number(event.target.value));
                      setPage(1);
                    }}
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </Select>
                </label>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Anterior
                </Button>
                <span>
                  Página {data.activity.page} de {data.activity.totalPages}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page >= data.activity.totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </footer>
          </section>

          <aside className="audit-coverage">
            <KeyRound />
            <div>
              <strong>Cobertura del registro</strong>
              <p>
                Se auditan ingresos correctos y fallidos, bloqueos, altas y cambios de usuarios,
                perfiles, contraseñas, asignaciones de plantas, cambios de estado, decisiones de
                Laboratorio, correcciones, envasado, trasvases y operaciones sobre órdenes de
                fabricación. Los campos sensibles se ocultan antes de responder a la pantalla.
              </p>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
