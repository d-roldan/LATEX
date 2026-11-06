export type ReportPeriodFilter =
  | { month: string; from?: undefined; to?: undefined }
  | { month?: undefined; from: string; to: string };

export const reportPeriodLabel = (period: ReportPeriodFilter) =>
  period.from && period.to
    ? `${period.from.split('-').reverse().join('/')}–${period.to.split('-').reverse().join('/')}`
    : (period.month ?? '');
