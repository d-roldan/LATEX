# Requisitos del sistema

Estados:

- `IMPLEMENTADO`: disponible en el código actual.
- `PARCIAL`: existe con limitaciones.
- `PENDIENTE`: requerido para la reconversión a DISAL

## Seguridad y usuarios

| ID | Requisito | Estado |
|---|---|---|
| SEG-01 | Login mediante email o nombre completo, sin distinguir mayúsculas, y contraseña | IMPLEMENTADO |
| SEG-02 | Roles OPERARIO, SUPERVISOR, DUENO y ADMIN | IMPLEMENTADO |
| SEG-03 | Protección de rutas frontend y endpoints backend | IMPLEMENTADO |
| SEG-04 | Cambio de contraseña propia y reset administrativo | IMPLEMENTADO |
| SEG-05 | Activar, suspender y eliminar usuarios | IMPLEMENTADO |
| SEG-06 | Cuenta protegida de propietario del sistema | IMPLEMENTADO |
| SEG-07 | Auditoría de acciones sensibles | IMPLEMENTADO |
| SEG-08 | Refresh token y revocación de sesión | PENDIENTE |
| SEG-09 | Recuperación de contraseña | PENDIENTE |

## Clientes y comercial

| ID | Requisito | Estado |
|---|---|---|
| COM-01 | CRUD de clientes | IMPLEMENTADO |
| COM-02 | Múltiples contactos por cliente | IMPLEMENTADO |
| COM-03 | Presupuesto con ítems y horas de costeo | IMPLEMENTADO |
| COM-04 | Estados BORRADOR, ENVIADO, APROBADO, RECHAZADO y VENCIDO | IMPLEMENTADO |
| COM-05 | Generación imprimible de presupuesto | IMPLEMENTADO |
| COM-06 | Aprobación que habilita producción | IMPLEMENTADO |
| COM-07 | Modelo, dimensiones, configuración y opcionales de casilla | PENDIENTE |
| COM-08 | Historial de revisiones de presupuesto | PENDIENTE |

## Producción

| ID | Requisito | Estado |
|---|---|---|
| PRO-01 | Orden productiva con código único | IMPLEMENTADO |
| PRO-02 | Estados productivos y prioridad | IMPLEMENTADO |
| PRO-03 | Planificación y fecha de compromiso | IMPLEMENTADO |
| PRO-04 | Asignación de personas y máquinas | IMPLEMENTADO |
| PRO-05 | Inicio, pausa, reanudación, finalización y notas | IMPLEMENTADO |
| PRO-06 | Consumo de materiales por orden | IMPLEMENTADO |
| PRO-07 | Adjuntos e imágenes por orden | PARCIAL |
| PRO-08 | Cierre de entrega, checklist, remito y firma declarada | IMPLEMENTADO |
| PRO-09 | Etapas específicas de fabricación de casillas | PENDIENTE |
| PRO-10 | Control de calidad por etapa y unidad | PENDIENTE |
| PRO-11 | Retrabajos y no conformidades detalladas | PARCIAL |
| PRO-12 | Trazabilidad individual de cada casilla | PENDIENTE |

`PRO-07` es parcial porque el almacenamiento local del contenedor no tiene volumen persistente.

## Inventario y recursos

| ID | Requisito | Estado |
|---|---|---|
| INV-01 | Materiales, unidades, costos y stock | IMPLEMENTADO |
| INV-02 | Entradas, ajustes y consumos | IMPLEMENTADO |
| INV-03 | Snapshot de costo al consumir | IMPLEMENTADO |
| INV-04 | Recursos humanos y máquinas | IMPLEMENTADO |
| INV-05 | Alertas automáticas de stock mínimo | PENDIENTE |
| INV-06 | Lista de materiales por modelo de casilla | PENDIENTE |
| INV-07 | Compras, proveedores y recepción | PENDIENTE |

## Información y análisis

| ID | Requisito | Estado |
|---|---|---|
| INF-01 | Dashboard ejecutivo con filtros de período | IMPLEMENTADO |
| INF-02 | Control de producción y seguimiento operativo | IMPLEMENTADO |
| INF-03 | Productividad, tiempos y costos estimados contra reales | IMPLEMENTADO |
| INF-04 | Calendario de compromisos | IMPLEMENTADO |
| INF-05 | Eventos manuales compartidos | PENDIENTE |
| INF-06 | Pantalla de TV con actualización periódica | PARCIAL |
| INF-07 | Copiloto IA con datos del sistema | IMPLEMENTADO |
| INF-08 | Exportación de reportes | PENDIENTE |

`INF-06` es parcial porque la ruta es pública en frontend, pero la API requiere una sesión existente.

## Requisitos no funcionales

| ID | Requisito | Estado |
|---|---|---|
| RNF-01 | Despliegue local con Docker | IMPLEMENTADO |
| RNF-02 | Uso en escritorio y tablet | PARCIAL |
| RNF-03 | Aislamiento lógico por `companyId` | IMPLEMENTADO |
| RNF-04 | Persistencia de PostgreSQL | IMPLEMENTADO |
| RNF-05 | Persistencia de adjuntos | PENDIENTE |
| RNF-06 | HTTPS | PENDIENTE |
| RNF-07 | Backups documentados y probados | PARCIAL |
| RNF-08 | Pruebas de rendimiento con objetivo definido | PENDIENTE |
| RNF-09 | Observabilidad y alertas | PENDIENTE |

## Restricciones actuales

- Monolito modular, no microservicios.
- Eventos manuales del calendario almacenados por navegador.
- Sin funcionamiento offline.
- Sin administración global multiempresa.
- Sin integración IoT.
- Datos demo y branding heredados pendientes de migración.
