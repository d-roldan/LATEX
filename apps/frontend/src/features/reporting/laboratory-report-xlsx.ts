import ExcelJS from 'exceljs';
import type { AdjustmentReport, LaboratoryDashboard, LaboratoryLot } from './LaboratorySection';

export interface LaboratoryWorkbookData {
  dashboard: LaboratoryDashboard;
  adjustments: AdjustmentReport;
  lots: LaboratoryLot[];
}

const safeText = (value: string) => (/^[\s]*[=+\-@\t\r]/.test(value) ? `'${value}` : value);
const argentineDate = (value: string | null): Date | null => {
  if (!value) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(new Date(value));
  const get = (name: string) => Number(parts.find((part) => part.type === name)?.value);
  return new Date(
    Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  );
};

function sheet(workbook: ExcelJS.Workbook, name: string, headers: string[], widths: number[]) {
  const worksheet = workbook.addWorksheet(name, {
    views: [{ state: 'frozen', ySplit: 1 }]
  });
  worksheet.columns = headers.map((header, index) => ({ header, width: widths[index] }));
  const top = worksheet.getRow(1);
  top.height = 26;
  top.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  top.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A2744' } };
  top.alignment = { vertical: 'middle', wrapText: true };
  worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  return worksheet;
}

export function buildLaboratoryWorkbook(data: LaboratoryWorkbookData) {
  const { dashboard, adjustments, lots } = data;
  if (
    dashboard.totals.adjustmentRequests !== adjustments.totalRequests ||
    dashboard.totals.adjustedLots !== adjustments.adjustedLots ||
    dashboard.totals.reasonMentions !== adjustments.totalMentions ||
    adjustments.detail.rows.length !== adjustments.detail.total
  )
    throw new Error('Los datos de Excel no están conciliados. Volvé a intentarlo.');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Grupo DISAL';
  workbook.subject = 'Informe de Laboratorio';
  workbook.created = new Date();
  const plants = new Map(dashboard.includedPlants.map((plant) => [plant.id, plant.name]));

  const summary = sheet(workbook, 'Resumen', ['Campo', 'Valor'], [38, 65]);
  [
    ['Informe', 'Laboratorio Grupo DISAL'],
    ['Período', dashboard.period.label],
    ['Zona horaria', 'America/Argentina/Buenos_Aires'],
    ['Plantas incluidas', dashboard.includedPlants.length],
    ['Plantas', safeText(dashboard.includedPlants.map((plant) => plant.name).join(', '))],
    ['Corte de intervalos abiertos', argentineDate(dashboard.dataCutoff)],
    ['Versión de dataset', dashboard.datasetVersion],
    ['Versión de métricas', dashboard.metricVersion],
    ['Alcance', 'Valores vigentes al consultar; no reconstrucción histórica inmutable']
  ].forEach((row) => summary.addRow(row));
  summary.getCell('B7').numFmt = 'dd/mm/yyyy hh:mm';

  const indicators = sheet(
    workbook,
    'Indicadores',
    ['Indicador', 'Valor', 'Unidad', 'Denominador / cobertura'],
    [42, 18, 18, 46]
  );
  [
    ['Muestras recibidas', dashboard.totals.receivedSamples, 'muestras', 'Por fecha de recepción'],
    ['Muestras resueltas', dashboard.totals.resolvedSamples, 'muestras', 'Por fecha de resolución'],
    [
      'Solicitudes de ajuste',
      dashboard.totals.adjustmentRequests,
      'decisiones',
      'AJUSTE por fecha de decisión'
    ],
    ['OF con ajuste', dashboard.totals.adjustedLots, 'OF', 'Lotes internos distintos'],
    [
      'Menciones de motivos',
      dashboard.totals.reasonMentions,
      'menciones',
      'Múltiples por decisión'
    ],
    [
      'OF evaluadas por primera vez',
      dashboard.totals.evaluatedLots,
      'OF',
      'Primera muestra resuelta en el período'
    ],
    [
      'OF aprobadas inicialmente',
      dashboard.totals.firstPassApproved,
      'OF',
      'Primera decisión APROBADO'
    ],
    [
      'Aprobación inicial observada',
      dashboard.totals.firstPassRatePercent === null
        ? null
        : dashboard.totals.firstPassRatePercent / 100,
      '%',
      `${dashboard.totals.firstPassApproved} / ${dashboard.totals.evaluatedLots}`
    ],
    [
      'OF con múltiples ciclos',
      dashboard.totals.multipleCycleLots,
      'OF',
      'Cohorte de primera resolución'
    ],
    [
      'Espera de recepción promedio',
      dashboard.times.receiptWait.averageSeconds,
      'segundos',
      `${dashboard.times.receiptWait.count} registros válidos`
    ],
    [
      'Espera de análisis promedio',
      dashboard.times.analysisWait.averageSeconds,
      'segundos',
      `${dashboard.times.analysisWait.count} registros válidos`
    ],
    [
      'Análisis transcurrido promedio',
      dashboard.times.analysisElapsed.averageSeconds,
      'segundos',
      `${dashboard.times.analysisElapsed.count} registros válidos`
    ]
  ].forEach((row) => indicators.addRow(row));
  indicators.getCell('B9').numFmt = '0.00%';

  const byLot = new Map<
    string,
    {
      lotId: string;
      plantId: string;
      order: string;
      material: string;
      description: string;
      requests: number;
      reasons: string[];
    }
  >();
  for (const row of adjustments.detail.rows) {
    const current = byLot.get(row.lotId) ?? {
      lotId: row.lotId,
      plantId: row.plantId,
      order: row.lot.manufacturingOrder,
      material: row.lot.materialCode,
      description: row.lot.description,
      requests: 0,
      reasons: []
    };
    current.requests += 1;
    current.reasons.push(...row.adjustmentReasons);
    byLot.set(row.lotId, current);
  }
  const orders = sheet(
    workbook,
    'OF',
    ['ID lote', 'Planta', 'OF', 'Material', 'Producto', 'Solicitudes de ajuste', 'Motivos'],
    [32, 22, 20, 18, 43, 23, 50]
  );
  for (const row of byLot.values())
    orders.addRow([
      safeText(row.lotId),
      safeText(plants.get(row.plantId) ?? ''),
      safeText(row.order),
      safeText(row.material),
      safeText(row.description),
      row.requests,
      safeText(row.reasons.join(', '))
    ]);

  const adjustmentSheet = sheet(
    workbook,
    'Ajustes',
    ['ID decisión', 'Fecha', 'Planta', 'OF', 'Material', 'Producto', 'Motivos', 'Materiales / kg'],
    [32, 24, 22, 20, 18, 43, 48, 55]
  );
  for (const row of adjustments.detail.rows) {
    const entry = adjustmentSheet.addRow([
      safeText(row.id),
      argentineDate(row.createdAt),
      safeText(plants.get(row.plantId) ?? ''),
      safeText(row.lot.manufacturingOrder),
      safeText(row.lot.materialCode),
      safeText(row.lot.description),
      safeText(row.adjustmentReasons.join(', ') || 'Sin clasificar'),
      safeText(
        row.adjustmentItems.map((item) => `${item.materialCode}: ${item.quantityKg} kg`).join('; ')
      )
    ]);
    entry.getCell(2).numFmt = 'dd/mm/yyyy hh:mm';
  }

  const reasons = sheet(
    workbook,
    'Motivos',
    ['Motivo', 'Menciones', '% de menciones', '% acumulado'],
    [45, 20, 22, 22]
  );
  for (const row of adjustments.pareto) {
    const entry = reasons.addRow([
      safeText(row.reason),
      row.mentions,
      row.percent / 100,
      row.cumulativePercent / 100
    ]);
    entry.getCell(3).numFmt = '0.00%';
    entry.getCell(4).numFmt = '0.00%';
  }

  const materials = sheet(
    workbook,
    'Materiales',
    [
      'Material de la OF',
      'Solicitudes',
      'OF distintas',
      'Motivo más frecuente',
      '% solicitudes',
      '% acumulado'
    ],
    [25, 18, 18, 45, 20, 20]
  );
  for (const row of adjustments.materialPareto) {
    const leading = adjustments.materialReasons.find(
      (item) => item.materialCode === row.materialCode
    );
    const entry = materials.addRow([
      safeText(row.materialCode),
      row.requests,
      row.adjustedLots,
      safeText(
        leading
          ? `${leading.reason} (${leading.mentions} ${leading.mentions === 1 ? 'mención' : 'menciones'})`
          : ''
      ),
      row.percent / 100,
      row.cumulativePercent / 100
    ]);
    entry.getCell(5).numFmt = '0.00%';
    entry.getCell(6).numFmt = '0.00%';
  }
  const materialReasons = sheet(
    workbook,
    'Material y motivo',
    ['Material de la OF', 'Motivo', 'Menciones'],
    [25, 48, 18]
  );
  for (const row of adjustments.materialReasons)
    materialReasons.addRow([safeText(row.materialCode), safeText(row.reason), row.mentions]);

  const cycles = sheet(
    workbook,
    'Ciclos de Laboratorio',
    [
      'Planta',
      'OF',
      'Iteración',
      'Solicitud',
      'Recepción',
      'Inicio de análisis',
      'Resolución',
      'Decisión',
      'Motivos'
    ],
    [22, 20, 12, 24, 24, 24, 24, 24, 48]
  );
  for (const lot of lots)
    for (const sample of lot.samples) {
      const entry = cycles.addRow([
        safeText(lot.plant.name),
        safeText(lot.lot.manufacturingOrder),
        sample.iteration,
        argentineDate(sample.requestedAt),
        argentineDate(sample.receivedAt),
        argentineDate(sample.analysisStartedAt),
        argentineDate(sample.resolvedAt),
        safeText(sample.qualityDecision?.result ?? 'Sin decisión'),
        safeText(sample.qualityDecision?.adjustmentReasons.join(', ') ?? '')
      ]);
      for (let column = 4; column <= 7; column += 1)
        entry.getCell(column).numFmt = 'dd/mm/yyyy hh:mm';
    }

  const method = sheet(workbook, 'Metodología', ['Regla', 'Descripción'], [28, 110]);
  [
    [
      'Alcance de OF y ciclos',
      'Las hojas OF y Ciclos de Laboratorio contienen las OF con ajustes del período, no todas las OF evaluadas.'
    ],
    ['Mes', 'Inicio inclusivo y fin exclusivo en America/Argentina/Buenos_Aires.'],
    [
      'Ajustes',
      'Cada decisión AJUSTE no cancelada es una solicitud; varios materiales no la duplican.'
    ],
    [
      'Pareto',
      'Una decisión puede tener varios motivos. Los porcentajes usan menciones como denominador.'
    ],
    [
      'Pareto de materiales',
      'Material de producto de la OF; cada decisión cuenta una solicitud para ese material. Los porcentajes usan solicitudes como denominador.'
    ],
    [
      'Material y motivo',
      'Cada motivo de una solicitud se atribuye al material de su OF; no a cada insumo agregado durante el ajuste.'
    ],
    [
      'Aprobación inicial',
      'Primera muestra resuelta con decisión vigente por lote, cohorte del período de resolución.'
    ],
    ['Correcciones', 'Datos vigentes al consultar; no hay reconstrucción histórica inmutable.'],
    [
      'Duraciones',
      'Tiempo transcurrido, no trabajo efectivo. Muestras abiertas no reciben duración final.'
    ],
    ['Nulos', 'Los valores faltantes se mantienen vacíos y no se convierten en cero.'],
    ['Texto', 'Campos de texto protegidos contra ejecución de fórmulas.']
  ].forEach((row) => method.addRow(row));
  return workbook;
}

export async function downloadLaboratoryReportXlsx(data: LaboratoryWorkbookData) {
  const workbook = buildLaboratoryWorkbook(data);
  const bytes = await workbook.xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(bytes)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  const period = data.dashboard.period;
  anchor.download = `grupo-disal-laboratorio-${period.from ? `${period.from}-${period.to}` : period.month}.xlsx`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
