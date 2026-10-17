import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { api } from '../../shared/api/http';
import { Button } from '../../shared/ui/Button';
import { useActivePlant } from './useActivePlant';
import './InjectionMachinesPage.css';

interface Reading {
  machine_ip: string;
  modelo?: string | null;
  machine_name_cms?: string | null;
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
  avg_quantity_per_hour?: number | null;
  delta_contador_observado?: number | null;
  tipo_cambio_contador?: string | null;
  actividad_inferida?: string | null;
  ultimo_incremento_detectado?: string | null;
}
interface TechnicalCycle {
  shot_number: number;
  timestamp: string;
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
  onClose
}: {
  machine: Machine;
  batch: Snapshot['batch'];
  source: string;
  schemaVersion: number;
  onClose: () => void;
}) {
  const r = machine.reading;
  const shot = machine.ultimo_ciclo_tecnico;
  const [tab, setTab] = useState('GENERAL');
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
          ['Alarma, código', r?.alarm_status_code]
        ]
      ]
    ],
    PRODUCCIÓN: [
      [
        'Contadores y actividad',
        [
          ['Contador actual', r?.current_quantity],
          ['Total reportado', r?.total_quantity],
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
      ],
      [
        'Temperaturas del último ciclo',
        [
          ...Array.from(
            { length: 7 },
            (_, index): Entry => [`Cilindro Z${index + 1}`, shot?.barrel_temperatures?.[index]]
          ),
          ...Array.from(
            { length: 12 },
            (_, index): Entry => [`Molde Z${index + 1}`, shot?.mold_temperatures?.[index]]
          ),
          ['Tolva', shot?.hopper_temperature]
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
          ['Versión del contrato', schemaVersion],
          ['Filas SQL informadas', batch?.sqlRows],
          ['Aviso', batch?.notice]
        ]
      ]
    ]
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
        {tab === 'PARÁMETROS DE INYECCIÓN' && (
          <p className="injection-detail__note">
            Valores simulados del último ciclo completado. Las unidades de presión, posición,
            velocidad, peso y temperatura no están verificadas con el equipo real.
          </p>
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
  const summary = {
    cms:
      snapshot?.communication === 'RECENT'
        ? machines.filter((machine) => machine.cmsFresh && machine.communicationFresh).length
        : 0,
    increments: machines.filter((machine) => isProducing(machine, snapshot)).length,
    warnings: machines.filter(
      (machine) =>
        snapshot?.communication === 'RECENT' &&
        machine.cmsFresh &&
        machine.communicationFresh &&
        machine.reading?.alarm_status_code != null &&
        machine.reading.alarm_status_code !== 0
    ).length
  };

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
      <div className="injection-summary" aria-label="Resumen de ENVASES">
        <div>
          <strong>{machines.length || 5}</strong>
          <span>Inyectoras</span>
        </div>
        <div>
          <strong>{summary.cms}</strong>
          <span>Con datos recientes</span>
        </div>
        <div>
          <strong>{summary.increments}</strong>
          <span>Con producción detectada</span>
        </div>
        <div>
          <strong>{summary.warnings}</strong>
          <span>Con alarma CMS</span>
        </div>
      </div>
      {query.isLoading && <p role="status">Cargando estado de las inyectoras…</p>}
      <div className="injection-grid">
        {machines.map((machine) => {
          const r = machine.reading;
          const live =
            machine.cmsFresh && machine.communicationFresh && snapshot?.communication === 'RECENT';
          const mode = r?.operation_status_text?.trim().toUpperCase();
          const hasAlarm = live && r?.alarm_status_code != null && r.alarm_status_code !== 0;
          const producing = isProducing(machine, snapshot);
          const loadedFile = live
            ? machine.ultimo_ciclo_tecnico?.mold_name?.trim() || 'No informado'
            : 'Sin confirmar';
          const cardState = !live
            ? 'is-stale'
            : mode === 'PARO' || hasAlarm
              ? 'is-stopped'
              : mode === 'MANUAL'
                ? 'is-manual'
                : producing
                  ? 'is-producing'
                  : 'is-live';
          const state = !r
            ? 'Sin datos'
            : snapshot?.communication !== 'RECENT'
              ? 'Sin conexión reciente con Node-RED'
              : !machine.cmsFresh
                ? 'CMS desactualizado'
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
                          title="Archivo informado por el último ciclo técnico"
                          aria-label={`Archivo informado por el último ciclo técnico: ${loadedFile}`}
                        >
                          · <strong>{loadedFile}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="injection-state">
                    {live ? `Modo ${text(r?.operation_status_text)}` : 'Sin datos recientes'}
                  </span>
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
                    <span>ENVASES · CONTADOR ACTUAL CMS</span>
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
                      <small>PROMEDIO CMS / H</small>
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
                        {live ? number(machine.ultimo_ciclo_tecnico?.shot_number) : 'Sin datos'}
                      </strong>
                    </div>
                    <div>
                      <small>CAVIDADES</small>
                      <strong>
                        {live ? number(machine.ultimo_ciclo_tecnico?.cavity) : 'Sin datos'}
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
                    <p className="injection-tv-alarm">Alarma CMS · código {r.alarm_status_code}</p>
                  )}
                </>
              ) : (
                <>
                  <div className="injection-card__top">
                    <div>
                      <small>
                        {machine.code} · {machine.model}
                        {simulated && <span className="injection-simulation"> · SIMULACIÓN</span>}
                      </small>
                      <div className="injection-card__identity">
                        <h2>{machine.name}</h2>
                        <span
                          className="injection-card__file"
                          title="Archivo informado por el último ciclo técnico"
                        >
                          Archivo: <strong>{loadedFile}</strong>
                        </span>
                      </div>
                    </div>
                    <span className="injection-state">{state}</span>
                  </div>
                  <p className="injection-updated">CMS {time(r?.cms_timestamp)}</p>
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
                    <span>Alarma CMS: código {text(r?.alarm_status_code)}</span>
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
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
