# Roadmap — reconversión a DISAL INDUSTRIA METALÚRGICA

## Fase 0 — Base heredada completada

- [x] Autenticación JWT y roles.
- [x] Clientes y contactos.
- [x] Orden unificada: presupuesto y producción.
- [x] Asignaciones, eventos, consumos y adjuntos.
- [x] Materiales y recursos.
- [x] Dashboard, reportes, auditoría y calendario.
- [x] PDF imprimible de presupuesto y remito.
- [x] Pantalla de TV.
- [x] Copiloto IA con fallback local.
- [x] Costos estimados contra costos reales de materiales.

## Fase 1 — Identidad y limpieza DISAL

- [x] Reemplazar logos, colores y textos visibles de JM/DISAL.
- [ ] Cambiar nombres técnicos heredados cuando sea seguro.
- [x] Crear seed limpio e idempotente exclusivo de DISAL
- [x] Eliminar clientes, usuarios, materiales y órdenes demo heredados.
- [ ] Definir CUIT, domicilio, contactos y datos legales reales.
- [ ] Regenerar manuales PDF.

## Fase 2 — Dominio de casillas rurales

- [x] Catálogo inicial de modelos de casillas.
- [x] Revisiones versionadas y medidas base.
- [ ] Gestión visual de versiones y planos.
- [ ] Opcionales y configuraciones comerciales.
- [x] Unidad fabricada vinculada a cliente y orden.
- [ ] Lista de materiales por modelo.
- [ ] Cálculo de costo por configuración.
- [ ] Plantillas reutilizables de presupuesto.

## Fase 3 — Flujo productivo

- [x] Definir etapas reales, paralelismo y responsables de DISAL
- [x] Planificación administrativa y asignación por etapa al crear la casilla.
- [x] Asignación, reasignación y baja visual por etapa desde la ficha de producción.
- [x] Avance porcentual, dependencias y bloqueo entre etapas.
- [ ] Controles de calidad y no conformidades.
- [ ] Retrabajos trazables.
- [ ] Fotografías de avance.
- [x] Mapa operativo inicial por casilla, etapa y operario.
- [ ] Panel analítico de carga por sector.

## Fase 4 — Inventario y compras

- [ ] Stock mínimo y alertas.
- [ ] Reservas de materiales por casilla.
- [ ] Proveedores.
- [ ] Solicitudes y órdenes de compra.
- [ ] Recepción y actualización de costos.
- [ ] Trazabilidad de lotes cuando corresponda.

## Fase 5 — Entrega y posventa

- [ ] Checklist específico por modelo.
- [ ] Documentación técnica de la unidad.
- [ ] Logística, transportista y fecha real.
- [ ] Firma y evidencia de entrega persistente.
- [ ] Garantías, reclamos y tareas posventa.

## Fase 6 — Infraestructura para producción

- [ ] Volumen persistente o almacenamiento externo para adjuntos.
- [ ] HTTPS.
- [ ] Backups automáticos y restauración probada.
- [ ] Gestión segura de secretos.
- [ ] Revisión de exposición de `/tv`.
- [ ] Métricas, logs y alertas.
- [ ] Pruebas de carga y recuperación.

## Fase 7 — Integraciones

- [ ] Excel y CSV.
- [ ] Correo y WhatsApp.
- [ ] QR para unidad, orden y material.
- [ ] IoT o telemetría solo donde aporte valor.
- [ ] Integración contable o de facturación.

## Futuro no comprometido

- Aplicación móvil nativa.
- SaaS multiempresa.
- Portal de clientes.
- Portal de proveedores.
- Pagos y suscripciones.
