export function injectionMachineState(live: boolean, mode: string | null | undefined) {
  if (!live) return { label: 'Sin datos recientes', cardClass: 'is-stale' };
  switch (mode?.trim().toUpperCase()) {
    case 'AUTO':
      return { label: 'Produciendo', cardClass: 'is-producing' };
    case 'MANUAL':
    case 'PARO':
    case 'STOP':
      return { label: 'Detenida', cardClass: 'is-stopped' };
    default:
      return { label: 'Estado no informado', cardClass: 'is-live' };
  }
}
