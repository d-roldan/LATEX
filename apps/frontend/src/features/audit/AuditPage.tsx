import { FormEvent, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  CalendarDays,
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
import { Dialog } from '../../shared/ui/Dialog';
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
  activityInPeriod: {
    totalEvents: number;
    systemEvents: number;
    plantEvents: number;
    successfulLogins: number;
    failedLogins: number;
    lastActivityAt: string | null;
    actions: Array<{ action: string; count: number }>;
    plants: string[];
  };
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

interface AuditUserActivity {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  items: AuditEvent[];
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

const shortDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

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
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [historyFrom, setHistoryFrom] = useState(initialFrom);
  const [historyTo, setHistoryTo] = useState(today);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLimit, setHistoryLimit] = useState(25);
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

  const userActivity = useQuery({
    queryKey: [
      'audit-user-activity',
      selectedUserId,
      historyFrom,
      historyTo,
      historyPage,
      historyLimit
    ],
    enabled: Boolean(selectedUserId),
    queryFn: async () => {
      const response = await api.get<AuditUserActivity>(
        `/audit-logs/dashboard/users/${selectedUserId}/activity`,
        {
          params: {
            from: `${historyFrom}T00:00:00-03:00`,
            to: `${historyTo}T23:59:59.999-03:00`,
            page: historyPage,
            limit: historyLimit
          }
        }
      );
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
  const selectedUser = dashboard.data?.users.find((user) => user.id === selectedUserId) ?? null;
  const periodLabel = from === to ? shortDate(from) : `${shortDate(from)} al ${shortDate(to)}`;

  const selectRecentPeriod = (days: number) => {
    setTo(today);
    setFrom(inputDate(new Date(Date.now() - (days - 1) * 86_400_000)));
    setPage(1);
  };

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

      <section className="audit-period" aria-labelledby="audit-period-title">
        <div className="audit-period__heading">
          <CalendarDays aria-hidden="true" />
          <div>
            <strong id="audit-period-title">Período de actividad</strong>
            <span>{periodLabel} · se aplica a todo el tablero</span>
          </div>
        </div>
        <div className="audit-period__controls">
          <label>
            Desde
            <Input
              type="date"
              value={from}
              max={to}
              onChange={(event) => {
                if (!event.target.value) return;
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
                if (!event.target.value) return;
                setTo(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <div className="audit-period__presets" aria-label="Períodos rápidos">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => selectRecentPeriod(1)}
            >
              Hoy
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => selectRecentPeriod(7)}
            >
              7 días
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => selectRecentPeriod(30)}
            >
              30 días
            </Button>
          </div>
        </div>
      </section>

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
                          <button
                            type="button"
                            className="audit-user-link"
                            onClick={() => {
                              setHistoryFrom(from);
                              setHistoryTo(to);
                              setHistoryPage(1);
                              setHistoryLimit(25);
                              setSelectedUserId(user.id);
                            }}
                            aria-label={`Ver resumen de actividad de ${user.fullName}`}
                          >
                            <strong>{user.fullName}</strong>
                            <small>
                              @{user.username} · {user.email}
                            </small>
                            <span>Ver resumen</span>
                          </button>
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

          <Dialog
            open={Boolean(selectedUser)}
            onOpenChange={(open) => {
              if (!open) setSelectedUserId(null);
            }}
            className="audit-user-dialog"
            title={selectedUser?.fullName ?? 'Resumen de actividad'}
            description={
              selectedUser
                ? `@${selectedUser.username} · ${selectedUser.isSystemOwner ? 'Super Usuario' : (ROLE_LABELS[selectedUser.role] ?? selectedUser.role)} · ${periodLabel}`
                : undefined
            }
          >
            {selectedUser ? (
              <UserActivitySummary
                user={selectedUser}
                periodLabel={periodLabel}
                events={userActivity.data?.items ?? []}
                activityTotal={userActivity.data?.total ?? 0}
                activityPage={userActivity.data?.page ?? historyPage}
                activityTotalPages={userActivity.data?.totalPages ?? 1}
                isActivityLoading={userActivity.isLoading}
                isActivityError={userActivity.isError}
                historyFrom={historyFrom}
                historyTo={historyTo}
                historyLimit={historyLimit}
                onHistoryFromChange={(value) => {
                  setHistoryFrom(value);
                  setHistoryPage(1);
                }}
                onHistoryToChange={(value) => {
                  setHistoryTo(value);
                  setHistoryPage(1);
                }}
                onHistoryLimitChange={(value) => {
                  setHistoryLimit(value);
                  setHistoryPage(1);
                }}
                onPreviousHistoryPage={() => setHistoryPage((current) => Math.max(1, current - 1))}
                onNextHistoryPage={() => setHistoryPage((current) => current + 1)}
              />
            ) : null}
          </Dialog>
        </>
      ) : null}
    </div>
  );
}

function UserActivitySummary({
  user,
  periodLabel,
  events,
  activityTotal,
  activityPage,
  activityTotalPages,
  isActivityLoading,
  isActivityError,
  historyFrom,
  historyTo,
  historyLimit,
  onHistoryFromChange,
  onHistoryToChange,
  onHistoryLimitChange,
  onPreviousHistoryPage,
  onNextHistoryPage
}: {
  user: AuditUser;
  periodLabel: string;
  events: AuditEvent[];
  activityTotal: number;
  activityPage: number;
  activityTotalPages: number;
  isActivityLoading: boolean;
  isActivityError: boolean;
  historyFrom: string;
  historyTo: string;
  historyLimit: number;
  onHistoryFromChange: (value: string) => void;
  onHistoryToChange: (value: string) => void;
  onHistoryLimitChange: (value: number) => void;
  onPreviousHistoryPage: () => void;
  onNextHistoryPage: () => void;
}) {
  const isLocked = Boolean(user.lockedUntil && new Date(user.lockedUntil) > new Date());
  const activity = user.activityInPeriod;

  return (
    <div className="audit-user-summary">
      <section className="audit-user-summary__identity">
        <div>
          <span>Correo</span>
          <strong>{user.email}</strong>
        </div>
        <div>
          <span>Estado</span>
          <strong>{user.isActive ? 'Habilitado' : 'Deshabilitado'}</strong>
        </div>
        <div>
          <span>Seguridad</span>
          <strong>{isLocked ? 'Bloqueado' : 'Normal'}</strong>
        </div>
        <div>
          <span>Último ingreso histórico</span>
          <strong>{user.lastLoginAt ? localDate(user.lastLoginAt) : 'Sin ingresos'}</strong>
        </div>
      </section>

      <section aria-labelledby="user-period-summary-title">
        <header className="audit-user-summary__section-head">
          <div>
            <p>ACTIVIDAD EN EL PERÍODO</p>
            <h4 id="user-period-summary-title">Resumen del {periodLabel}</h4>
          </div>
          <span>
            {activity.lastActivityAt
              ? `Último movimiento ${localDate(activity.lastActivityAt)}`
              : 'Sin movimientos'}
          </span>
        </header>
        <div className="audit-user-summary__kpis">
          <article>
            <span>Movimientos</span>
            <strong>{activity.totalEvents}</strong>
          </article>
          <article>
            <span>En planta</span>
            <strong>{activity.plantEvents}</strong>
          </article>
          <article>
            <span>Ingresos correctos</span>
            <strong>{activity.successfulLogins}</strong>
          </article>
          <article className={activity.failedLogins ? 'is-alert' : ''}>
            <span>Ingresos fallidos</span>
            <strong>{activity.failedLogins}</strong>
          </article>
        </div>
      </section>

      <div className="audit-user-summary__details">
        <section>
          <h4>Movimientos realizados</h4>
          {activity.actions.length ? (
            <ul>
              {activity.actions.map(({ action, count }) => (
                <li key={action}>
                  <span>{ACTION_LABELS[action] ?? action.replaceAll('_', ' ')}</span>
                  <strong>{count}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>Este usuario no registra movimientos en el período seleccionado.</p>
          )}
        </section>
        <section>
          <h4>Ámbito de actividad</h4>
          <dl>
            <div>
              <dt>Sistema general</dt>
              <dd>{activity.systemEvents} movimientos</dd>
            </div>
            <div>
              <dt>Plantas</dt>
              <dd>
                {activity.plants.length ? activity.plants.join(' · ') : 'Sin actividad de planta'}
              </dd>
            </div>
            <div>
              <dt>Accesos históricos</dt>
              <dd>{user.loginCount} correctos</dd>
            </div>
            <div>
              <dt>Intentos pendientes</dt>
              <dd>{user.failedLoginAttempts}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="audit-user-history" aria-labelledby="audit-user-history-title">
        <header>
          <div>
            <p>SECUENCIA CRONOLÓGICA</p>
            <h4 id="audit-user-history-title">Historial completo de movimientos</h4>
          </div>
          <span>{isActivityLoading ? 'Cargando…' : `${activityTotal} movimientos`}</span>
        </header>

        <div className="audit-user-history__filters" aria-label="Filtro de tiempo del historial">
          <label>
            Desde
            <Input
              type="date"
              value={historyFrom}
              max={historyTo}
              onChange={(event) => {
                if (event.target.value) onHistoryFromChange(event.target.value);
              }}
            />
          </label>
          <label>
            Hasta
            <Input
              type="date"
              value={historyTo}
              min={historyFrom}
              max={today}
              onChange={(event) => {
                if (event.target.value) onHistoryToChange(event.target.value);
              }}
            />
          </label>
        </div>

        {isActivityLoading ? (
          <div className="audit-user-history__status" role="status">
            Cargando el historial del usuario…
          </div>
        ) : isActivityError ? (
          <div className="audit-user-history__status is-error" role="alert">
            No se pudo cargar el historial. Cerrá el popup y volvé a intentarlo.
          </div>
        ) : events.length ? (
          <div className="audit-user-history__scroll" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>Fecha y hora</th>
                  <th>Origen</th>
                  <th>Movimiento</th>
                  <th>Elemento y contexto</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => {
                  const result = loginResult(event);
                  return (
                    <tr key={`${event.source}-${event.id}`}>
                      <td>
                        <time dateTime={event.createdAt}>{localDate(event.createdAt)}</time>
                      </td>
                      <td>
                        <Badge variant={event.source === 'PLANT' ? 'info' : 'default'}>
                          {event.source === 'PLANT' ? 'Planta' : 'Sistema'}
                        </Badge>
                      </td>
                      <td>
                        <strong>
                          {ACTION_LABELS[event.action] ?? event.action.replaceAll('_', ' ')}
                        </strong>
                        {result ? (
                          <small className={result === 'SUCCESS' ? '' : 'audit-danger'}>
                            {result === 'SUCCESS' ? 'Ingreso correcto' : 'Ingreso fallido'}
                          </small>
                        ) : null}
                      </td>
                      <td>
                        <strong>{ENTITY_LABELS[event.entityType] ?? event.entityType}</strong>
                        <small>{eventContext(event)}</small>
                      </td>
                      <td>
                        {hasDetails(event) ? (
                          <details className="audit-details">
                            <summary>Ver detalle</summary>
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
          </div>
        ) : (
          <div className="audit-user-history__status">
            No hay movimientos registrados en el período seleccionado.
          </div>
        )}

        {!isActivityLoading && !isActivityError ? (
          <footer className="audit-user-history__pagination">
            <span>{activityTotal.toLocaleString('es-AR')} movimientos encontrados</span>
            <div>
              <label>
                <span>Por página</span>
                <Select
                  value={historyLimit}
                  onChange={(event) => onHistoryLimitChange(Number(event.target.value))}
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </Select>
              </label>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={activityPage <= 1}
                onClick={onPreviousHistoryPage}
              >
                Anterior
              </Button>
              <span>
                Página {activityPage} de {activityTotalPages}
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={activityPage >= activityTotalPages}
                onClick={onNextHistoryPage}
              >
                Siguiente
              </Button>
            </div>
          </footer>
        ) : null}
      </section>
    </div>
  );
}
