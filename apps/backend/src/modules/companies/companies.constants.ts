export interface CompanySettings {
  warningTimeDeviationPct: number;
  criticalTimeDeviationPct: number;
  warningCostDeviationPct: number;
  criticalCostDeviationPct: number;
  requireDeliveryChecklist: boolean;
  workOrderCodePrefix: string;
  defaultWorkOrderPriority: number;
}

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  warningTimeDeviationPct: 20,
  criticalTimeDeviationPct: 40,
  warningCostDeviationPct: 15,
  criticalCostDeviationPct: 30,
  requireDeliveryChecklist: true,
  workOrderCodePrefix: 'DISAL',
  defaultWorkOrderPriority: 3
};

export const ACCESS_MATRIX = {
  OPERARIO: {
    'Órdenes asignadas': ['Ver solo sus órdenes de producción asignadas', 'Iniciar', 'Pausar', 'Finalizar', 'Cargar consumos', 'Comentar'],
    Presupuestos: ['Sin acceso'],
    Recursos: ['Sin acceso de gestion'],
    Reportes: ['Sin acceso']
  },
  SUPERVISOR: {
    'Producción y planificación': ['Crear/editar órdenes', 'Asignar operarios', 'Cambiar estados', 'Cerrar entrega'],
    Presupuestos: ['Crear/editar/aprobar', 'Convertir a orden de producción'],
    Recursos: ['Gestion operativa de recursos'],
    Reportes: ['Ver desvio, atrasos y productividad']
  },
  ADMIN: {
    'Control total': ['Gestion de usuarios y perfiles', 'Cambiar contraseñas', 'Configurar planta'],
    Presupuestos: ['Gestion completa'],
    'Órdenes de producción': ['Gestión completa + eliminación'],
    Auditoria: ['Ver bitacora de cambios']
  }
} as const;
