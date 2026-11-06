import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../shared/api/http';
import { getSessionUser } from '../auth/session';
import {
  loadAdjustedLotDetails,
  loadDisalLogoDataUrl,
  loadLaboratoryReportData
} from './laboratory-report-data';
import type { ReportPeriodFilter } from './reporting-period';

export interface LaboratoryDashboard {
  datasetVersion: string;
  metricVersion: string;
  dataCutoff: string;
  period: { month: string; label: string; from: string | null; to: string | null };
  includedPlants: Array<{ id: string; code: string; name: string }>;
  totals: {
    receivedSamples: number;
    resolvedSamples: number;
    adjustmentRequests: number;
    adjustedLots: number;
    reasonMentions: number;
    evaluatedLots: number;
    firstPassApproved: number;
    firstPassRatePercent: number | null;
    multipleCycleLots: number;
  };
  times: {
    receiptWait: { count: number; averageSeconds: number | null };
    analysisWait: { count: number; averageSeconds: number | null };
    analysisElapsed: { count: number; averageSeconds: number | null };
    laboratoryOccupancySeconds: number;
  };
  coverage: {
    missingAnalysisStart: number;
    invalidChronology: number;
    invalidLaboratoryIntervals: number;
  };
  byPlant: Array<{ plantId: string; code: string; decisions: number; adjustments: number }>;
  trend: Array<{ month: string; decisions: number; adjustments: number }>;
}

export interface AdjustmentReport {
  totalRequests: number;
  adjustedLots: number;
  totalMentions: number;
  pareto: Array<{
    reason: string;
    mentions: number;
    percent: number;
    cumulativePercent: number;
  }>;
  materialPareto: Array<{
    materialCode: string;
    requests: number;
    adjustedLots: number;
    percent: number;
    cumulativePercent: number;
  }>;
  materialReasons: Array<{ materialCode: string; reason: string; mentions: number }>;
  detail: {
    total: number;
    offset: number;
    limit: number;
    rows: Array<{
      id: string;
      lotId: string;
      plantId: string;
      createdAt: string;
      adjustmentReasons: string[];
      lot: { manufacturingOrder: string; materialCode: string; description: string };
      adjustmentItems: Array<{ materialCode: string; quantityKg: string }>;
    }>;
  };
}

export interface LaboratoryLot {
  lot: { id: string; manufacturingOrder: string; materialCode: string; description: string };
  plant: { id: string; code: string; name: string };
  samples: Array<{
    id: string;
    iteration: number;
    requestedAt: string;
    receivedAt: string | null;
    analysisStartedAt: string | null;
    resolvedAt: string | null;
    qualityDecision: { result: string; adjustmentReasons: string[] } | null;
  }>;
  truncated: boolean;
}

const integer = (value: number) => value.toLocaleString('es-AR');
const duration = (value: number | null) =>
  value === null
    ? 'Sin dato'
    : `${(value / 3600).toLocaleString('es-AR', { maximumFractionDigits: 1 })} h`;
const date = (value: string) =>
  new Date(value).toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    dateStyle: 'short',
    timeStyle: 'short'
  });

export function LaboratorySection({
  period,
  periodLabel,
  plantIds,
  userId,
  canOpenHistory,
  plantSampleCounts
}: {
  period: ReportPeriodFilter;
  periodLabel: string;
  plantIds?: string;
  userId?: string;
  canOpenHistory: boolean;
  plantSampleCounts: Record<string, number>;
}) {
  const [materialCode, setMaterialCode] = useState('');
  const [appliedMaterial, setAppliedMaterial] = useState('');
  const [offset, setOffset] = useState(0);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const downloadPdf = async () => {
    setDownloadingPdf(true);
    setPdfError(null);
    try {
      const [{ dashboard, adjustments }, logoDataUrl, pdf] = await Promise.all([
        loadLaboratoryReportData(period, plantIds),
        loadDisalLogoDataUrl(),
        import('./laboratory-report-pdf')
      ]);
      pdf.downloadLaboratoryReportPdf({
        dashboard,
        adjustments,
        logoDataUrl,
        generatedBy: getSessionUser()?.fullName ?? 'Usuario autenticado'
      });
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : 'No se pudo generar el informe.');
    } finally {
      setDownloadingPdf(false);
    }
  };
  const downloadExcel = async () => {
    setDownloadingExcel(true);
    setPdfError(null);
    try {
      const [{ dashboard, adjustments }, exporter] = await Promise.all([
        loadLaboratoryReportData(period, plantIds),
        import('./laboratory-report-xlsx')
      ]);
      const lots = await loadAdjustedLotDetails(adjustments);
      await exporter.downloadLaboratoryReportXlsx({ dashboard, adjustments, lots });
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : 'No se pudo generar el Excel.');
    } finally {
      setDownloadingExcel(false);
    }
  };
  const dashboard = useQuery({
    queryKey: ['reporting-laboratory', userId, period, plantIds],
    queryFn: () =>
      api
        .get<LaboratoryDashboard>('/reporting/laboratory', { params: { ...period, plantIds } })
        .then((response) => response.data)
  });
  const adjustments = useQuery({
    queryKey: ['reporting-adjustments', userId, period, plantIds, appliedMaterial, offset],
    queryFn: () =>
      api
        .get<AdjustmentReport>('/reporting/laboratory/adjustments', {
          params: {
            ...period,
            plantIds,
            materialCode: appliedMaterial || undefined,
            offset,
            limit: 25
          }
        })
        .then((response) => response.data)
  });
  const lotDetail = useQuery({
    queryKey: ['reporting-laboratory-lot', userId, selectedLotId],
    enabled: selectedLotId !== null,
    queryFn: () =>
      api
        .get<LaboratoryLot>(`/reporting/laboratory/lots/${selectedLotId}`)
        .then((response) => response.data)
  });
  const plantById = new Map(dashboard.data?.includedPlants.map((plant) => [plant.id, plant]) ?? []);
  const lab = dashboard.data;
  const totals = lab?.totals;
  return (
    <section id="laboratorio" className="reporting-panel">
      <div className="reporting-heading">
        <div>
          <span className="reporting-eyebrow">02 / LABORATORIO</span>
          <h2>Análisis de calidad</h2>
        </div>
        <div className="reporting-report-action">
          <small>
            {dashboard.data?.includedPlants.length ?? '…'}{' '}
            {dashboard.data?.includedPlants.length === 1 ? 'planta' : 'plantas'} · {periodLabel}
          </small>
          <button
            type="button"
            className="ds-button ds-button--primary"
            onClick={downloadPdf}
            disabled={
              downloadingPdf || dashboard.isLoading || !dashboard.data?.includedPlants.length
            }
          >
            {downloadingPdf ? 'Preparando informe…' : 'Descargar PDF Grupo DISAL'}
          </button>
          <button
            type="button"
            className="ds-button ds-button--secondary"
            onClick={downloadExcel}
            disabled={
              downloadingExcel || dashboard.isLoading || !dashboard.data?.includedPlants.length
            }
          >
            {downloadingExcel ? 'Preparando Excel…' : 'Descargar Excel'}
          </button>
        </div>
      </div>
      {pdfError ? <p role="alert">{pdfError}</p> : null}
      {dashboard.isLoading ? <p role="status">Calculando métricas de Laboratorio…</p> : null}
      {dashboard.isError ? (
        <p role="alert">No se pudo cargar Laboratorio. Revisá el período y las plantas.</p>
      ) : null}
      {lab && totals ? (
        <>
          <div className="reporting-kpis">
            {[
              ['Solicitudes de ajuste', integer(totals.adjustmentRequests)],
              ['OF con ajuste', integer(totals.adjustedLots)],
              ['Menciones de motivos', integer(totals.reasonMentions)],
              [
                'Aprobación inicial',
                totals.firstPassRatePercent === null
                  ? 'Sin población'
                  : `${totals.firstPassRatePercent.toLocaleString('es-AR')} %`
              ],
              ['OF evaluadas por primera vez', integer(totals.evaluatedLots)],
              ['Muestras recibidas', integer(totals.receivedSamples)]
            ].map(([label, value]) => (
              <div className="reporting-kpi" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <p className="reporting-note">
            La aprobación inicial usa la primera muestra resuelta de cada OF dentro del período.{' '}
            {integer(totals.firstPassApproved)} de {integer(totals.evaluatedLots)} OF. Las
            solicitudes usan la fecha de decisión; los motivos pueden ser múltiples por solicitud.
          </p>
          <div className="reporting-lab-grid">
            <div>
              <h3>Tiempos transcurridos</h3>
              <table>
                <thead>
                  <tr>
                    <th>Intervalo</th>
                    <th>Promedio</th>
                    <th>Registros válidos</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Solicitud → recepción</td>
                    <td>{duration(lab.times.receiptWait.averageSeconds)}</td>
                    <td>{integer(lab.times.receiptWait.count)}</td>
                  </tr>
                  <tr>
                    <td>Recepción → inicio de análisis</td>
                    <td>{duration(lab.times.analysisWait.averageSeconds)}</td>
                    <td>{integer(lab.times.analysisWait.count)}</td>
                  </tr>
                  <tr>
                    <td>Inicio → resolución</td>
                    <td>{duration(lab.times.analysisElapsed.averageSeconds)}</td>
                    <td>{integer(lab.times.analysisElapsed.count)}</td>
                  </tr>
                </tbody>
              </table>
              <p className="reporting-note">
                Muestras resueltas sin inicio de análisis:{' '}
                {integer(lab.coverage.missingAnalysisStart)}. Cronologías inválidas:{' '}
                {integer(lab.coverage.invalidChronology)}. Intervalos de estado inválidos:{' '}
                {integer(lab.coverage.invalidLaboratoryIntervals)}. Estos tiempos pueden
                superponerse; no miden trabajo efectivo.
              </p>
            </div>
            <div>
              <h3>Evolución de decisiones</h3>
              {lab.trend.length ? (
                <div
                  className="reporting-chart"
                  role="img"
                  aria-label="Decisiones y solicitudes de ajuste por mes"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={lab.trend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="decisions" name="Decisiones" fill="#19849c" />
                      <Bar dataKey="adjustments" name="Ajustes" fill="#e29649" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p>Sin decisiones en los meses consultados.</p>
              )}
              <div className="reporting-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Mes</th>
                      <th>Decisiones</th>
                      <th>Ajustes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lab.trend.map((row) => (
                      <tr key={row.month}>
                        <td>{row.month}</td>
                        <td>{integer(row.decisions)}</td>
                        <td>{integer(row.adjustments)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <h3>Comparación por planta</h3>
          <div className="reporting-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Planta</th>
                  <th>Decisiones</th>
                  <th>Solicitudes de ajuste</th>
                </tr>
              </thead>
              <tbody>
                {lab.byPlant.map((row) => (
                  <tr key={row.plantId}>
                    <td>{plantById.get(row.plantId)?.name ?? row.code}</td>
                    <td>
                      {plantSampleCounts[row.plantId]
                        ? integer(row.decisions)
                        : 'Cobertura no verificada'}
                    </td>
                    <td>
                      {plantSampleCounts[row.plantId]
                        ? integer(row.adjustments)
                        : 'Cobertura no verificada'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="reporting-note">
            Los ceros indican ausencia de registros para el período en plantas con muestras
            observadas. Sin muestras históricas, la capacidad de Laboratorio no está verificada.
          </p>
        </>
      ) : null}
      <div className="reporting-heading">
        <div>
          <h3>Pareto de motivos de ajuste</h3>
          <p className="reporting-note">
            Porcentaje sobre menciones; una solicitud puede aportar varios motivos.
          </p>
        </div>
      </div>
      <form
        className="reporting-material-filter"
        onSubmit={(event) => {
          event.preventDefault();
          setAppliedMaterial(materialCode.trim());
          setOffset(0);
        }}
      >
        <label>
          Material de la OF{' '}
          <input
            value={materialCode}
            maxLength={64}
            onChange={(event) => setMaterialCode(event.target.value)}
            placeholder="Todos los materiales"
          />
        </label>
        <button type="submit" className="ds-button ds-button--secondary">
          Aplicar
        </button>
        {appliedMaterial ? (
          <button
            type="button"
            onClick={() => {
              setMaterialCode('');
              setAppliedMaterial('');
              setOffset(0);
            }}
          >
            Limpiar
          </button>
        ) : null}
      </form>
      {adjustments.isLoading ? <p role="status">Calculando Pareto…</p> : null}
      {adjustments.isError ? (
        <p role="alert">No se pudo cargar el Pareto. Revisá el material.</p>
      ) : null}
      {adjustments.data ? (
        <>
          <p>
            {integer(adjustments.data.totalRequests)} solicitudes ·{' '}
            {integer(adjustments.data.totalMentions)} menciones ·{' '}
            {integer(adjustments.data.adjustedLots)} OF
          </p>
          {adjustments.data.pareto.length ? (
            <div
              className="reporting-chart"
              role="img"
              aria-label="Cantidad de menciones por motivo"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={adjustments.data.pareto} layout="vertical" margin={{ left: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="reason" width={150} />
                  <Tooltip />
                  <Bar dataKey="mentions" name="Menciones" fill="#19849c" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p>No hay ajustes para estos filtros.</p>
          )}
          <div className="reporting-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Motivo</th>
                  <th>Menciones</th>
                  <th>%</th>
                  <th>% acumulado</th>
                </tr>
              </thead>
              <tbody>
                {adjustments.data.pareto.map((row) => (
                  <tr key={row.reason}>
                    <td>{row.reason}</td>
                    <td>{integer(row.mentions)}</td>
                    <td>{row.percent.toLocaleString('es-AR')} %</td>
                    <td>{row.cumulativePercent.toLocaleString('es-AR')} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="reporting-heading">
            <div>
              <h3>Pareto de materiales ajustados</h3>
              <p className="reporting-note">
                Material del producto fabricado en la OF. Porcentaje sobre solicitudes de ajuste;
                los insumos agregados durante el ajuste figuran en el detalle inferior.
              </p>
            </div>
          </div>
          {adjustments.data.materialPareto.length ? (
            <div
              className="reporting-chart"
              role="img"
              aria-label="Solicitudes de ajuste por material de la OF"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={adjustments.data.materialPareto.slice(0, 12)}
                  layout="vertical"
                  margin={{ left: 30 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="materialCode" width={150} />
                  <Tooltip />
                  <Bar dataKey="requests" name="Solicitudes" fill="#19849c" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}
          <div className="reporting-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Material de la OF</th>
                  <th>Solicitudes</th>
                  <th>OF distintas</th>
                  <th>Motivo más frecuente</th>
                  <th>% solicitudes</th>
                  <th>% acumulado</th>
                </tr>
              </thead>
              <tbody>
                {adjustments.data.materialPareto.map((row) => {
                  const leading = adjustments.data.materialReasons.find(
                    (item) => item.materialCode === row.materialCode
                  );
                  return (
                    <tr key={row.materialCode}>
                      <td>{row.materialCode}</td>
                      <td>{integer(row.requests)}</td>
                      <td>{integer(row.adjustedLots)}</td>
                      <td>
                        {leading
                          ? `${leading.reason} (${integer(leading.mentions)} ${leading.mentions === 1 ? 'mención' : 'menciones'})`
                          : '—'}
                      </td>
                      <td>{row.percent.toLocaleString('es-AR')} %</td>
                      <td>{row.cumulativePercent.toLocaleString('es-AR')} %</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <h3>Motivos por material de la OF</h3>
          <p className="reporting-note">
            Una solicitud con varios motivos aporta una mención a cada motivo del mismo material.
          </p>
          <div className="reporting-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Material de la OF</th>
                  <th>Motivo</th>
                  <th>Menciones</th>
                </tr>
              </thead>
              <tbody>
                {adjustments.data.materialReasons.map((row) => (
                  <tr key={`${row.materialCode}:${row.reason}`}>
                    <td>{row.materialCode}</td>
                    <td>{row.reason}</td>
                    <td>{integer(row.mentions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>Solicitudes que explican el indicador</h3>
          <div className="reporting-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Planta</th>
                  <th>OF</th>
                  <th>Producto</th>
                  <th>Motivos</th>
                  <th>Materiales de ajuste</th>
                </tr>
              </thead>
              <tbody>
                {adjustments.data.detail.rows.map((row) => (
                  <tr key={row.id}>
                    <td>{date(row.createdAt)}</td>
                    <td>{plantById.get(row.plantId)?.name ?? '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="reporting-inline-button"
                        onClick={() => setSelectedLotId(row.lotId)}
                        aria-label={`Ver ciclos de laboratorio de OF ${row.lot.manufacturingOrder}`}
                      >
                        {row.lot.manufacturingOrder}
                      </button>
                      {canOpenHistory ? (
                        <>
                          {' '}
                          ·{' '}
                          <Link
                            to={`/historial?plant=${encodeURIComponent(plantById.get(row.plantId)?.code ?? '')}&lotId=${encodeURIComponent(row.lotId)}`}
                          >
                            Historial
                          </Link>
                        </>
                      ) : null}
                    </td>
                    <td>{row.lot.description}</td>
                    <td>{row.adjustmentReasons.join(', ') || 'Sin clasificar'}</td>
                    <td>
                      {row.adjustmentItems.map((item) => item.materialCode).join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="reporting-pagination">
            <button
              type="button"
              disabled={offset === 0 || adjustments.isFetching}
              onClick={() => setOffset(Math.max(0, offset - 25))}
            >
              Anterior
            </button>
            <span>
              {adjustments.data.detail.total === 0
                ? '0 de 0'
                : `${offset + 1}–${Math.min(offset + 25, adjustments.data.detail.total)} de ${adjustments.data.detail.total}`}
            </span>
            <button
              type="button"
              disabled={offset + 25 >= adjustments.data.detail.total || adjustments.isFetching}
              onClick={() => setOffset(offset + 25)}
            >
              Siguiente
            </button>
          </div>
        </>
      ) : null}
      {selectedLotId ? (
        <section className="reporting-lot-detail" aria-label="Detalle de OF">
          <div className="reporting-heading">
            <h3>Ciclos de Laboratorio por OF</h3>
            <button type="button" onClick={() => setSelectedLotId(null)}>
              Cerrar
            </button>
          </div>
          {lotDetail.isLoading ? <p role="status">Cargando ciclos…</p> : null}
          {lotDetail.isError ? <p role="alert">No se pudo cargar esta OF.</p> : null}
          {lotDetail.data ? (
            <>
              <p>
                <strong>{lotDetail.data.lot.manufacturingOrder}</strong> ·{' '}
                {lotDetail.data.lot.description} · {lotDetail.data.plant.name}
              </p>
              <div className="reporting-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Iteración</th>
                      <th>Solicitud</th>
                      <th>Recepción</th>
                      <th>Inicio análisis</th>
                      <th>Resolución</th>
                      <th>Decisión</th>
                      <th>Motivos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotDetail.data.samples.map((sample) => (
                      <tr key={sample.id}>
                        <td>{sample.iteration}</td>
                        <td>{date(sample.requestedAt)}</td>
                        <td>{sample.receivedAt ? date(sample.receivedAt) : 'Pendiente'}</td>
                        <td>
                          {sample.analysisStartedAt ? date(sample.analysisStartedAt) : 'Sin dato'}
                        </td>
                        <td>{sample.resolvedAt ? date(sample.resolvedAt) : 'Pendiente'}</td>
                        <td>{sample.qualityDecision?.result ?? 'Sin decisión'}</td>
                        <td>{sample.qualityDecision?.adjustmentReasons.join(', ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {lotDetail.data.truncated ? (
                <p className="reporting-note">
                  La OF supera el límite de 100 ciclos; el detalle requiere consulta adicional.
                </p>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
