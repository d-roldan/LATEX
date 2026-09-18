export interface HistoryStatePeriod {
  state: string;
  startedAt: string;
  endedAt?: string;
}

export const historyStatePresentation: Record<string, { label: string; color: string }> = {
  VACIO: { label: 'Vacío', color: '#c92a2f' },
  FABRICANDO: { label: 'Fabricando', color: '#8f969e' },
  LABORATORIO: { label: 'Laboratorio', color: '#f1b62c' },
  AJUSTE: { label: 'Ajuste', color: '#f07c29' },
  RECHAZADO: { label: 'Rechazado', color: '#c92a2f' },
  APROBADO: { label: 'Aprobado', color: '#3b9848' },
  ENVASANDO: { label: 'Envasando', color: '#0998d7' },
  TRASVASANDO: { label: 'Trasvasando', color: '#715aa8' },
  FUERA_DE_SERVICIO: { label: 'Fuera de servicio', color: '#715aa8' }
};

export const presentationForHistoryState = (state: string) =>
  historyStatePresentation[state] ?? {
    label: state.replaceAll('_', ' '),
    color: '#55c6ff'
  };

export function historyStateAt(
  periods: HistoryStatePeriod[],
  timestamp: number
): HistoryStatePeriod | undefined {
  return periods.find((period) => {
    const start = new Date(period.startedAt).getTime();
    const end = period.endedAt ? new Date(period.endedAt).getTime() : Number.POSITIVE_INFINITY;
    return Number.isFinite(start) && timestamp >= start && timestamp < end;
  });
}
