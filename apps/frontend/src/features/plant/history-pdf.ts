import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Timeline } from './PlantHistoryPage';
import { historyStateAt, presentationForHistoryState } from './history-state-presentation';

const COLORS = {
  navy: [9, 35, 63] as const,
  blue: [0, 119, 190] as const,
  cyan: [24, 189, 244] as const,
  paleBlue: [232, 245, 252] as const,
  text: [30, 43, 56] as const,
  muted: [92, 108, 123] as const,
  line: [207, 219, 229] as const,
  white: [255, 255, 255] as const
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    dateStyle: 'short',
    timeStyle: 'medium'
  });

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours} h ${minutes} min` : `${minutes} min`;
};

const formatKilograms = (value: number | null | undefined) =>
  value == null
    ? 'No informado'
    : `${value.toLocaleString('es-AR', { maximumFractionDigits: 3 })} kg`;

const safeText = (value: string | null | undefined) => value?.trim() || 'No informado';

function chronologicalDetail(
  timeline: Timeline,
  period: Timeline['stateHistory'][number],
  periodIndex: number
) {
  const periodStart = Date.parse(period.startedAt);
  const periodEnd = period.endedAt
    ? Date.parse(period.endedAt) + 5000
    : Number.POSITIVE_INFINITY;
  const weightDetail = `Peso al ingresar: ${formatKilograms(period.weightKg)}`;

  if (period.state === 'LABORATORIO') {
    const samples = (timeline.laboratorySamples ?? []).filter((sample) => {
      const requestedAt = Date.parse(sample.requestedAt);
      return requestedAt >= periodStart - 5000 && requestedAt <= periodEnd;
    });
    const sampleDetail = samples
      .map((sample) => {
        const reception = sample.receivedAt
          ? formatDateTime(sample.receivedAt)
          : 'Pendiente de recepción';
        const resolution = sample.resolvedAt
          ? formatDateTime(sample.resolvedAt)
          : 'Pendiente de resolución';
        const waiting =
          sample.waitingForReceiptSeconds == null
            ? 'en curso'
            : formatDuration(sample.waitingForReceiptSeconds);
        const analysis =
          sample.analysisSeconds == null ? 'en curso' : formatDuration(sample.analysisSeconds);
        return `Muestra ${sample.iteration}\nIngreso: ${formatDateTime(sample.requestedAt)}\nRecepción: ${reception} · Espera: ${waiting}\nResolución: ${resolution} · Análisis: ${analysis}`;
      })
      .join('\n\n');
    return sampleDetail ? `${sampleDetail}\n${weightDetail}` : weightDetail;
  }

  if (period.state === 'AJUSTE') {
    const previousPeriod = periodIndex > 0 ? timeline.stateHistory[periodIndex - 1] : undefined;
    const decisionStart = previousPeriod
      ? Date.parse(previousPeriod.startedAt)
      : periodStart - 5000;
    const adjustmentDetail = timeline.qualityDecisions
      .filter((decision) => {
        const createdAt = Date.parse(decision.createdAt);
        return decision.result === 'AJUSTE' && createdAt >= decisionStart && createdAt <= periodEnd;
      })
      .map((adjustment) => {
        const reason = adjustment.adjustmentReasons.join(' / ') || safeText(adjustment.reason);
        const materials = adjustment.adjustmentItems.length
          ? adjustment.adjustmentItems
              .map((item) => `${item.materialCode}: ${formatKilograms(item.quantityKg)}`)
              .join(', ')
          : 'Sin materiales detallados';
        const responsible = `${adjustment.employeeNumber} / ${adjustment.user?.fullName ?? 'No informado'}`;
        return `${formatDateTime(adjustment.createdAt)} · ${reason}\n${responsible}\n${materials}`;
      })
      .join('\n\n');
    return adjustmentDetail ? `${adjustmentDetail}\n${weightDetail}` : weightDetail;
  }

  return period.description ? `${period.description}\n${weightDetail}` : weightDetail;
}

async function loadLogo(): Promise<string | null> {
  try {
    const response = await fetch('/brand/grupo-disal-logo.png');
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function lastTableY(doc: jsPDF, fallback: number) {
  return (
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? fallback
  );
}

function ensureSpace(doc: jsPDF, y: number, requiredHeight: number) {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + requiredHeight <= pageHeight - 18) return y;
  doc.addPage();
  return 27;
}

function sectionTitle(doc: jsPDF, title: string, y: number) {
  const position = ensureSpace(doc, y, 14);
  doc.setFillColor(...COLORS.paleBlue);
  doc.roundedRect(14, position, 182, 8, 1.5, 1.5, 'F');
  doc.setTextColor(...COLORS.navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(title.toUpperCase(), 18, position + 5.3);
  return position + 11;
}

const hexToRgb = (hex: string): [number, number, number] => {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16)
  ];
};

const softenedStateColor = (hex: string): [number, number, number] =>
  hexToRgb(hex).map((channel) => Math.round(255 - (255 - channel) * 0.32)) as [
    number,
    number,
    number
  ];

function chartPointsWithStateBoundaries(timeline: Timeline) {
  const points = timeline.weightHistory.points
    .map((point) => ({ ...point, time: new Date(point.timestamp).getTime() }))
    .filter((point) => Number.isFinite(point.time))
    .sort((left, right) => left.time - right.time);
  if (points.length < 2) return points;

  const first = points[0].time;
  const last = points[points.length - 1].time;
  const boundaries = timeline.stateHistory.flatMap((period) => [
    new Date(period.startedAt).getTime(),
    period.endedAt ? new Date(period.endedAt).getTime() : Number.NaN
  ]);
  const allTimes = [
    ...new Set([
      ...points.map((point) => point.time),
      ...boundaries.filter((time) => Number.isFinite(time) && time > first && time < last)
    ])
  ].sort((left, right) => left - right);

  return allTimes.map((time) => {
    const exact = points.find((point) => point.time === time);
    if (exact) return exact;
    const nextIndex = points.findIndex((point) => point.time > time);
    const previous = points[nextIndex - 1];
    const next = points[nextIndex];
    const ratio = (time - previous.time) / Math.max(1, next.time - previous.time);
    return {
      timestamp: new Date(time).toISOString(),
      time,
      grossKg: previous.grossKg + (next.grossKg - previous.grossKg) * ratio
    };
  });
}

function drawWeightChart(doc: jsPDF, timeline: Timeline, y: number) {
  const chartY = ensureSpace(doc, y, 62);
  const points = chartPointsWithStateBoundaries(timeline);
  const x = 18;
  const width = 174;
  const height = 45;

  doc.setDrawColor(...COLORS.line);
  doc.setFillColor(249, 252, 254);
  doc.roundedRect(14, chartY, 182, 56, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.text);
  doc.text(`Peso durante la fabricación - ${timeline.tank.name}`, 18, chartY + 7);

  if (!points.length) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.muted);
    doc.text(timeline.weightHistory.message, 18, chartY + 28, { maxWidth: 166 });
    return chartY + 61;
  }

  const values = points.map((point) => point.grossKg);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const valueRange = Math.max(1, maximum - minimum);
  const graphTop = chartY + 13;
  const graphHeight = height - 10;

  const firstTime = points[0].time;
  const timeRange = Math.max(1, points[points.length - 1].time - firstTime);
  const pointPosition = (point: (typeof points)[number]) => ({
    x: x + (width * (point.time - firstTime)) / timeRange,
    y: graphTop + graphHeight - ((point.grossKg - minimum) / valueRange) * graphHeight
  });

  points.slice(1).forEach((point, index) => {
    const previous = points[index];
    const previousPosition = pointPosition(previous);
    const currentPosition = pointPosition(point);
    const state = historyStateAt(timeline.stateHistory, (previous.time + point.time) / 2)?.state;
    const presentation = presentationForHistoryState(state ?? '');
    doc.setFillColor(...softenedStateColor(presentation.color));
    doc.triangle(
      previousPosition.x,
      previousPosition.y,
      currentPosition.x,
      currentPosition.y,
      currentPosition.x,
      graphTop + graphHeight,
      'F'
    );
    doc.triangle(
      previousPosition.x,
      previousPosition.y,
      currentPosition.x,
      graphTop + graphHeight,
      previousPosition.x,
      graphTop + graphHeight,
      'F'
    );
  });

  doc.setDrawColor(224, 232, 239);
  doc.setLineWidth(0.2);
  for (let line = 0; line <= 4; line += 1) {
    const gridY = graphTop + (graphHeight * line) / 4;
    doc.line(x, gridY, x + width, gridY);
  }

  doc.setDrawColor(...COLORS.blue);
  doc.setLineWidth(0.65);
  points.slice(1).forEach((point, index) => {
    const previous = points[index];
    const previousPosition = pointPosition(previous);
    const currentPosition = pointPosition(point);
    doc.line(previousPosition.x, previousPosition.y, currentPosition.x, currentPosition.y);
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.muted);
  doc.text(formatKilograms(maximum), x, graphTop - 1);
  doc.text(formatKilograms(minimum), x, graphTop + graphHeight + 4);
  doc.text(formatDateTime(points[0].timestamp), x + width, graphTop + graphHeight + 4, {
    align: 'right'
  });
  doc.text(
    `${timeline.weightHistory.points.length} muestras | Última: ${formatDateTime(points[points.length - 1]?.timestamp ?? '')}`,
    x + width,
    graphTop - 1,
    { align: 'right' }
  );

  return chartY + 61;
}

function addTable(
  doc: jsPDF,
  title: string,
  y: number,
  headers: string[],
  rows: Array<Array<string | number>>,
  emptyMessage: string
) {
  const startY = sectionTitle(doc, title, y);
  autoTable(doc, {
    startY,
    head: [headers],
    body: rows.length ? rows : [[emptyMessage, ...headers.slice(1).map(() => '')]],
    margin: { top: 27, right: 14, bottom: 18, left: 14 },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 2.2,
      lineColor: [...COLORS.line],
      lineWidth: 0.15,
      textColor: [...COLORS.text],
      overflow: 'linebreak'
    },
    headStyles: {
      fillColor: [...COLORS.navy],
      textColor: [...COLORS.white],
      fontStyle: 'bold'
    },
    alternateRowStyles: { fillColor: [247, 250, 252] }
  });
  return lastTableY(doc, startY) + 8;
}

function decoratePages(doc: jsPDF, timeline: Timeline, logo: string | null) {
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    if (page > 1) {
      doc.setFillColor(...COLORS.navy);
      doc.rect(0, 0, 210, 18, 'F');
      if (logo) doc.addImage(logo, 'PNG', 14, 3, 22, 11.6);
      doc.setTextColor(...COLORS.white);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`TRAZABILIDAD OF ${timeline.manufacturingOrder}`, 42, 10.5);
    }
    doc.setDrawColor(...COLORS.line);
    doc.line(14, 284, 196, 284);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.muted);
    doc.text('Grupo DISAL - Planta de Látex | Documento generado por el sistema LATEX', 14, 289);
    doc.text(`Página ${page} de ${pageCount}`, 196, 289, { align: 'right' });
  }
}

export function buildTraceabilityPdf(timeline: Timeline, logo: string | null = null) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

  doc.setProperties({
    title: `Trazabilidad OF ${timeline.manufacturingOrder}`,
    subject: 'Informe integral de trazabilidad de fabricación',
    author: 'Grupo DISAL - Planta de Látex',
    creator: 'Sistema LATEX'
  });

  doc.setFillColor(...COLORS.navy);
  doc.rect(0, 0, 210, 34, 'F');
  doc.setFillColor(...COLORS.cyan);
  doc.rect(0, 31.5, 210, 2.5, 'F');
  if (logo) doc.addImage(logo, 'PNG', 14, 5, 40, 21.2);
  else {
    doc.setTextColor(...COLORS.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('GRUPO DISAL', 14, 19);
  }
  doc.setTextColor(...COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('INFORME DE TRAZABILIDAD', 196, 13, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Orden de fabricación ${timeline.manufacturingOrder}`, 196, 21, { align: 'right' });
  doc.text(`Emitido ${formatDateTime(new Date().toISOString())}`, 196, 27, { align: 'right' });

  doc.setFillColor(246, 249, 252);
  doc.setDrawColor(...COLORS.line);
  doc.roundedRect(14, 41, 182, 29, 2, 2, 'FD');
  const summary = [
    ['OF', timeline.manufacturingOrder],
    ['Material', timeline.materialCode],
    ['Tanque', timeline.tank.name],
    ['Duración total', formatDuration(timeline.totalDurationSeconds)]
  ];
  summary.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const left = 19 + column * 89;
    const top = 49 + row * 11;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.blue);
    doc.text(label.toUpperCase(), left, top);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.text);
    doc.text(safeText(value), left, top + 5, { maxWidth: 80 });
  });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.blue);
  doc.text('PRODUCTO', 14, 79);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.text);
  doc.text(safeText(timeline.description), 14, 85, { maxWidth: 182 });

  let y = drawWeightChart(doc, timeline, 91);
  y = addTable(
    doc,
    'Etapas de la orden',
    y,
    ['Estado', 'Inicio', 'Fin', 'Duración', 'Responsable', 'Detalle cronológico'],
    timeline.stateHistory.map((period, index) => [
      period.state.replaceAll('_', ' '),
      formatDateTime(period.startedAt),
      period.endedAt ? formatDateTime(period.endedAt) : 'En curso',
      formatDuration(period.durationSeconds),
      period.user?.fullName ?? 'Sistema',
      chronologicalDetail(timeline, period, index)
    ]),
    'No hay etapas registradas.'
  );

  y = addTable(
    doc,
    'Cargas de materias primas',
    y,
    ['Fecha y hora', 'Material', 'Descripción', 'Setpoint', 'Cantidad real'],
    timeline.manufacturingCharges.map((charge) => [
      formatDateTime(charge.startedAt),
      charge.materialCode,
      safeText(charge.materialDescription),
      formatKilograms(charge.setpointKg),
      formatKilograms(charge.actualKg)
    ]),
    'No hay cargas individuales registradas.'
  );

  addTable(
    doc,
    'Órdenes de envasado',
    y,
    ['OE', 'Material / Producto', 'Celda / Formato / Dosificadora / Filtro', 'Inicio / Fin', 'Producción / Merma'],
    timeline.packagingOrders.map((order) => [
      order.packagingOrder,
      `${safeText(order.materialCode)}\n${safeText(order.description)}`,
      `${order.line} / ${order.format} / ${order.dispenser ?? '—'} / ${order.filter ?? '—'}`,
      `${formatDateTime(order.startedAt)}\n${order.finishedAt ? formatDateTime(order.finishedAt) : 'En curso'}`,
      `${formatKilograms(order.producedKg)} / ${formatKilograms(order.wasteKg)}\n${order.producedUnits ?? 'No informadas'} unidades`
    ]),
    'No hay órdenes de envasado registradas.'
  );

  decoratePages(doc, timeline, logo);
  return doc;
}

export async function downloadTraceabilityPdf(timeline: Timeline) {
  const [logo] = await Promise.all([loadLogo()]);
  const doc = buildTraceabilityPdf(timeline, logo);
  const safeOrder = timeline.manufacturingOrder.replace(/[^a-zA-Z0-9_-]+/g, '-');
  doc.save(`trazabilidad-OF-${safeOrder}.pdf`);
}
