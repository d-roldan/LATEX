import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getSessionUser } from '../auth/session';
import { api } from '../../shared/api/http';
import { LaboratorySection } from './LaboratorySection';
import { ProductionSection } from './ProductionSection';
import { reportPeriodLabel, type ReportPeriodFilter } from './reporting-period';
import './reporting.css';

interface PlantCoverage {
  id: string;
  code: string;
  name: string;
  finalOperation: string;
  observedRecords: {
    lots: number;
    laboratorySamples: number;
    packagingOrders: number;
    stateEvents: number;
  };
}

interface Overview {
  period: {
    month: string;
    label: string;
    startInclusive: string;
    endExclusive: string;
    timeZone: string;
  };
  includedPlants: Array<{ id: string; code: string; name: string }>;
  totals: {
    startedLots: number;
    finishedLots: number;
    decisions: number;
    adjustments: number;
    receivedSamples: number;
  };
  warnings: string[];
}

interface OrderRow {
  id: string;
  plantId: string;
  manufacturingOrder: string;
  materialCode: string;
  description: string;
  plannedQuantityKg: string | null;
  startedAt: string;
  finishedAt: string | null;
  tank: { number: number; name: string };
}

interface Orders {
  total: number;
  rows: OrderRow[];
}

const monthNow = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit'
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return `${year}-${month}`;
};
const todayArgentina = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
};

export function ReportingPage() {
  const user = getSessionUser();
  const userId = user?.id;
  const laboratoryOnly = user?.role === 'LABORATORIO';
  const [params, setParams] = useSearchParams();
  const month = params.get('month') ?? monthNow();
  const rangeFrom = params.get('from');
  const rangeTo = params.get('to');
  const rangeMode = params.get('mode') === 'range' || Boolean(rangeFrom && rangeTo);
  const period: ReportPeriodFilter =
    rangeFrom && rangeTo ? { from: rangeFrom, to: rangeTo } : { month };
  const periodLabel = reportPeriodLabel(period);
  const selectedParam = params.get('plants');
  const selected =
    selectedParam && selectedParam !== 'none' ? selectedParam.split(',').filter(Boolean) : [];
  const [draftFrom, setDraftFrom] = useState(rangeFrom ?? `${month}-01`);
  const [draftTo, setDraftTo] = useState(() => {
    if (rangeTo) return rangeTo;
    const today = todayArgentina();
    if (month === today.slice(0, 7)) return today;
    const [year, monthNumber] = month.split('-').map(Number);
    return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
  });
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const capabilities = useQuery({
    queryKey: ['reporting-capabilities', userId],
    queryFn: () =>
      api
        .get<{ plants: PlantCoverage[] }>('/reporting/capabilities')
        .then((response) => response.data)
  });
  const plantIds =
    selectedParam === 'none' ? 'none' : selected.length ? selected.join(',') : undefined;
  const allSelected =
    selectedParam !== 'none' &&
    (selectedParam === null || selected.length === (capabilities.data?.plants.length ?? 0));
  const overview = useQuery({
    enabled: !laboratoryOnly,
    queryKey: ['reporting-overview', userId, period, plantIds],
    queryFn: () =>
      api
        .get<Overview>('/reporting/overview', { params: { ...period, plantIds } })
        .then((response) => response.data)
  });
  const orders = useQuery({
    enabled: !laboratoryOnly,
    queryKey: ['reporting-orders', userId, period, plantIds, offset],
    queryFn: () =>
      api
        .get<Orders>('/reporting/orders', { params: { ...period, plantIds, offset, limit: 25 } })
        .then((response) => response.data)
  });
  const plantsById = useMemo(
    () => new Map(capabilities.data?.plants.map((plant) => [plant.id, plant]) ?? []),
    [capabilities.data]
  );
  const updateFilter = (key: 'month' | 'plants', value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setOffset(0);
    setParams(next);
  };
  const togglePlant = (id: string) => {
    const all = capabilities.data?.plants.map((plant) => plant.id) ?? [];
    const current = selectedParam === 'none' ? [] : selectedParam === null ? all : selected;
    const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
    if (next.length === 0) updateFilter('plants', 'none');
    else if (next.length === all.length) updateFilter('plants', null);
    else updateFilter('plants', next.join(','));
  };
  const applyRange = (event: FormEvent) => {
    event.preventDefault();
    if (!draftFrom || !draftTo || draftFrom > draftTo) {
      setRangeError('Elegí una fecha de inicio anterior o igual a la de fin.');
      return;
    }
    const days = (Date.parse(draftTo) - Date.parse(draftFrom)) / 86_400_000;
    if (days > 365) {
      setRangeError('El rango puede abarcar hasta 366 días.');
      return;
    }
    setRangeError(null);
    const next = new URLSearchParams(params);
    next.set('mode', 'range');
    next.set('from', draftFrom);
    next.set('to', draftTo);
    next.delete('month');
    setOffset(0);
    setParams(next);
  };
  const date = (value: string) =>
    new Date(value).toLocaleString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  const number = (value: number) => value.toLocaleString('es-AR');
  return (
    <section className="reporting-page">
      <header className="reporting-hero">
        <h1>Reportería</h1>
      </header>

      <div className="reporting-filters" aria-label="Filtros de reportería">
        <div className="reporting-period-filter">
          <span className="reporting-filter-label">Período</span>
          <div className="reporting-period-modes" aria-label="Tipo de período">
            <button
              type="button"
              className={`ds-button ds-button--sm ds-button--secondary ${!rangeMode ? 'is-active' : ''}`}
              aria-pressed={!rangeMode}
              onClick={() => {
                const next = new URLSearchParams(params);
                next.delete('mode');
                next.delete('from');
                next.delete('to');
                next.set('month', month);
                setOffset(0);
                setParams(next);
              }}
            >
              Mes
            </button>
            <button
              type="button"
              className={`ds-button ds-button--sm ds-button--secondary ${rangeMode ? 'is-active' : ''}`}
              aria-pressed={rangeMode}
              onClick={() => {
                const next = new URLSearchParams(params);
                next.set('mode', 'range');
                setParams(next);
              }}
            >
              Rango
            </button>
          </div>
          {rangeMode ? (
            <form className="reporting-range-fields" onSubmit={applyRange}>
              <label>
                Desde{' '}
                <input
                  type="date"
                  value={draftFrom}
                  onChange={(event) => setDraftFrom(event.target.value)}
                  required
                />
              </label>
              <label>
                Hasta{' '}
                <input
                  type="date"
                  value={draftTo}
                  onChange={(event) => setDraftTo(event.target.value)}
                  required
                />
              </label>
              <button type="submit" className="ds-button ds-button--primary">
                Aplicar rango
              </button>
              {rangeError ? <span role="alert">{rangeError}</span> : null}
            </form>
          ) : (
            <label className="reporting-month-field">
              Mes{' '}
              <input
                type="month"
                value={month}
                onChange={(event) => updateFilter('month', event.target.value)}
              />
            </label>
          )}
        </div>
        <fieldset>
          <legend>Plantas</legend>
          <button
            type="button"
            className="ds-button ds-button--secondary ds-button--sm"
            onClick={() => updateFilter('plants', allSelected ? 'none' : null)}
          >
            {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
          </button>
          {capabilities.data?.plants.map((plant) => (
            <label key={plant.id} className="reporting-plant-option">
              <input
                type="checkbox"
                checked={allSelected || selected.includes(plant.id)}
                onChange={() => togglePlant(plant.id)}
              />
              {plant.name}
            </label>
          ))}
          {capabilities.isLoading ? <span>Cargando plantas…</span> : null}
          {capabilities.isError ? (
            <span role="alert">No se pudieron cargar las plantas.</span>
          ) : null}
        </fieldset>
      </div>

      {!laboratoryOnly ? (
        <section id="resumen" className="reporting-panel">
          <div className="reporting-heading">
            <div>
              <span className="reporting-eyebrow">01 / RESUMEN GENERAL</span>
              <h2>Actividad del período</h2>
            </div>
            {overview.data ? (
              <small>
                {overview.data.includedPlants.length}{' '}
                {overview.data.includedPlants.length === 1 ? 'planta' : 'plantas'} ·{' '}
                {overview.data.period.label}
              </small>
            ) : null}
          </div>
          {overview.isLoading ? <p role="status">Calculando indicadores…</p> : null}
          {overview.isError ? (
            <p role="alert">No se pudo cargar el resumen. Revisá los filtros.</p>
          ) : null}
          {overview.data ? (
            <>
              <div className="reporting-kpis">
                {[
                  ['OF iniciadas', overview.data.totals.startedLots],
                  ['OF finalizadas', overview.data.totals.finishedLots],
                  ['Decisiones de calidad', overview.data.totals.decisions],
                  ['Solicitudes de ajuste', overview.data.totals.adjustments],
                  ['Muestras recibidas', overview.data.totals.receivedSamples]
                ].map(([label, value]) => (
                  <div className="reporting-kpi" key={label}>
                    <span>{label}</span>
                    <strong>{number(value as number)}</strong>
                  </div>
                ))}
              </div>
              <p className="reporting-note">
                Cada total usa la fecha de su propio evento. Los registros históricos pueden tener
                cobertura desigual; no se calcula una tasa hasta validar su población.
              </p>
            </>
          ) : null}
        </section>
      ) : null}

      <LaboratorySection
        period={period}
        periodLabel={periodLabel}
        plantIds={plantIds}
        userId={userId}
        canOpenHistory={!laboratoryOnly}
        plantSampleCounts={Object.fromEntries(
          capabilities.data?.plants.map((plant) => [
            plant.id,
            plant.observedRecords.laboratorySamples
          ]) ?? []
        )}
      />

      {!laboratoryOnly ? (
        <section id="produccion" className="reporting-panel">
          <span className="reporting-eyebrow">03 / PRODUCCIÓN</span>
          <h2>Órdenes de fabricación</h2>
          <p>
            La cantidad planificada se muestra como referencia; aún no hay una fuente validada de kg
            fabricados reales por OF.
          </p>
          <ProductionSection period={period} plantIds={plantIds} userId={userId} />
          {orders.isLoading ? <p role="status">Cargando órdenes…</p> : null}
          {orders.isError ? <p role="alert">No se pudieron cargar las órdenes.</p> : null}
          {orders.data ? (
            <>
              <div className="reporting-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Planta</th>
                      <th>OF</th>
                      <th>Producto</th>
                      <th>Tanque</th>
                      <th>Inicio</th>
                      <th>Fin</th>
                      <th>Plan kg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.data.rows.map((row) => {
                      const plant = plantsById.get(row.plantId);
                      return (
                        <tr key={row.id}>
                          <td>{plant?.name ?? '—'}</td>
                          <td>
                            <Link to={`/historial?plant=${plant?.code ?? ''}&lotId=${row.id}`}>
                              {row.manufacturingOrder}
                            </Link>
                          </td>
                          <td>{row.description}</td>
                          <td>{row.tank.name}</td>
                          <td>{date(row.startedAt)}</td>
                          <td>{row.finishedAt ? date(row.finishedAt) : 'En curso'}</td>
                          <td>{row.plannedQuantityKg ?? 'Sin dato'}</td>
                        </tr>
                      );
                    })}
                    {orders.data.total === 0 ? (
                      <tr>
                        <td colSpan={7}>No hay OF iniciadas en el período seleccionado.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="reporting-pagination">
                <button
                  type="button"
                  disabled={offset === 0 || orders.isFetching}
                  onClick={() => setOffset(Math.max(0, offset - 25))}
                >
                  Anterior
                </button>
                <span>
                  {orders.data.total === 0
                    ? '0 de 0'
                    : `${offset + 1}–${Math.min(offset + 25, orders.data.total)} de ${orders.data.total}`}
                </span>
                <button
                  type="button"
                  disabled={offset + 25 >= orders.data.total || orders.isFetching}
                  onClick={() => setOffset(offset + 25)}
                >
                  Siguiente
                </button>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {!laboratoryOnly ? (
        <section id="informes" className="reporting-panel">
          <span className="reporting-eyebrow">04 / CENTRO DE INFORMES</span>
          <h2>Informes de Grupo DISAL</h2>
          <p>
            El informe de Laboratorio está disponible con el período y las plantas seleccionadas.
            Incluye indicadores, Pareto, todas las solicitudes de ajuste y metodología.
          </p>
          <a href="#laboratorio" className="reporting-report-link ds-button ds-button--secondary">
            Ir a descargar el PDF
          </a>
        </section>
      ) : null}
    </section>
  );
}
