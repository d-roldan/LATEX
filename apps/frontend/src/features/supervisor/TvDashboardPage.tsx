import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Expand,
  Factory,
  Moon,
  Pause,
  Play,
  RefreshCw,
  Sun,
  UserRound,
} from 'lucide-react';
import { api } from '../../shared/api/http';
import './TvDashboardPage.css';

interface StageSummary {
  id: string;
  code: string;
  name: string;
  sector?: string | null;
  status: string;
  progressPct: number;
  estimatedTimeMin: number;
  startedAt?: string | null;
  plannedEndAt?: string | null;
  assignments: Array<{
    id: string;
    user?: { id: string; fullName: string } | null;
    resource: { id: string; name: string; type: string };
  }>;
}

interface WorkOrderSummary {
  id: string;
  code: string;
  title: string;
  productionStatus: string;
  priority: number;
  commitmentDate?: string | null;
  progressPct?: number;
  serialNumber?: string | null;
  client: { name: string };
  cabinModelRevision?: { cabinModel: { code: string; name: string } } | null;
  stages: StageSummary[];
}

interface ActiveStage {
  order: WorkOrderSummary;
  stage: StageSummary;
}

const ACTIVE_STAGE_STATUSES = ['EN_PROCESO', 'PAUSADA', 'RETRABAJO'];
const ROTATION_MS = 12000;

function isDelayed(date?: string | null) {
  if (!date) return false;
  return new Date(date).getTime() < Date.now();
}

function formatDate(date?: string | null) {
  if (!date) return 'Sin fecha';
  return new Date(date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

function useRotatingPage(length: number, pageSize: number) {
  const pages = Math.max(1, Math.ceil(length / pageSize));
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(current => Math.min(current, pages - 1));
  }, [pages]);

  useEffect(() => {
    if (pages <= 1) return;
    const timer = window.setInterval(() => setPage(current => (current + 1) % pages), ROTATION_MS);
    return () => window.clearInterval(timer);
  }, [pages]);

  return {
    page,
    pages,
    itemsStart: page * pageSize,
    itemsEnd: page * pageSize + pageSize,
  };
}

function RotationIndicator({ page, pages }: { page: number; pages: number }) {
  if (pages <= 1) return null;
  return (
    <span className="tv-page-indicator" aria-label={`Página ${page + 1} de ${pages}`}>
      {Array.from({ length: pages }, (_, index) => (
        <i key={index} className={index === page ? 'is-active' : ''} />
      ))}
      <b>{page + 1}/{pages}</b>
    </span>
  );
}

function useResponsivePageSizes() {
  const getSizes = () => ({
    active: window.innerWidth < 1200 || window.innerHeight < 760 ? 4 : 6,
    queue: window.innerHeight < 760 ? 4 : 5,
    control: window.innerHeight < 760 ? 2 : 3,
  });
  const [sizes, setSizes] = useState(getSizes);

  useEffect(() => {
    const update = () => setSizes(getSizes());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return sizes;
}

export function TvDashboardPage() {
  const [isLightMode, setIsLightMode] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [now, setNow] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const pageSizes = useResponsivePageSizes();

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 1000);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.clearInterval(clock);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const { data = [], isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['tv-orders'],
    queryFn: async () => {
      const response = await api.get<WorkOrderSummary[]>('/orders', { params: { tab: 'production' } });
      setLastUpdate(new Date());
      return response.data;
    },
    refetchInterval: 30000,
    retry: 2,
  });

  const activeStages = useMemo<ActiveStage[]>(
    () => data.flatMap(order =>
      (order.stages ?? [])
        .filter(stage =>
          ACTIVE_STAGE_STATUSES.includes(stage.status)
          && stage.assignments.length > 0
        )
        .map(stage => ({ order, stage }))
    ).sort((a, b) => {
      const statusWeight = (status: string) => status === 'EN_PROCESO' ? 0 : status === 'RETRABAJO' ? 1 : 2;
      return statusWeight(a.stage.status) - statusWeight(b.stage.status) || b.order.priority - a.order.priority;
    }),
    [data],
  );

  const awaitingApproval = useMemo(
    () => data.filter(order => order.productionStatus === 'FINALIZADA'),
    [data],
  );
  const delayedOrders = useMemo(
    () => data.filter(order =>
      !['FINALIZADA', 'ENTREGADA', 'CANCELADA'].includes(order.productionStatus)
      && isDelayed(order.commitmentDate)
    ),
    [data],
  );
  const queuedOrders = useMemo(
    () => data.filter(order =>
      ['PENDIENTE', 'PLANIFICADA'].includes(order.productionStatus)
      && !isDelayed(order.commitmentDate)
    ).sort((a, b) => b.priority - a.priority),
    [data],
  );

  const activeRotation = useRotatingPage(activeStages.length, pageSizes.active);
  const queueRotation = useRotatingPage(queuedOrders.length, pageSizes.queue);
  const controlRotation = useRotatingPage(awaitingApproval.length, pageSizes.control);
  const activeVisible = activeStages.slice(activeRotation.itemsStart, activeRotation.itemsEnd);
  const queueVisible = queuedOrders.slice(queueRotation.itemsStart, queueRotation.itemsEnd);
  const controlVisible = awaitingApproval.slice(controlRotation.itemsStart, controlRotation.itemsEnd);

  const updateAgeSeconds = lastUpdate ? Math.floor((now.getTime() - lastUpdate.getTime()) / 1000) : 0;
  const connectionState = !isOnline || isError
    ? 'error'
    : updateAgeSeconds > 75
      ? 'stale'
      : 'online';

  const requestFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen();
    } else {
      void document.exitFullscreen();
    }
  };

  return (
    <main className={`tv-board ${isLightMode ? 'tv-board--light' : 'tv-board--dark'}`}>
      <header className="tv-header">
        <div className="tv-brand">
          <div className="tv-brand__logo">
            <img src="/brand/LOGO-DISAL.svg" alt="DISAL Planta de Látex" />
          </div>
          <div>
            <span className="tv-eyebrow"><Factory size={17} /> Producción en planta</span>
            <h1>Estado operativo en vivo</h1>
          </div>
        </div>

        <div className="tv-header__status">
          <div className={`tv-connection tv-connection--${connectionState}`}>
            <i />
            <div>
              <strong>
                {connectionState === 'online' ? 'Conectado' : connectionState === 'stale' ? 'Sin actualizar' : 'Sin conexión'}
              </strong>
              <span>
                {lastUpdate
                  ? `Actualizado ${lastUpdate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
                  : 'Esperando datos'}
              </span>
            </div>
          </div>
          <div className="tv-clock">
            <strong>{now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}</strong>
            <span>{now.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long' })}</span>
          </div>
          <button className="tv-icon-button" type="button" onClick={() => void refetch()} title="Actualizar">
            <RefreshCw size={21} className={isFetching ? 'is-spinning' : ''} />
          </button>
          <button className="tv-icon-button" type="button" onClick={() => setIsLightMode(value => !value)} title="Cambiar tema">
            {isLightMode ? <Moon size={22} /> : <Sun size={22} />}
          </button>
          <button className="tv-icon-button" type="button" onClick={requestFullscreen} title="Pantalla completa">
            <Expand size={22} />
          </button>
        </div>
      </header>

      <section className="tv-kpis" aria-label="Indicadores de producción">
        <article className="tv-kpi tv-kpi--running">
          <span><Play size={20} /> Etapas trabajando</span>
          <strong>{activeStages.filter(item => item.stage.status === 'EN_PROCESO').length}</strong>
        </article>
        <article className="tv-kpi tv-kpi--paused">
          <span><Pause size={20} /> Etapas pausadas</span>
          <strong>{activeStages.filter(item => item.stage.status === 'PAUSADA').length}</strong>
        </article>
        <article className="tv-kpi tv-kpi--control">
          <span><CheckCircle2 size={20} /> Para controlar</span>
          <strong>{awaitingApproval.length}</strong>
        </article>
        <article className="tv-kpi tv-kpi--delayed">
          <span><AlertTriangle size={20} /> Órdenes atrasadas</span>
          <strong>{delayedOrders.length}</strong>
        </article>
      </section>

      {connectionState !== 'online' && (
        <div className={`tv-system-alert tv-system-alert--${connectionState}`}>
          <AlertTriangle size={22} />
          <strong>
            {connectionState === 'stale'
              ? 'La información puede estar desactualizada. Verificá la conexión.'
              : 'No se pueden actualizar los datos. Se muestra la última información disponible.'}
          </strong>
        </div>
      )}

      <div className="tv-content">
        <section className="tv-panel tv-panel--active">
          <div className="tv-section-heading">
            <div>
              <span className="tv-section-heading__icon tv-section-heading__icon--active"><Factory size={23} /></span>
              <div>
                <h2>Trabajo en curso</h2>
                <p>Qué se está haciendo, en qué casilla y quién lo realiza</p>
              </div>
            </div>
            <RotationIndicator page={activeRotation.page} pages={activeRotation.pages} />
          </div>

          {isLoading ? (
            <div className="tv-empty"><RefreshCw className="is-spinning" /> Cargando producción…</div>
          ) : activeVisible.length === 0 ? (
            <div className="tv-empty tv-empty--success"><CheckCircle2 /> No hay etapas activas en este momento</div>
          ) : (
            <div className="tv-active-grid">
              {activeVisible.map(({ order, stage }) => {
                const paused = stage.status === 'PAUSADA';
                const rework = stage.status === 'RETRABAJO';
                const people = stage.assignments
                  .map(assignment => assignment.user?.fullName ?? assignment.resource?.name)
                  .filter(Boolean);
                const cabin = order.cabinModelRevision?.cabinModel.name ?? order.title;
                return (
                  <article
                    key={stage.id}
                    className={`tv-stage-card ${paused ? 'is-paused' : rework ? 'is-rework' : 'is-running'}`}
                  >
                    <div className="tv-stage-card__top">
                      <div>
                        <span className="tv-order-code">{order.code}</span>
                        <strong className="tv-cabin-name">{cabin}</strong>
                      </div>
                      <span className="tv-stage-status">
                        {paused ? <Pause size={16} /> : rework ? <RefreshCw size={16} /> : <Play size={16} />}
                        {paused ? 'Pausada' : rework ? 'Retrabajo' : 'Trabajando'}
                      </span>
                    </div>
                    <div className="tv-stage-card__main">
                      <span>Etapa actual</span>
                      <h3>{stage.name}</h3>
                      {stage.sector && <p>{stage.sector}</p>}
                    </div>
                    <div className="tv-stage-card__meta">
                      <span><UserRound size={17} /> {people.join(', ') || 'Sin responsable asignado'}</span>
                      <span><Factory size={17} /> {stage.sector || `Etapa ${stage.code}`}</span>
                    </div>
                    <div className="tv-progress" aria-label={`Progreso ${order.progressPct ?? 0}%`}>
                      <i style={{ width: `${order.progressPct ?? 0}%` }} />
                      <span>{order.progressPct ?? 0}% de la casilla</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="tv-side">
          <section className="tv-panel tv-panel--compact">
            <div className="tv-section-heading">
              <div>
                <span className="tv-section-heading__icon tv-section-heading__icon--control"><CheckCircle2 size={21} /></span>
                <div>
                  <h2>Para controlar</h2>
                  <p>Etapas terminadas</p>
                </div>
              </div>
              <RotationIndicator page={controlRotation.page} pages={controlRotation.pages} />
            </div>
            <div className="tv-list">
              {controlVisible.length === 0
                ? <div className="tv-empty tv-empty--small">Sin trabajos pendientes de control</div>
                : controlVisible.map(order => (
                  <article className="tv-list-row tv-list-row--control" key={order.id}>
                    <span className="tv-order-code">{order.code}</span>
                    <strong>{order.cabinModelRevision?.cabinModel.name ?? order.title}</strong>
                    <small>Terminada · lista para revisión</small>
                  </article>
                ))}
            </div>
          </section>

          <section className="tv-panel tv-panel--compact">
            <div className="tv-section-heading">
              <div>
                <span className="tv-section-heading__icon tv-section-heading__icon--queue"><Clock3 size={21} /></span>
                <div>
                  <h2>Próximos trabajos</h2>
                  <p>Ordenados por prioridad</p>
                </div>
              </div>
              <RotationIndicator page={queueRotation.page} pages={queueRotation.pages} />
            </div>
            <div className="tv-list">
              {queueVisible.length === 0
                ? <div className="tv-empty tv-empty--small">No hay trabajos en espera</div>
                : queueVisible.map((order, index) => {
                  const nextStage = order.stages?.find(stage => stage.status === 'DISPONIBLE');
                  return (
                    <article className="tv-list-row tv-list-row--queue" key={order.id}>
                      <b className="tv-queue-position">#{queueRotation.itemsStart + index + 1}</b>
                      <div>
                        <span className="tv-order-code">{order.code}</span>
                        <strong>{order.cabinModelRevision?.cabinModel.name ?? order.title}</strong>
                        <small>{nextStage ? `Próxima etapa: ${nextStage.name}` : 'Pendiente de planificación'}</small>
                      </div>
                      <time className={isDelayed(order.commitmentDate) ? 'is-delayed' : ''}>
                        {formatDate(order.commitmentDate)}
                      </time>
                    </article>
                  );
                })}
            </div>
          </section>

          {delayedOrders.length > 0 && (
            <section className="tv-panel tv-panel--compact tv-panel--alert">
              <div className="tv-section-heading">
                <div>
                  <span className="tv-section-heading__icon tv-section-heading__icon--alert"><AlertTriangle size={21} /></span>
                  <div>
                    <h2>Requieren atención</h2>
                    <p>Órdenes fuera de fecha</p>
                  </div>
                </div>
              </div>
              <div className="tv-alert-orders">
                {delayedOrders.slice(0, 3).map(order => (
                  <span key={order.id}>
                    <b>{order.code}</b>
                    <strong>{order.cabinModelRevision?.cabinModel.name ?? order.title}</strong>
                    <time>{formatDate(order.commitmentDate)}</time>
                  </span>
                ))}
                {delayedOrders.length > 3 && <small>+{delayedOrders.length - 3} órdenes más</small>}
              </div>
            </section>
          )}
        </aside>
      </div>

      <footer className="tv-footer">
        <span><i className="tv-footer__live" /> Información en vivo · actualización automática cada 30 segundos</span>
        <strong>DISAL Industria Metalúrgica</strong>
        <span>Las listas cambian automáticamente cada 12 segundos</span>
      </footer>
    </main>
  );
}
