import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AdjustmentReport, LaboratoryDashboard } from './LaboratorySection';

export interface LaboratoryReportData {
  dashboard: LaboratoryDashboard;
  adjustments: AdjustmentReport;
  generatedBy: string;
  logoDataUrl: string;
}

const NAVY: [number, number, number] = [10, 39, 68];
const BLUE: [number, number, number] = [18, 103, 146];
const INK: [number, number, number] = [28, 44, 60];
const MUTED: [number, number, number] = [90, 108, 122];
const LIGHT: [number, number, number] = [236, 244, 247];

const number = (value: number) => value.toLocaleString('es-AR');
const dateTime = (value: string) =>
  new Date(value).toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
const monthTitle = (month: string) => {
  const [year, value] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('es-AR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(year, value - 1, 1)));
};
const hours = (seconds: number | null) =>
  seconds === null
    ? 'Sin dato'
    : `${(seconds / 3600).toLocaleString('es-AR', { maximumFractionDigits: 1 })} h`;

function section(doc: jsPDF, title: string, y: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text(title, 16, y);
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.5);
  doc.line(16, y + 2, 281, y + 2);
}

function footer(doc: jsPDF, page: number, total: number, month: string) {
  doc.setDrawColor(209, 222, 230);
  doc.line(16, 191, 281, 191);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text(`Grupo DISAL  |  Laboratorio  |  ${month}  |  Informe v1`, 16, 197);
  doc.text(`Página ${page} de ${total}`, 281, 197, { align: 'right' });
}

function card(doc: jsPDF, x: number, y: number, width: number, label: string, value: string) {
  doc.setFillColor(...LIGHT);
  doc.roundedRect(x, y, width, 23, 2, 2, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(label, x + 4, y + 7);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...NAVY);
  doc.text(value, x + 4, y + 17);
}

export function buildLaboratoryReportPdf(data: LaboratoryReportData): jsPDF {
  const { dashboard, adjustments, generatedBy, logoDataUrl } = data;
  if (
    dashboard.totals.adjustmentRequests !== adjustments.totalRequests ||
    dashboard.totals.adjustedLots !== adjustments.adjustedLots ||
    dashboard.totals.reasonMentions !== adjustments.totalMentions ||
    adjustments.detail.rows.length !== adjustments.detail.total
  )
    throw new Error('Los datos del informe no están conciliados. Volvé a intentar la descarga.');

  const doc = new jsPDF({ orientation: 'landscape', format: 'a4', unit: 'mm', compress: true });
  const title = dashboard.period.from ? dashboard.period.label : monthTitle(dashboard.period.month);
  const plants = dashboard.includedPlants.map((plant) => plant.name).join(', ') || 'Sin plantas';
  const totals = dashboard.totals;
  doc.setProperties({
    title: `Grupo DISAL - Informe de Laboratorio - ${dashboard.period.label}`,
    subject: 'Analítica de calidad y ajustes por orden de fabricación',
    author: 'Grupo DISAL',
    keywords: 'laboratorio, producción, calidad, reportería'
  });

  // Página editorial: métricas y alcance.
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, 297, 34, 'F');
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(16, 6, 41, 23, 2, 2, 'F');
  doc.addImage(logoDataUrl, 'PNG', 18, 7.5, 37, 20);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(
    dashboard.period.from ? 'INFORME DE LABORATORIO' : 'INFORME MENSUAL DE LABORATORIO',
    65,
    17
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(
    `${title.toUpperCase()}  |  ${dashboard.includedPlants.length} plantas autorizadas`,
    65,
    25
  );

  doc.setTextColor(...INK);
  doc.setFontSize(8);
  doc.text(`Plantas: ${plants}`, 16, 43, { maxWidth: 265 });
  doc.text(`Generado: ${dateTime(new Date().toISOString())}  |  Usuario: ${generatedBy}`, 16, 49);
  doc.text(
    `Corte de intervalos abiertos: ${dateTime(dashboard.dataCutoff)}  |  Dataset: ${dashboard.datasetVersion}  |  Métricas: ${dashboard.metricVersion}`,
    16,
    55
  );

  section(doc, 'RESULTADOS DEL PERÍODO', 66);
  card(doc, 16, 72, 62, 'Solicitudes de ajuste', number(totals.adjustmentRequests));
  card(doc, 83, 72, 62, 'OF con ajuste', number(totals.adjustedLots));
  card(doc, 150, 72, 62, 'Menciones de motivos', number(totals.reasonMentions));
  card(
    doc,
    217,
    72,
    64,
    'Aprobación inicial observada',
    totals.firstPassRatePercent === null
      ? 'Sin población'
      : `${totals.firstPassRatePercent.toLocaleString('es-AR')} %`
  );

  section(doc, 'LECTURA EJECUTIVA', 105);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  const summary = [
    `${number(totals.receivedSamples)} muestras recibidas y ${number(totals.resolvedSamples)} resueltas en sus respectivas cohortes del período.`,
    `${number(totals.firstPassApproved)} de ${number(totals.evaluatedLots)} OF observadas fueron aprobadas en su primera muestra resuelta.`,
    `${number(totals.multipleCycleLots)} OF de la cohorte tuvieron múltiples ciclos de análisis.`,
    `Espera solicitud-recepción: ${hours(dashboard.times.receiptWait.averageSeconds)} (${number(dashboard.times.receiptWait.count)} registros); análisis transcurrido: ${hours(dashboard.times.analysisElapsed.averageSeconds)} (${number(dashboard.times.analysisElapsed.count)} registros).`
  ];
  summary.forEach((line, index) => doc.text(`• ${line}`, 16, 113 + index * 7));
  doc.setFillColor(...LIGHT);
  doc.roundedRect(16, 149, 265, 31, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const cautions = [
    'Alcance: resultados vigentes al consultar. Las correcciones posteriores pueden cambiar este informe.',
    'Los períodos de decisiones, muestras y primera resolución usan fechas de inclusión diferentes.',
    'Los tiempos son transcurridos, pueden superponerse y no representan trabajo efectivo. La cobertura histórica puede ser parcial.',
    `Calidad del dato: ${number(dashboard.coverage.missingAnalysisStart)} muestras resueltas sin inicio de análisis; ${number(dashboard.coverage.invalidChronology)} cronologías inválidas.`
  ];
  cautions.forEach((line, index) => doc.text(line, 20, 156 + index * 6));

  doc.addPage();
  section(doc, 'PARETO DE MOTIVOS DE AJUSTE', 19);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(
    `${number(adjustments.totalRequests)} solicitudes  |  ${number(adjustments.totalMentions)} menciones  |  Denominador de porcentajes: menciones`,
    16,
    27
  );
  const bars = adjustments.pareto.slice(0, 8);
  bars.forEach((row, index) => {
    const y = 36 + index * 10;
    doc.setTextColor(...INK);
    doc.text(row.reason.slice(0, 34), 16, y + 4);
    doc.setFillColor(...LIGHT);
    doc.roundedRect(78, y, 159, 6, 1, 1, 'F');
    doc.setFillColor(...BLUE);
    doc.roundedRect(78, y, Math.max(0.4, (159 * row.percent) / 100), 6, 1, 1, 'F');
    doc.text(`${number(row.mentions)} (${row.percent.toLocaleString('es-AR')} %)`, 243, y + 4);
  });
  autoTable(doc, {
    startY: Math.max(88, 40 + bars.length * 10),
    head: [['Motivo', 'Menciones', '% de menciones', '% acumulado']],
    body: adjustments.pareto.map((row) => [
      row.reason,
      number(row.mentions),
      `${row.percent.toLocaleString('es-AR')} %`,
      `${row.cumulativePercent.toLocaleString('es-AR')} %`
    ]),
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 2, textColor: INK },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255] },
    margin: { left: 16, right: 16, top: 22, bottom: 22 }
  });
  doc.addPage();
  section(doc, 'PARETO DE MATERIALES AJUSTADOS', 19);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(
    'Material del producto fabricado en la OF. Porcentaje sobre solicitudes de ajuste.',
    16,
    27
  );
  const materialBars = adjustments.materialPareto.slice(0, 8);
  materialBars.forEach((row, index) => {
    const y = 36 + index * 10;
    doc.setTextColor(...INK);
    doc.text(row.materialCode.slice(0, 24), 16, y + 4);
    doc.setFillColor(...LIGHT);
    doc.roundedRect(78, y, 159, 6, 1, 1, 'F');
    doc.setFillColor(...BLUE);
    doc.roundedRect(78, y, Math.max(0.4, (159 * row.percent) / 100), 6, 1, 1, 'F');
    doc.text(`${number(row.requests)} (${row.percent.toLocaleString('es-AR')} %)`, 243, y + 4);
  });
  autoTable(doc, {
    startY: Math.max(88, 40 + materialBars.length * 10),
    head: [
      [
        'Material OF',
        'Solicitudes',
        'OF distintas',
        'Motivo más frecuente',
        '% solicitudes',
        '% acumulado'
      ]
    ],
    body: adjustments.materialPareto.map((row) => {
      const leading = adjustments.materialReasons.find(
        (item) => item.materialCode === row.materialCode
      );
      return [
        row.materialCode,
        number(row.requests),
        number(row.adjustedLots),
        leading ? `${leading.reason} (${number(leading.mentions)})` : '—',
        `${row.percent.toLocaleString('es-AR')} %`,
        `${row.cumulativePercent.toLocaleString('es-AR')} %`
      ];
    }),
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 2, textColor: INK },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255] },
    margin: { left: 16, right: 16, top: 22, bottom: 22 }
  });
  doc.addPage();
  section(doc, 'MOTIVOS POR MATERIAL DE LA OF', 19);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(
    'Una solicitud con varios motivos aporta una mención a cada motivo de su material.',
    16,
    27
  );
  autoTable(doc, {
    startY: 32,
    head: [['Material de la OF', 'Motivo', 'Menciones']],
    body: adjustments.materialReasons.map((row) => [
      row.materialCode,
      row.reason,
      number(row.mentions)
    ]),
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 2, textColor: INK },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255] },
    margin: { left: 16, right: 16, top: 22, bottom: 22 }
  });
  doc.addPage();
  section(doc, 'DECISIONES OBSERVADAS POR PLANTA', 19);
  const plantNamesForSummary = new Map(
    dashboard.includedPlants.map((plant) => [plant.id, plant.name])
  );
  autoTable(doc, {
    startY: 27,
    head: [['Planta', 'Decisiones', 'Solicitudes de ajuste']],
    body: dashboard.byPlant.map((row) => [
      plantNamesForSummary.get(row.plantId) ?? row.code,
      number(row.decisions),
      number(row.adjustments)
    ]),
    theme: 'striped',
    styles: { fontSize: 7, cellPadding: 1.6, textColor: INK },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255] },
    margin: { left: 16, right: 16, top: 20, bottom: 22 }
  });
  const plantTableBottom =
    (doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 80;
  section(doc, 'TENDENCIA DE CALIDAD', plantTableBottom + 13);
  autoTable(doc, {
    startY: plantTableBottom + 18,
    head: [['Mes', 'Decisiones', 'Solicitudes de ajuste']],
    body: dashboard.trend.map((row) => [row.month, number(row.decisions), number(row.adjustments)]),
    theme: 'striped',
    styles: { fontSize: 7, cellPadding: 1.6, textColor: INK },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255] },
    margin: { left: 16, right: 16, top: 20, bottom: 22 }
  });
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    'Cero significa ausencia de decisiones registradas en el período; la capacidad de cada planta requiere validación.',
    16,
    178
  );

  doc.addPage();
  section(doc, 'SOLICITUDES DE AJUSTE - DETALLE COMPLETO', 19);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(
    `${number(adjustments.detail.total)} solicitudes del período, sin deduplicar materiales ni motivos.`,
    16,
    27
  );
  const plantNames = new Map(dashboard.includedPlants.map((plant) => [plant.id, plant.name]));
  autoTable(doc, {
    startY: 32,
    head: [['Fecha', 'Planta', 'OF', 'Material', 'Producto', 'Motivos', 'Materiales de ajuste']],
    body: adjustments.detail.rows.map((row) => [
      dateTime(row.createdAt),
      plantNames.get(row.plantId) ?? '—',
      row.lot.manufacturingOrder,
      row.lot.materialCode,
      row.lot.description,
      row.adjustmentReasons.join(', ') || 'Sin clasificar',
      row.adjustmentItems
        .map((item) => `${item.materialCode} (${item.quantityKg} kg)`)
        .join(', ') || '—'
    ]),
    theme: 'striped',
    styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak', textColor: INK, minCellWidth: 5 },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 6.5 },
    columnStyles: {
      0: { cellWidth: 29 },
      4: { cellWidth: 54 },
      5: { cellWidth: 44 },
      6: { cellWidth: 54 }
    },
    margin: { left: 16, right: 16, top: 20, bottom: 22 }
  });

  doc.addPage();
  section(doc, 'METODOLOGÍA Y LIMITACIONES', 19);
  const methodology = [
    'Período: hora America/Argentina/Buenos_Aires, inicio inclusivo y fin exclusivo.',
    'Solicitud de ajuste: decisión de calidad AJUSTE no cancelada, incluida por fecha de creación.',
    'OF con ajuste: lotes internos distintos con al menos una solicitud de ajuste en el período.',
    'Motivos: cada texto de adjustmentReasons cuenta una mención; un array vacío se clasifica como Sin clasificar.',
    'Pareto de materiales: código del producto de la OF; una decisión cuenta una solicitud para ese material.',
    'Motivos por material: cada motivo de una decisión se atribuye al material de su OF, no a cada insumo agregado.',
    'Aprobación inicial: primera muestra resuelta con decisión vigente por lote; cohorte del período de resolución.',
    'Espera de recepción = recepción - solicitud; espera de análisis = inicio - recepción; duración de análisis = resolución - inicio.',
    'No se asignan duraciones finales a muestras abiertas ni se suman intervalos superpuestos como trabajo efectivo.',
    'Las decisiones editadas se muestran con su valor actual. Este PDF no reconstruye un estado histórico inmutable.',
    'Las plantas sin muestras observadas requieren validación de capacidad antes de interpretar ceros como desempeño.',
    'La cantidad fabricada real no se infiere de pesos de balanza ni de kg envasados.'
  ];
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  let y = 29;
  methodology.forEach((line, index) => {
    const wrapped = doc.splitTextToSize(`${index + 1}. ${line}`, 260);
    doc.text(wrapped, 17, y);
    y += wrapped.length * 5 + 4;
  });
  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    footer(doc, page, totalPages, dashboard.period.label);
  }
  return doc;
}

export function downloadLaboratoryReportPdf(data: LaboratoryReportData) {
  const document = buildLaboratoryReportPdf(data);
  const period = data.dashboard.period;
  document.save(
    `grupo-disal-laboratorio-${period.from ? `${period.from}-${period.to}` : period.month}.pdf`
  );
}
