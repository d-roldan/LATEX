export const INJECTION_PLANT_CODE = 'ENVASES';
export const INJECTION_SOURCE = 'NODE_RED_ENVASES';
export const INJECTION_SIM_SOURCE = 'NODE_RED_ENVASES_SIM';

// Catálogo único: para agregar una máquina, incorporar una entrada y reiniciar el backend.
export const injectionMachines = [
  {
    code: 'INY01',
    name: 'INYECTORA 5',
    model: 'DL650G5',
    ip: '172.16.0.141',
    order: 5,
    visible: true
  },
  {
    code: 'INY02',
    name: 'INYECTORA 4',
    model: 'DL450G5',
    ip: '172.16.0.146',
    order: 4,
    visible: true
  },
  {
    code: 'INY03',
    name: 'INYECTORA 3',
    model: 'TB280G5-1',
    ip: '172.16.0.143',
    order: 3,
    visible: true
  },
  {
    code: 'INY04',
    name: 'INYECTORA 2',
    model: 'TB280G5-2',
    ip: '172.16.0.144',
    order: 2,
    visible: true
  },
  {
    code: 'INY05',
    name: 'INYECTORA 1',
    model: 'TB200G5',
    ip: '172.16.0.145',
    order: 1,
    visible: true
  }
] as const;

export const injectionThresholds = {
  cmsFreshMs: 10_000,
  nodeRedFreshMs: 30_000,
  counterRecentMs: 60_000,
  refreshMs: 2_000
} as const;
