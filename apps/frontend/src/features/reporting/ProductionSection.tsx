import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../shared/api/http';
import type { ReportPeriodFilter } from './reporting-period';

interface ProductionDashboard {
  totals: {
    startedLots: number;
    finishedLots: number;
    plannedKgStarted: string | null;
    plannedKgCoverage: { withValue: number; total: number };
    manufacturedKg: null;
    manufacturingClosedIntervals: number;
    manufacturingAverageSeconds: number | null;
    packagingFinishedOrders: number;
    packagedKg: string | null;
    packagedKgCoverage: { withValue: number; total: number };
    packagedUnits: number | null;
    packagedUnitsCoverage: { withValue: number; total: number };
    packagingWasteKg: string | null;
    packagingWasteCoverage: { withValue: number; total: number };
  };
  byPlant: Array<{
    plantId: string;
    name: string;
    startedLots: number;
    finishedLots: number;
    plannedKg: string | null;
    plannedCoverage: number;
  }>;
  byTank: Array<{
    plantId: string;
    tankId: string;
    tankName: string;
    startedLots: number;
    plannedKg: string | null;
    plannedCoverage: number;
  }>;
  trend: Array<{ month: string; startedLots: number; finishedLots: number }>;
}

const count = (value: number) => value.toLocaleString('es-AR');
const kg = (value: string | null) =>
  value === null
    ? 'Sin dato'
    : `${Number(value).toLocaleString('es-AR', { maximumFractionDigits: 3 })} kg`;

export function ProductionSection({
  period,
  plantIds,
  userId
}: {
  period: ReportPeriodFilter;
  plantIds?: string;
  userId?: string;
}) {
  const production = useQuery({
    queryKey: ['reporting-production', userId, period, plantIds],
    queryFn: () =>
      api
        .get<ProductionDashboard>('/reporting/production', { params: { ...period, plantIds } })
        .then((response) => response.data)
  });
  const data = production.data;
  return (
    <>
      {production.isLoading ? <p role="status">Calculando indicadores de Producción…</p> : null}
      {production.isError ? (
        <p role="alert">No se pudieron calcular los indicadores de Producción.</p>
      ) : null}
      {data ? (
        <>
          <div className="reporting-kpis">
            {[
              ['OF iniciadas', count(data.totals.startedLots)],
              ['OF finalizadas', count(data.totals.finishedLots)],
              ['Plan de OF iniciadas', kg(data.totals.plannedKgStarted)],
              ['Kg fabricados reales', 'Sin fuente validada'],
              ['Intervalos FABRICANDO cerrados', count(data.totals.manufacturingClosedIntervals)],
              [
                'Duración promedio de intervalo',
                data.totals.manufacturingAverageSeconds === null
                  ? 'Sin dato'
                  : `${(data.totals.manufacturingAverageSeconds / 3600).toLocaleString('es-AR', { maximumFractionDigits: 1 })} h`
              ]
            ].map(([label, value]) => (
              <div className="reporting-kpi" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <p className="reporting-note">
            Cantidad planificada informada en {count(data.totals.plannedKgCoverage.withValue)} de{' '}
            {count(data.totals.plannedKgCoverage.total)} OF iniciadas. Los intervalos FABRICANDO se
            atribuyen al período de fin y miden tiempo transcurrido, no trabajo efectivo.
          </p>
          <div className="reporting-lab-grid">
            <div>
              <h3>Comparación por planta</h3>
              <div className="reporting-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Planta</th>
                      <th>OF iniciadas</th>
                      <th>OF finalizadas</th>
                      <th>Plan kg</th>
                      <th>Con dato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byPlant.map((row) => (
                      <tr key={row.plantId}>
                        <td>{row.name}</td>
                        <td>{count(row.startedLots)}</td>
                        <td>{count(row.finishedLots)}</td>
                        <td>{kg(row.plannedKg)}</td>
                        <td>
                          {count(row.plannedCoverage)} / {count(row.startedLots)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h3>Tendencia de OF</h3>
              {data.trend.length ? (
                <div
                  className="reporting-chart"
                  role="img"
                  aria-label="OF iniciadas y finalizadas por mes"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.trend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="startedLots" name="Iniciadas" fill="#19849c" />
                      <Bar dataKey="finishedLots" name="Finalizadas" fill="#e29649" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p>Sin OF en el período observado.</p>
              )}
            </div>
          </div>
          {data.byTank.length ? (
            <>
              <h3>OF iniciadas por tanque</h3>
              <div className="reporting-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Planta</th>
                      <th>Tanque</th>
                      <th>OF</th>
                      <th>Plan kg</th>
                      <th>Con dato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byTank.map((row) => (
                      <tr key={row.tankId}>
                        <td>
                          {data.byPlant.find((plant) => plant.plantId === row.plantId)?.name ?? '—'}
                        </td>
                        <td>{row.tankName}</td>
                        <td>{count(row.startedLots)}</td>
                        <td>{kg(row.plannedKg)}</td>
                        <td>
                          {count(row.plannedCoverage)} / {count(row.startedLots)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
          <div className="reporting-packaging">
            <h3>Envasado, informe separado</h3>
            <p>
              {count(data.totals.packagingFinishedOrders)} OE finalizadas ·{' '}
              {kg(data.totals.packagedKg)} envasados ·{' '}
              {data.totals.packagedUnits === null
                ? 'Sin unidades verificadas'
                : `${count(data.totals.packagedUnits)} unidades registradas`}{' '}
              · {kg(data.totals.packagingWasteKg)} de merma de envasado.
            </p>
            <p className="reporting-note">
              Cobertura de kg envasados: {count(data.totals.packagedKgCoverage.withValue)} de{' '}
              {count(data.totals.packagedKgCoverage.total)} OE; unidades:{' '}
              {count(data.totals.packagedUnitsCoverage.withValue)} de{' '}
              {count(data.totals.packagedUnitsCoverage.total)} OE; merma:{' '}
              {count(data.totals.packagingWasteCoverage.withValue)} de{' '}
              {count(data.totals.packagingWasteCoverage.total)} OE. Los kg envasados no se suman a
              los kg fabricados.
            </p>
          </div>
        </>
      ) : null}
    </>
  );
}
