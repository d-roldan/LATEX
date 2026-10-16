import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { HistoryRow } from './PlantHistoryPage';

interface ReportFilters {
  plant: string;
  from: string;
  to: string;
  tank: string;
  state: string;
  search: string;
}

const dateTime = (value: string) =>
  new Date(value).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

const duration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours} h ${minutes} min` : `${minutes} min`;
};

export function buildHistorySummaryPdf(rows: HistoryRow[], filters: ReportFilters) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({
    title: `Historial de estados - ${filters.plant}`,
    subject: 'Informe de estados por orden de fabricación',
    author: 'Grupo DISAL'
  });
  doc.setFillColor(9, 35, 63);
  doc.rect(0, 0, 297, 27, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('HISTORIAL DE ESTADOS POR OF', 14, 15);
  doc.setFontSize(9);
  doc.text(`${filters.plant} · Emitido ${dateTime(new Date().toISOString())}`, 14, 22);

  doc.setTextColor(30, 43, 56);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const filterText = [
    `Período: ${filters.from || 'Sin inicio'} a ${filters.to || 'Sin fin'}`,
    `Tanque: ${filters.tank || 'Todos'}`,
    `Estado: ${filters.state || 'Todos'}`,
    `Búsqueda: ${filters.search || 'Ninguna'}`
  ];
  doc.text(filterText, 14, 34);

  const groups = new Map<string, { lot: NonNullable<HistoryRow['lot']>; rows: HistoryRow[] }>();
  rows.forEach((row) => {
    if (!row.lot) return;
    const group = groups.get(row.lot.id);
    if (group) group.rows.push(row);
    else groups.set(row.lot.id, { lot: row.lot, rows: [row] });
  });
  const summaries = [...groups.values()].sort((a, b) =>
    a.lot.manufacturingOrder.localeCompare(b.lot.manufacturingOrder, 'es-AR', { numeric: true })
  );
  doc.setFont('helvetica', 'bold');
  doc.text(`${summaries.length} OF · ${rows.length} estados registrados`, 14, 57);
  autoTable(doc, {
    startY: 61,
    head: [['OF', 'Semielaborado', 'Producto', 'Ajustes', 'OE asignadas', 'Estados en el período']],
    body: summaries.map(({ lot, rows: lotRows }) => [
      lot.manufacturingOrder,
      lot.materialCode,
      lot.description,
      String(lotRows.filter((row) => row.state === 'AJUSTE').length),
      String(lot.packagingOrders.length),
      String(lotRows.length)
    ]),
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [9, 35, 63] },
    margin: { left: 14, right: 14, top: 18, bottom: 17 },
    didDrawPage: () => undefined
  });
  const summaryEnd = (doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable
    ?.finalY;
  let detailStart = (summaryEnd ?? 61) + 13;
  if (detailStart > 180) {
    doc.addPage();
    detailStart = 25;
  }
  doc.setFont('helvetica', 'bold');
  doc.text('DETALLE CRONOLÓGICO DE ESTADOS', 14, detailStart - 4);
  autoTable(doc, {
    startY: detailStart,
    head: [
      [
        'OF / Semielaborado',
        'Tanque',
        'Estado',
        'Inicio',
        'Fin',
        'Duración',
        'Responsable',
        'Detalle'
      ]
    ],
    body: rows.map((row) => [
      row.lot ? `${row.lot.manufacturingOrder} / ${row.lot.materialCode}` : 'Sin OF',
      row.tank.name,
      row.state.replaceAll('_', ' '),
      dateTime(row.startedAt),
      row.endedAt ? dateTime(row.endedAt) : 'En curso',
      duration(row.durationSeconds),
      row.user?.fullName ?? 'Sistema',
      row.description || row.lot?.description || '—'
    ]),
    theme: 'striped',
    styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [9, 35, 63] },
    margin: { left: 14, right: 14, top: 18, bottom: 17 }
  });
  for (let page = 1; page <= doc.getNumberOfPages(); page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(92, 108, 123);
    doc.text(
      `Grupo DISAL · Historial de estados · Página ${page} de ${doc.getNumberOfPages()}`,
      14,
      201
    );
  }
  return doc;
}

export function downloadHistorySummaryPdf(rows: HistoryRow[], filters: ReportFilters) {
  const doc = buildHistorySummaryPdf(rows, filters);
  doc.save(
    `historial-estados-${filters.plant}-${filters.from || 'inicio'}-${filters.to || 'actual'}.pdf`
  );
}
