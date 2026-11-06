import { api } from '../../shared/api/http';
import type { AdjustmentReport, LaboratoryDashboard, LaboratoryLot } from './LaboratorySection';
import type { ReportPeriodFilter } from './reporting-period';

export async function loadLaboratoryReportData(period: ReportPeriodFilter, plantIds?: string) {
  const [dashboardResponse, firstResponse] = await Promise.all([
    api.get<LaboratoryDashboard>('/reporting/laboratory', { params: { ...period, plantIds } }),
    api.get<AdjustmentReport>('/reporting/laboratory/adjustments', {
      params: { ...period, plantIds, offset: 0, limit: 100 }
    })
  ]);
  const dashboard = dashboardResponse.data;
  const first = firstResponse.data;
  const total = first.detail.total;
  if (total > 100_000) {
    throw new Error(
      'El detalle supera el límite de descarga de 100.000 solicitudes. Acotá el período o las plantas.'
    );
  }
  const rows = [...first.detail.rows];
  const ids = new Set(rows.map((row) => row.id));
  for (let offset = 100; offset < total; offset += 100) {
    const { data: page } = await api.get<AdjustmentReport>('/reporting/laboratory/adjustments', {
      params: { ...period, plantIds, offset, limit: 100 }
    });
    if (
      page.detail.total !== total ||
      page.totalRequests !== first.totalRequests ||
      page.totalMentions !== first.totalMentions
    )
      throw new Error('Los datos cambiaron durante la descarga. Volvé a intentarlo.');
    for (const row of page.detail.rows) {
      if (ids.has(row.id))
        throw new Error('El orden del detalle cambió durante la descarga. Volvé a intentarlo.');
      ids.add(row.id);
      rows.push(row);
    }
  }
  if (rows.length !== total) throw new Error('El detalle está incompleto. Volvé a intentarlo.');
  const motives = new Map<string, number>();
  const materials = new Map<string, { requests: number; lots: Set<string> }>();
  const materialMotives = new Map<string, number>();
  for (const row of rows) {
    const material = materials.get(row.lot.materialCode) ?? {
      requests: 0,
      lots: new Set<string>()
    };
    material.requests += 1;
    material.lots.add(row.lotId);
    materials.set(row.lot.materialCode, material);
    const values = row.adjustmentReasons.length ? row.adjustmentReasons : ['Sin clasificar'];
    for (const value of values) {
      const reason = value.trim() || 'Sin clasificar';
      motives.set(reason, (motives.get(reason) ?? 0) + 1);
      const pair = JSON.stringify([row.lot.materialCode, reason]);
      materialMotives.set(pair, (materialMotives.get(pair) ?? 0) + 1);
    }
  }
  if (
    [...motives.values()].reduce((sum, value) => sum + value, 0) !== first.totalMentions ||
    first.pareto.some((row) => motives.get(row.reason) !== row.mentions) ||
    motives.size !== first.pareto.length
  )
    throw new Error('Los motivos cambiaron durante la descarga. Volvé a intentarlo.');
  if (
    first.materialPareto.length !== materials.size ||
    first.materialPareto.some((row) => {
      const value = materials.get(row.materialCode);
      return value?.requests !== row.requests || value.lots.size !== row.adjustedLots;
    }) ||
    first.materialReasons.length !== materialMotives.size ||
    first.materialReasons.some(
      (row) => materialMotives.get(JSON.stringify([row.materialCode, row.reason])) !== row.mentions
    )
  )
    throw new Error('El Pareto de materiales cambió durante la descarga. Volvé a intentarlo.');
  const { data: verified } = await api.get<LaboratoryDashboard>('/reporting/laboratory', {
    params: { ...period, plantIds }
  });
  if (
    JSON.stringify(verified.totals) !== JSON.stringify(dashboard.totals) ||
    dashboard.totals.adjustmentRequests !== first.totalRequests ||
    dashboard.totals.adjustedLots !== first.adjustedLots ||
    dashboard.totals.reasonMentions !== first.totalMentions
  )
    throw new Error('Los indicadores cambiaron durante la descarga. Volvé a intentarlo.');
  return {
    dashboard,
    adjustments: { ...first, detail: { ...first.detail, rows, limit: total } }
  };
}

export async function loadDisalLogoDataUrl(): Promise<string> {
  const response = await fetch('/brand/grupo-disal-logo.png');
  if (!response.ok) throw new Error('No se pudo cargar el logo de Grupo DISAL.');
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo preparar el logo para el PDF.'));
    reader.readAsDataURL(blob);
  });
}

export async function loadAdjustedLotDetails(report: AdjustmentReport): Promise<LaboratoryLot[]> {
  const ids = [...new Set(report.detail.rows.map((row) => row.lotId))];
  if (ids.length > 1000)
    throw new Error(
      'Hay más de 1.000 OF con ajustes. Acotá el período o las plantas para exportar sus ciclos.'
    );
  const lots: LaboratoryLot[] = [];
  for (let index = 0; index < ids.length; index += 10) {
    const batch = await Promise.all(
      ids
        .slice(index, index + 10)
        .map((id) =>
          api
            .get<LaboratoryLot>(`/reporting/laboratory/lots/${encodeURIComponent(id)}`)
            .then((response) => response.data)
        )
    );
    if (batch.some((lot) => lot.truncated))
      throw new Error(
        'Una OF supera los 100 ciclos disponibles. El libro no se generó incompleto.'
      );
    lots.push(...batch);
  }
  return lots;
}
