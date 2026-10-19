import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { api } from '../../shared/api/http';
import { Button } from '../../shared/ui/Button';
import { useActivePlant } from './useActivePlant';
import './InjectionMachinesPage.css';

interface Reading {
  machine_ip: string;
  modelo?: string | null;
  telemetry_origin?: 'DBS_API';
  machine_name_cms?: string | null;
  current_file_name?: string | null;
  cms_timestamp: string;
  cms_age_seconds?: number | null;
  cms_row_fresh?: boolean | null;
  adquisicion_industrial_fresca?: string | null;
  operation_status_code?: number | null;
  operation_status_text?: string | null;
  motor_status_code?: number | null;
  motor_status_text?: string | null;
  heater_status_code?: number | null;
  heater_status_text?: string | null;
  alarm_status_code?: number | null;
  cycle_time_current?: number | null;
  cycle_time_before?: number | null;
  production_time_hour?: number | null;
  production_time_min?: number | null;
  current_quantity?: number | null;
  total_quantity?: number | null;
  target_quantity?: number | null;
  defective_quantity?: number | null;
  dbs_temperature_zones?:
    | {
        zone: string;
        current?: number | null;
        setting?: number | null;
      }[]
    | null;
  avg_quantity_per_hour?: number | null;
  delta_contador_observado?: number | null;
  tipo_cambio_contador?: string | null;
  actividad_inferida?: string | null;
  ultimo_incremento_detectado?: string | null;
}
interface TechnicalCycle {
  shot_number: number;
  timestamp: string;
  machine_ip?: string | null;
  identity_source?: 'CMS_MACHINE_NAME' | 'NODE_RED_MACHINE_CONTEXT' | 'SIMULATED';
  cycle_time?: number | null;
  mold_name?: string | null;
  cavity?: number | null;
  ngmark?: number | null;
  injection_time?: number | null;
  filling_time?: number | null;
  max_injection_pressure?: number | null;
  max_injection_speed?: number | null;
  switch_over_position?: number | null;
  max_switch_over_pressure?: number | null;
  cushion_position?: number | null;
  plasticizing_time?: number | null;
  plasticizing_position?: number | null;
  average_screw_rpm?: number | null;
  max_screw_rpm?: number | null;
  average_back_pressure?: number | null;
  max_back_pressure?: number | null;
  clamp_close_time?: number | null;
  clamp_open_time?: number | null;
  clamp_open_position?: number | null;
  resin_weight?: number | null;
  barrel_temperatures?: (number | null)[] | null;
  mold_temperatures?: (number | null)[] | null;
  hopper_temperature?: number | null;
  recipe?: {
    inj_velocity?: string | null;
    inj_pressure?: string | null;
    inj_position?: string | null;
    sov_time?: number | null;
    sov_position?: number | null;
    hld_pressure?: string | null;
    hld_time?: string | null;
    hld_vel?: string | null;
    chg_position?: string | null;
    chg_speed?: string | null;
    back_pressure?: string | null;
    suckback_position?: string | null;
    suckback_speed?: string | null;
    barrel_temperature?: string | null;
    mold_temperature?: string | null;
    timer?: string | null;
  } | null;
}
interface Machine {
  code: string;
  name: string;
  model: string;
  ip: string;
  order: number;
  reading: Reading | null;
  ultimo_ciclo_tecnico: TechnicalCycle | null;
  receivedAt: string | null;
  nodeRedAt: string | null;
  sqlDurationMs: number | null;
  cmsAgeSeconds: number | null;
  cmsFresh: boolean;
  communicationFresh: boolean;
  counterRecent: boolean;
}
interface Snapshot {
  plantCode: string;
  source: string;
  simulated: boolean;
  schemaVersion: number;
  generatedAt: string;
  lastBatchAt: string | null;
  batch: {
    sqlRows: number | null;
    freshCmsReported: number | null;
    sqlDurationMs: number | null;
    notice: string | null;
    nodeRedAt: string;
  } | null;
  communication: 'RECENT' | 'NO_RECENT_DATA';
  machines: Machine[];
}
interface InjectionHistory {
  status: 'AVAILABLE' | 'NO_DATA' | 'CONFIGURATION_PENDING' | 'UNAVAILABLE';
  message: string;
  points: { timestamp: string; value?: number; target?: number; measured?: number }[];
}

const number = (value: number | null | undefined, digits = 0) =>
  value == null ? 'No informado' : value.toLocaleString('es-AR', { maximumFractionDigits: digits });
const text = (value: string | number | null | undefined) =>
  value == null || value === '' ? 'No informado' : String(value);
const time = (value: string | null | undefined) =>
  value && !Number.isNaN(Date.parse(value))
    ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'medium' }).format(
        new Date(value)
      )
    : 'No informado';
const temperatureTargets = (value: string | null | undefined, sizes: number[]) => {
  if (!value) return null;
  const parts = value.split('/').map((part) => part.trim());
  if (!sizes.includes(parts.length)) return null;
  const values = parts.map((part) => (part !== '' ? Number(part) : NaN));
  return values.every(Number.isFinite) ? values : null;
};
const isProducing = (machine: Machine, snapshot: Snapshot | undefined) =>
  snapshot?.communication === 'RECENT' &&
  machine.cmsFresh &&
  machine.communicationFresh &&
  machine.counterRecent &&
  machine.reading?.operation_status_text?.trim().toUpperCase() === 'AUTO' &&
  machine.reading?.motor_status_text?.trim().toUpperCase() === 'RUN' &&
  machine.reading?.alarm_status_code === 0;

function Details({
  machine,
  batch,
  source,
  schemaVersion,
  simulated,
  onClose
}: {
  machine: Machine;
  batch: Snapshot['batch'];
  source: string;
  schemaVersion: number;
  simulated: boolean;
  onClose: () => void;
}) {
  const r = machine.reading;
  const shot = machine.ultimo_ciclo_tecnico;
  const [tab, setTab] = useState('GENERAL');
  const [historyMetric, setHistoryMetric] = useState<'cycle' | 'quantity' | 'temperature'>('cycle');
  const [historyHours, setHistoryHours] = useState(24);
  const [historyZone, setHistoryZone] = useState(1);
  const history = useQuery({
    queryKey: ['injection-history', machine.code, source, historyMetric, historyHours, historyZone],
    queryFn: async () =>
      (
        await api.get<InjectionHistory>(
          `/plants/ENVASES/injection-machines/${machine.code}/history`,
          {
            params: { source, metric: historyMetric, hours: historyHours, zone: historyZone }
          }
        )
      ).data,
    enabled: tab === 'HISTÓRICO',
    staleTime: 60_000
  });
  const barrelTargets = temperatureTargets(shot?.recipe?.barrel_temperature, [7, 8]);
  const moldTargets = temperatureTargets(shot?.recipe?.mold_temperature, [12]);
  const barrelTemperatures = [
    ...Array.from({ length: 7 }, (_, index) => ({
      name: `Zona CMS ${index + 1}`,
      target: barrelTargets?.[index],
      measured: shot?.barrel_temperatures?.[index]
    })),
    {
      name: 'Tolva',
      target: barrelTargets?.[7],
      measured: shot?.hopper_temperature
    }
  ];
  const moldTemperatures = Array.from({ length: 12 }, (_, index) => ({
    name: `Molde Z${index + 1}`,
    target: moldTargets?.[index],
    measured: shot?.mold_temperatures?.[index]
  }));
  const temperatureGroups = [
    { title: 'Cilindro y tolva', rows: barrelTemperatures },
    { title: 'Molde', rows: moldTemperatures }
  ];
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);
  type Entry = [string, string | number | null | undefined];
  const groups: Record<string, Array<[string, Entry[]]>> = {
    GENERAL: [
      [
        'Equipo y estado',
        [
          ['Código', machine.code],
          ['Nombre', machine.name],
          ['Modelo', machine.model],
          ['IP identificadora', machine.ip],
          ['Operación', r?.operation_status_text],
          ['Motor', r?.motor_status_text],
          ['Calefacción', r?.heater_status_text],
          ['Alarma, código', r?.alarm_status_code],
          [
            r?.telemetry_origin === 'DBS_API' ? 'Última respuesta DBS' : 'Última lectura CMS',
            time(r?.cms_timestamp)
          ]
        ]
      ]
    ],
    PRODUCCIÓN: [
      [
        'Contadores y actividad',
        [
          ['Contador actual', r?.current_quantity],
          ['Total reportado', r?.total_quantity],
          ['Objetivo reportado', r?.target_quantity],
          ['Defectuosas reportadas', r?.defective_quantity],
          ['Promedio reportado por hora', r?.avg_quantity_per_hour],
          ['Ciclo actual (s, inferido)', r?.cycle_time_current],
          ['Ciclo anterior (s, inferido)', r?.cycle_time_before],
          ['Tiempo de producción, horas', r?.production_time_hour],
          ['Tiempo de producción, minutos', r?.production_time_min],
          ['Delta observado', r?.delta_contador_observado],
          ['Tipo de cambio', r?.tipo_cambio_contador],
          ['Actividad inferida', r?.actividad_inferida],
          ['Último incremento', time(r?.ultimo_incremento_detectado)]
        ]
      ]
    ],
    'PARÁMETROS DE INYECCIÓN': [
      [
        'Último ciclo técnico completado',
        [
          ['Disparo', shot?.shot_number],
          ['Fecha del disparo', time(shot?.timestamp)],
          ['Vínculo con la inyectora', shot?.identity_source],
          ['Tiempo de ciclo', shot?.cycle_time],
          ['Archivo del último ciclo', shot?.mold_name],
          ['Cavidades', shot?.cavity],
          ['NGmark (valor reportado)', shot?.ngmark],
          ['Tiempo de inyección', shot?.injection_time],
          ['Tiempo de llenado', shot?.filling_time],
          ['Presión máxima de inyección', shot?.max_injection_pressure],
          ['Velocidad máxima de inyección', shot?.max_injection_speed],
          ['Posición de transferencia', shot?.switch_over_position],
          ['Presión máxima de transferencia', shot?.max_switch_over_pressure],
          ['Posición de colchón', shot?.cushion_position],
          ['Tiempo de plastificación', shot?.plasticizing_time],
          ['Posición de plastificación', shot?.plasticizing_position],
          ['RPM promedio de tornillo', shot?.average_screw_rpm],
          ['RPM máxima de tornillo', shot?.max_screw_rpm],
          ['Contrapresión promedio', shot?.average_back_pressure],
          ['Contrapresión máxima', shot?.max_back_pressure],
          ['Tiempo de cierre', shot?.clamp_close_time],
          ['Tiempo de apertura', shot?.clamp_open_time],
          ['Posición de apertura', shot?.clamp_open_position],
          ['Peso de resina', shot?.resin_weight]
        ]
      ]
    ],
    'AJUSTES DEL CICLO': [
      [
        'Perfil de inyección y transferencia · shot_data_rec',
        [
          ['Velocidades de inyección', shot?.recipe?.inj_velocity],
          ['Presiones de inyección', shot?.recipe?.inj_pressure],
          ['Posiciones de inyección', shot?.recipe?.inj_position],
          ['Tiempo SOV', shot?.recipe?.sov_time],
          ['Posición SOV', shot?.recipe?.sov_position],
          ['Presiones de sostenimiento', shot?.recipe?.hld_pressure],
          ['Tiempos de sostenimiento', shot?.recipe?.hld_time],
          ['Velocidades de sostenimiento', shot?.recipe?.hld_vel]
        ]
      ],
      [
        'Carga, contrapresión y temperaturas · shot_data_rec',
        [
          ['Posiciones de carga', shot?.recipe?.chg_position],
          ['Velocidades de carga', shot?.recipe?.chg_speed],
          ['Contrapresiones', shot?.recipe?.back_pressure],
          ['Posiciones de descompresión', shot?.recipe?.suckback_position],
          ['Velocidades de descompresión', shot?.recipe?.suckback_speed],
          ['Temperaturas de cilindro (texto CMS)', shot?.recipe?.barrel_temperature],
          ['Temperaturas de molde (texto CMS)', shot?.recipe?.mold_temperature],
          ['Temporizador CMS', shot?.recipe?.timer]
        ]
      ]
    ],
    DIAGNÓSTICO: [
      [
        'Origen y frescura',
        [
          ['Timestamp de lectura', time(r?.cms_timestamp)],
          ['Edad de lectura, segundos', machine.cmsAgeSeconds],
          [
            'Lectura fresca informada',
            r?.cms_row_fresh == null ? null : r.cms_row_fresh ? 'Sí' : 'No'
          ],
          ['Adquisición industrial', r?.adquisicion_industrial_fresca],
          ['Recepción Node-RED', time(machine.nodeRedAt)],
          ['Recepción LATEX', time(machine.receivedAt)],
          ['Fuente', source],
          ['Origen de lectura', r?.telemetry_origin ?? 'CMS SQL'],
          ['Versión del contrato', schemaVersion],
          ['Filas SQL informadas', batch?.sqlRows],
          ['Aviso', batch?.notice]
        ]
      ]
    ],
    HISTÓRICO: []
  };
  return (
    <div className="injection-overlay" onClick={onClose}>
      <aside
        className="injection-detail"
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle ${machine.name}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <small>DETALLE DE EQUIPO</small>
            <h2>{machine.name}</h2>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            aria-label="Cerrar detalle"
            autoFocus
          >
            <X size={22} />
          </Button>
        </header>
        <nav className="injection-detail-tabs" aria-label="Secciones del equipo">
          {Object.keys(groups).map((name) => (
            <Button
              key={name}
              type="button"
              variant={tab === name ? 'primary' : 'secondary'}
              size="sm"
              aria-current={tab === name ? 'page' : undefined}
              onClick={() => setTab(name)}
            >
              {name}
            </Button>
          ))}
        </nav>
        {!r && <p>Sin telemetría recibida desde el reinicio del backend.</p>}
        {(tab === 'PARÁMETROS DE INYECCIÓN' || tab === 'AJUSTES DEL CICLO') && (
          <p className="injection-detail__note">
            {shot
              ? `${simulated ? 'Valores simulados' : 'Valores reportados por CMS'} del último ciclo atribuido a esta inyectora.`
              : 'Todavía no hay un ciclo técnico vinculado de forma comprobada a esta inyectora.'}{' '}
            Las unidades de presión, posición, velocidad, peso y temperatura siguen pendientes de
            confirmación. Las series separadas por «/» se muestran como texto original de CMS.
          </p>
        )}
        {tab === 'PARÁMETROS DE INYECCIÓN' && r?.telemetry_origin === 'DBS_API' && (
          <section className="injection-temperature-comparison">
            <h3>Temperaturas de DBS · última consulta</h3>
            <p>
              {machine.cmsFresh && machine.communicationFresh
                ? `Consulta recibida ${time(r.cms_timestamp)}. Escala y unidad física pendientes de confirmar.`
                : 'Lectura obsoleta o sin comunicación reciente; estos valores no son actuales.'}
            </p>
            <div className="injection-temperature-comparison__table">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Zona</th>
                    <th scope="col">Consigna</th>
                    <th scope="col">Actual</th>
                  </tr>
                </thead>
                <tbody>
                  {(r.dbs_temperature_zones ?? []).map((zone) => (
                    <tr key={zone.zone}>
                      <th scope="row">{zone.zone.replaceAll('_', ' ')}</th>
                      <td>{number(zone.setting, 1)}</td>
                      <td>{number(zone.current, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {tab === 'PARÁMETROS DE INYECCIÓN' && (
          <section className="injection-temperature-comparison">
            <h3>Temperaturas · ajuste y medición del último disparo</h3>
            <p>
              Ambos valores corresponden al ciclo {shot ? number(shot.shot_number) : 'no vinculado'}
              . No son temperaturas instantáneas. Un cero es el valor reportado por CMS y no
              confirma por sí solo que el sensor esté activo.
            </p>
            <div className="injection-temperature-comparison__grid">
              {temperatureGroups.map(({ title, rows }) => (
                <div className="injection-temperature-comparison__table" key={title}>
                  <h4>{title}</h4>
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Zona</th>
                        <th scope="col">Ajuste</th>
                        <th scope="col">Medido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((zone) => (
                        <tr key={zone.name}>
                          <th scope="row">{zone.name}</th>
                          <td>{number(zone.target, 1)}</td>
                          <td>{number(zone.measured, 1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </section>
        )}
        {groups[tab].map(([title, entries]) => (
          <section key={title}>
            <h3>{title}</h3>
            <dl>
              {entries.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{text(value)}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        {tab === 'HISTÓRICO' && (
          <section className="injection-history">
            <h3>Histórico de {machine.name}</h3>
            <p>
              {simulated ? 'Serie simulada' : 'Serie real'} identificada por IP desde que se activó
              el registro. Los disparos antiguos sin vínculo comprobado no se incluyen.
            </p>
            <div className="injection-history__controls">
              <div aria-label="Variable histórica">
                {(
                  [
                    ['cycle', 'Ciclo'],
                    ['quantity', 'Contador'],
                    ['temperature', 'Temperaturas']
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    variant={historyMetric === value ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setHistoryMetric(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <label>
                Período
                <select
                  value={historyHours}
                  onChange={(event) => setHistoryHours(Number(event.target.value))}
                >
                  <option value={1}>1 h</option>
                  <option value={6}>6 h</option>
                  <option value={24}>24 h</option>
                  <option value={72}>3 días</option>
                  <option value={168}>7 días</option>
                </select>
              </label>
              {historyMetric === 'temperature' && (
                <label>
                  Zona
                  <select
                    value={historyZone}
                    onChange={(event) => setHistoryZone(Number(event.target.value))}
                  >
                    {Array.from({ length: 7 }, (_, index) => (
                      <option key={index} value={index + 1}>
                        Zona CMS {index + 1}
                      </option>
                    ))}
                    <option value={8}>Tolva</option>
                    {Array.from({ length: 12 }, (_, index) => (
                      <option key={`mold-${index}`} value={index + 9}>
                        Molde Z{index + 1}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {history.isPending ? (
              <p>Cargando historial…</p>
            ) : history.isError ? (
              <p>No se pudo consultar el historial.</p>
            ) : history.data.status !== 'AVAILABLE' ? (
              <p>{history.data.message}</p>
            ) : (
              <div
                className="injection-history__chart"
                role="img"
                aria-label={`Gráfica histórica de ${historyMetric} para ${machine.name}`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={history.data.points}
                    margin={{ top: 12, right: 24, left: 0, bottom: 12 }}
                  >
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={(value: string) =>
                        new Intl.DateTimeFormat('es-AR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        }).format(new Date(value))
                      }
                      stroke="var(--color-text)"
                      minTickGap={28}
                    />
                    <YAxis stroke="var(--color-text)" width={56} domain={['auto', 'auto']} />
                    <Tooltip labelFormatter={(value) => time(String(value))} />
                    <Legend />
                    {historyMetric === 'temperature' ? (
                      <>
                        <Line
                          type="monotone"
                          dataKey="target"
                          name="Ajuste"
                          stroke="var(--color-warning)"
                          dot={false}
                          connectNulls
                        />
                        <Line
                          type="monotone"
                          dataKey="measured"
                          name="Medido"
                          stroke="var(--color-primary)"
                          dot={false}
                          connectNulls
                        />
                      </>
                    ) : (
                      <Line
                        type="monotone"
                        dataKey="value"
                        name={historyMetric === 'cycle' ? 'Ciclo (s)' : 'Contador CMS'}
                        stroke="var(--color-primary)"
                        dot={false}
                        connectNulls
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        )}
      </aside>
    </div>
  );
}

export function InjectionMachinesPage({ tv = false }: { tv?: boolean }) {
  const { active, isLoading } = useActivePlant({ enabled: !tv });
  const [selected, setSelected] = useState<string | null>(null);
  const [flashShot, setFlashShot] = useState<string | null>(null);
  const lastShots = useRef<Record<string, number>>({});
  const allowed = tv || active?.code === 'ENVASES';
  const query = useQuery({
    queryKey: ['plant-injection-machines', tv ? 'public' : active?.id],
    queryFn: () =>
      api
        .get<Snapshot>(
          tv
            ? '/plants/ENVASES/tv/injection-machines'
            : '/plants/ENVASES/telemetry/injection-machines'
        )
        .then((response) => response.data),
    enabled: allowed,
    refetchInterval: 2000,
    refetchIntervalInBackground: true
  });
  const snapshot = query.data;
  const simulated = snapshot?.simulated === true;
  const machines = useMemo(() => snapshot?.machines ?? [], [snapshot?.machines]);
  useEffect(() => {
    let changed: string | null = null;
    for (const machine of machines) {
      const shot = machine.ultimo_ciclo_tecnico?.shot_number;
      if (shot == null) continue;
      if (lastShots.current[machine.code] !== undefined && lastShots.current[machine.code] !== shot)
        changed = machine.code;
      lastShots.current[machine.code] = shot;
    }
    if (!changed) return;
    setFlashShot(changed);
    const timeout = window.setTimeout(() => setFlashShot(null), 1500);
    return () => window.clearTimeout(timeout);
  }, [machines]);
  const selectedMachine = machines.find((machine) => machine.code === selected);
  if (!tv && !isLoading && !allowed)
    return (
      <section className="injection-page">
        <h1>ENVASES</h1>
        <p>
          Seleccioná la planta ENVASES para consultar sus inyectoras. Tu usuario necesita acceso a
          esa planta.
        </p>
      </section>
    );
  return (
    <section className={`injection-page${tv ? ' injection-page--tv' : ''}`}>
      <header className="injection-head">
        <h1>ENVASES</h1>
      </header>
      {query.isError && (
        <p className="injection-error" role="alert">
          No se pudo consultar la telemetría. Se muestran los últimos datos recibidos por esta
          pantalla.
        </p>
      )}
      {query.isLoading && <p role="status">Cargando estado de las inyectoras…</p>}
      <div className="injection-grid">
        {machines.map((machine) => {
          const r = machine.reading;
          const live =
            machine.cmsFresh && machine.communicationFresh && snapshot?.communication === 'RECENT';
          const mode = r?.operation_status_text?.trim().toUpperCase();
          const motor = r?.motor_status_text?.trim().toUpperCase();
          const hasAlarm = live && r?.alarm_status_code != null && r.alarm_status_code !== 0;
          const producing = isProducing(machine, snapshot);
          const loadedFile = machine.ultimo_ciclo_tecnico?.mold_name?.trim();
          const fileLabel =
            r?.telemetry_origin === 'DBS_API' ? 'Archivo actual' : 'Archivo del último ciclo';
          const fileValue =
            r?.telemetry_origin === 'DBS_API'
              ? live
                ? r.current_file_name?.trim() || 'No informado por DBS'
                : 'Sin datos recientes'
              : loadedFile || 'No vinculado';
          const cardState = !live
            ? 'is-stale'
            : mode === 'PARO' || mode === 'MANUAL' || motor === 'STOP' || hasAlarm
              ? 'is-stopped'
              : producing
                ? 'is-producing'
                : 'is-live';
          const operatingState = !live
            ? 'Sin datos recientes'
            : hasAlarm
              ? 'Alarma'
              : mode === 'PARO' || mode === 'MANUAL' || motor === 'STOP'
                ? 'Detenida'
                : producing
                  ? 'Produciendo'
                  : 'En marcha';
          const state = !r
            ? 'Sin datos'
            : snapshot?.communication !== 'RECENT'
              ? 'Sin conexión reciente con Node-RED'
              : !machine.cmsFresh
                ? r?.telemetry_origin === 'DBS_API'
                  ? 'Respuesta DBS desactualizada'
                  : 'CMS desactualizado'
                : !machine.communicationFresh
                  ? 'Sin lectura nueva'
                  : 'Dato vigente';
          return (
            <article key={machine.code} className={`injection-card ${cardState}`}>
              {tv ? (
                <>
                  <div className="injection-card__top">
                    <div>
                      <small>
                        {machine.model}
                        {simulated && <span className="injection-simulation"> · SIMULACIÓN</span>}
                      </small>
                      <div className="injection-card__identity">
                        <h2>{machine.name}</h2>
                        <span
                          className="injection-card__file"
                          title={fileLabel}
                          aria-label={`${fileLabel}: ${fileValue}`}
                        >
                          {fileLabel}: <strong>{fileValue}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="injection-state">{operatingState}</span>
                  <div className="injection-tv-status">
                    <span>
                      Motor <strong>{live ? text(r?.motor_status_text) : 'Sin datos'}</strong>
                    </span>
                    <span>
                      Calefacción{' '}
                      <strong>{live ? text(r?.heater_status_text) : 'Sin datos'}</strong>
                    </span>
                  </div>
                  <div className="injection-count">
                    <span>
                      ENVASES · CONTADOR ACTUAL {r?.telemetry_origin === 'DBS_API' ? 'DBS' : 'CMS'}
                    </span>
                    <strong
                      className={!live || r?.current_quantity == null ? 'is-empty' : undefined}
                    >
                      {live ? number(r?.current_quantity) : 'Sin datos'}
                    </strong>
                  </div>
                  <div className="injection-metrics injection-tv-metrics">
                    <div>
                      <small>CICLO ACTUAL</small>
                      <strong>
                        {live && r?.cycle_time_current != null
                          ? `${number(r.cycle_time_current, 1)} s`
                          : 'Sin datos'}
                      </strong>
                    </div>
                    <div>
                      <small>CICLO ANTERIOR</small>
                      <strong>
                        {live && r?.cycle_time_before != null
                          ? `${number(r.cycle_time_before, 1)} s`
                          : 'Sin datos'}
                      </strong>
                    </div>
                    <div>
                      <small>
                        PROMEDIO {r?.telemetry_origin === 'DBS_API' ? 'DBS' : 'CMS'} / H
                      </small>
                      <strong>
                        {live && r?.avg_quantity_per_hour != null
                          ? number(r.avg_quantity_per_hour, 1)
                          : 'Sin datos'}
                      </strong>
                    </div>
                    <div>
                      <small>TOTAL REPORTADO CMS</small>
                      <strong>
                        {live && r?.total_quantity != null ? number(r.total_quantity) : 'Sin datos'}
                      </strong>
                    </div>
                    <div>
                      <small>ÚLTIMO DISPARO</small>
                      <strong
                        className={flashShot === machine.code ? 'injection-shot-flash' : undefined}
                      >
                        {live && machine.ultimo_ciclo_tecnico
                          ? number(machine.ultimo_ciclo_tecnico.shot_number)
                          : 'Sin vincular'}
                      </strong>
                    </div>
                    <div>
                      <small>CAVIDADES</small>
                      <strong>
                        {live && machine.ultimo_ciclo_tecnico
                          ? number(machine.ultimo_ciclo_tecnico.cavity)
                          : 'Sin vincular'}
                      </strong>
                    </div>
                  </div>
                  <p className="injection-activity">
                    <strong className={producing ? 'is-recent' : ''}>
                      {producing
                        ? 'Producción detectada'
                        : live
                          ? 'Sin incremento reciente'
                          : 'Producción sin confirmar'}
                    </strong>
                  </p>
                  {live && r?.alarm_status_code != null && r.alarm_status_code !== 0 && (
                    <p className="injection-tv-alarm">
                      Alarma reportada · código {r.alarm_status_code}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="injection-card__top">
                    <div>
                      <small>
                        {machine.model}
                        {simulated && <span className="injection-simulation"> · SIMULACIÓN</span>}
                      </small>
                      <div className="injection-card__identity">
                        <h2>{machine.name}</h2>
                        <span className="injection-card__file" title={fileLabel}>
                          {fileLabel}: <strong>{fileValue}</strong>
                        </span>
                      </div>
                    </div>
                    <span className="injection-state">{live ? operatingState : state}</span>
                  </div>
                  <p className="injection-updated">
                    {r?.telemetry_origin === 'DBS_API' ? 'DBS' : 'CMS'} {time(r?.cms_timestamp)}
                  </p>
                  <div className="injection-operation">
                    <span>
                      Operación <strong>{text(r?.operation_status_text)}</strong>
                    </span>
                    <span>
                      Motor <strong>{text(r?.motor_status_text)}</strong>
                    </span>
                    <span>
                      Calefacción <strong>{text(r?.heater_status_text)}</strong>
                    </span>
                  </div>
                  <div className="injection-count">
                    <span>CONTADOR ACTUAL</span>
                    <strong className={r?.current_quantity == null ? 'is-empty' : undefined}>
                      {number(r?.current_quantity)}
                    </strong>
                  </div>
                  <div className="injection-metrics">
                    <div>
                      <small>CICLO ACTUAL</small>
                      <strong>
                        {r?.cycle_time_current == null
                          ? 'No informado'
                          : `${number(r.cycle_time_current, 1)} s`}
                      </strong>
                      <span>
                        Anterior:{' '}
                        {r?.cycle_time_before == null
                          ? 'No informado'
                          : `${number(r.cycle_time_before, 1)} s`}
                      </span>
                    </div>
                    <div>
                      <small>PROMEDIO REPORTADO</small>
                      <strong>
                        {r?.avg_quantity_per_hour == null
                          ? 'No informado'
                          : `${number(r.avg_quantity_per_hour, 1)}/h`}
                      </strong>
                    </div>
                    <div>
                      <small>TOTAL CMS</small>
                      <strong>{number(r?.total_quantity)}</strong>
                    </div>
                    <div>
                      <small>TIEMPO DE PRODUCCIÓN</small>
                      <strong>
                        {r?.production_time_hour == null && r?.production_time_min == null
                          ? 'No informado'
                          : `${number(r?.production_time_hour)} h ${number(r?.production_time_min)} min`}
                      </strong>
                    </div>
                  </div>
                  <div className="injection-activity">
                    <strong className={live && machine.counterRecent ? 'is-recent' : ''}>
                      {text(r?.actividad_inferida)}
                    </strong>
                    <span>
                      Δ contador: {number(r?.delta_contador_observado)} ·{' '}
                      {text(r?.tipo_cambio_contador)}
                    </span>
                    <span>Último incremento: {time(r?.ultimo_incremento_detectado)}</span>
                    <span>Alarma reportada: código {text(r?.alarm_status_code)}</span>
                    <span>Adquisición industrial: {text(r?.adquisicion_industrial_fresca)}</span>
                  </div>
                  <div className="tank-actions injection-card__actions">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelected(machine.code)}
                    >
                      Ver todos los datos
                    </Button>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>
      {selectedMachine && (
        <Details
          machine={selectedMachine}
          batch={snapshot?.batch ?? null}
          source={snapshot?.source ?? 'NODE_RED_ENVASES'}
          schemaVersion={snapshot?.schemaVersion ?? 1}
          simulated={simulated}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
