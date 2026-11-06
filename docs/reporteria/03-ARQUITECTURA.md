# Fase 0 · Arquitectura propuesta de Reportería

> Actualización del 05/11/2026: se inició localmente una base de sólo lectura de Fase 2 con módulo reporting, rutas capabilities/overview/orders y pantalla /reporteria. Las restantes rutas y exportaciones de este documento continúan como propuestas.

**Estado:** recomendación para revisión, sin implementación en Fase 0. **Base verificada:** `apps/backend/src/app.module.ts`, `main.ts`, `modules/plant/*`, `prisma/schema.prisma`, `apps/frontend/src/app/router/AppRouter.tsx`, `shared/layouts/AppLayout.tsx`, `shared/api/http.ts` y `features/plant/*`. El backend utiliza prefijo global `/api`, `ValidationPipe`, JWT, `RolesGuard` y Prisma; el frontend llama a `/api` con Axios y carga páginas de forma diferida. `PlantService` concentra hoy operación, histórico y exportación diaria.

## 1. Diseño lógico

```text
AppRouter / AppLayout /reporteria
        │ filtros URL + TanStack Query (empresa, usuario, plantas, período)
        ▼
ReportingController (JWT, roles, DTO, límites)
        │ alcance efectivo = companyId + UserPlantAccess ∩ plantas solicitadas
        ▼
ReportingService ── definiciones KPI versionadas ── dataset con metadatos
        │                                      ├─ respuesta de dashboard/detalle
        ▼                                      └─ PDF / Excel / CSV
ReportingQueries (Prisma/SQL parametrizado)
        │
        └── PostgreSQL: ProductionLot, LaboratorySample, QualityDecision,
            TankStateHistory, PackagingOrder, PlantAuditLog

Historial existente ── enlace por plantId + lotId ── trazabilidad individual
```

Se recomienda `apps/backend/src/modules/reporting/` con módulo, controlador, servicio de métricas, consultas y exportadores concretos; `apps/frontend/src/features/reporting/` con página, filtros, tarjetas, gráficos, tablas y cliente tipado. Estas son **rutas futuras**, no archivos existentes. Mantener la operación de tanques en `PlantModule`; reportería sólo lee. Evitar un repositorio genérico que reenvíe Prisma sin aportar un límite de dominio.

## 2. Contrato HTTP propuesto

El prefijo `/api` está confirmado en `apps/backend/src/main.ts`; las rutas bajo `reporting` son propuestas. El controlador tendrá `@UseGuards(JwtAuthGuard, RolesGuard)` y ningún endpoint público. El frontend tendrá ruta `/reporteria` protegida y navegación en `AppLayout`.

| Método y ruta candidata | Resultado | Fase |
| --- | --- | --- |
| `GET /api/reporting/capabilities` | Plantas autorizadas, capacidades verificadas y motivos de «No aplica» | 2 |
| `GET /api/reporting/overview` | KPI consolidado y cobertura por planta | 2–3 |
| `GET /api/reporting/laboratory` | KPIs, series mensuales, cohortes y cobertura | 3 |
| `GET /api/reporting/laboratory/adjustments` | Pareto y detalle paginado, con denominador explícito | 3 |
| `GET /api/reporting/orders` | OF paginadas y ordenadas en backend; `lotId` para drill-down | 2–3 |
| `GET /api/reporting/production` | Sólo indicadores productivos con fuente aprobada | 5 |
| `POST /api/reporting/exports` | Solicitud validada de plantilla y filtros; respuesta archivo o trabajo acotado | 4 |

**Filtro común candidato:** `plantIds[]` (vacío = todas las autorizadas, sujeto a política del rol), `from` y `toExclusive` ISO o `month=YYYY-MM`, `product/materialCode`, `lotId`, `tankId`, `sortBy`, `sortDirection`, `limit`/`cursor`. No aceptar `companyId` desde cliente. Rechazar rango inválido, planta ajena, combinación imposible y límite excesivo. Para un detalle, exigir `lotId` y volver a verificar que el lote pertenece a empresa/planta autorizadas. Permitir únicamente columnas ordenables enumeradas; añadir desempate por ID.

**Respuesta común:** `datasetVersion`, `metricVersion`, `filters`, `period: {startInclusive, endExclusive, timeZone}`, `dataCutoff`, `generatedAt`, `includedPlants`, `excludedPlants: [{plantId, reason}]`, `coverage`, `warnings`, `totals`, `rows`, `pageInfo`. `dataCutoff` es el instante lógico de consulta; la garantía de snapshot consistente entre múltiples solicitudes exige diseño transaccional o token de snapshot/versionado y se deberá probar. No afirmar reproducción histórica inmutable sólo por mostrar un timestamp.

## 3. Semántica de autorización

El backend resuelve `companyId` y `userId` del JWT. Consulta plantas activas mediante la relación `UserPlantAccess`, como `PlantService.authorizedPlants()`/`assertPlantAccess()`, e intersecta con `plantIds[]`. Una planta solicitada fuera del conjunto produce denegación o no encontrada consistente; nunca se elimina en silencio si la petición la nombró expresamente. El mismo alcance viaja a agregados, series, búsqueda, detalle y exportaciones. Caches y claves TanStack Query incorporan usuario, empresa, plantas y filtros; se invalidan al cambiar sesión o alcance.

### Matriz propuesta, pendiente de aprobación funcional

| Rol | Resumen | Laboratorio | Producción | Centro de informes | Exportación |
| --- | --- | --- | --- | --- | --- |
| LABORATORIO | Sólo KPIs de calidad de plantas asignadas | Sí, lectura | No inicialmente | Plantillas de Laboratorio | PDF/Excel de Laboratorio, si Jefatura aprueba |
| FABRICACION | KPIs de fabricación de plantas asignadas | Sólo lo necesario para su OF, pendiente | Sí, lectura | Plantillas de fabricación | Pendiente |
| ENVASADO | KPIs de envasado de plantas asignadas | No inicialmente | Envasado, lectura | Plantillas de envasado | Pendiente |
| MONITOREO | Resumen de lectura compatible | Lectura agregada, pendiente | Lectura agregada | Plantillas autorizadas | Pendiente |
| JEFATURA | Sí | Sí | Sí | Sí | Sí |
| ADMIN | Sí | Sí | Sí | Sí | Sí |

**Hecho vigente:** Historial está limitado a MONITOREO/JEFATURA/ADMIN en backend y frontend. **Decisión pendiente:** lectura directa de trazabilidad para LABORATORIO desde un reporte; debe definirse un endpoint de detalle autorizado o ampliar Historial de forma explícita, sin abrir sus rutas administrativas ni cambiar permisos operativos. `RolesGuard` permite excepción `isSystemOwner`; respetar esa semántica y probarla. Los roles heredados no se incorporan por supuesto.

## 4. Capacidad analítica por planta

No inferir «tiene Laboratorio» sólo de `Plant.finalOperation=PACKAGING`. Propuesta: construir capacidades desde configuración y **existencia/cobertura comprobada** de entidades, con catálogo explícito por planta aprobado por negocio. `finalOperation`, equipos y telemetría son señales de configuración; el seed no prueba despliegue. Para cada KPI, responder `AVAILABLE`, `NO_DATA`, `NOT_APPLICABLE` o `UNVERIFIED`, con motivo y fecha de cobertura. En agregados, sumar sólo poblaciones compatibles y declarar plantas excluidas. No mezclar ciclos Woojin, kg envasados y kg fabricados.

## 5. Consultas, índices y rendimiento

1. Agregar en PostgreSQL por `companyId`, `plantId`, fecha y claves internas; evitar descargar todos los estados para calcular dashboard. Considerar SQL parametrizado para Pareto de arreglos y recorte de intervalos cuando Prisma no exprese eficientemente la consulta. Jamás interpolar identificadores o `ORDER BY` del usuario.
2. Mantener filtros `[inicio, fin)` y zona `America/Argentina/Buenos_Aires`. El cálculo de intervalos abiertos usa `dataCutoff`; el cálculo de ciclo resuelto no usa `now`. Alinear numeradores/denominadores por cohorte.
3. Paginación estable en detalle por columna permitida más ID; ordenamiento en el conjunto filtrado completo. `OFFSET` puede servir al principio con límites pequeños; cursor para profundidad alta si la medición lo justifica. Exportación separada con techo explícito y aviso de partición/anexo, nunca truncamiento silencioso.
4. Índices existentes en `schema.prisma`: `QualityDecision(companyId,createdAt)` y `(lotId,createdAt)`, `LaboratorySample(plantId,status,requestedAt)`, `TankStateHistory(companyId,tankId,startedAt)` y `(companyId,state,endedAt)`, `ProductionLot(companyId,manufacturingOrder)` y `(tankId,startedAt)`. Faltan índices dedicados para varios filtros analíticos propuestos, **pero no se recomienda agregar ninguno antes de medir planes y distribución real**.
5. Perfilado en copia autorizada: cardinalidad por planta/mes, `EXPLAIN (ANALYZE, BUFFERS)` sólo cuando sea seguro, latencia p50/p95 de API, tamaño de respuesta y memoria de exportación. Establecer presupuesto de tiempo con datos observados. No crear vistas materializadas, caché ni tablas de agregados inicialmente.

## 6. Dataset y exportaciones

Un único constructor de dataset aplica alcance, filtros, fórmulas y exclusiones. Dashboard, PDF, Excel y CSV consumen ese contrato versionado. Para una equivalencia exacta entre formatos, producir la exportación desde el dataset conservado en una misma operación o desde un identificador de corte/snapshot verificable; repetir la consulta en momentos distintos puede cambiar los valores si se corrige una decisión. La respuesta incluye cobertura y advertencias.

**PDF recomendado en primera entrega de Centro de informes:** conservar jsPDF + `jspdf-autotable` para Historial; para plantillas analíticas iniciales, reutilizar estas bibliotecas sólo si una prueba de maqueta demuestra calidad y memoria adecuadas. El cálculo siempre queda en backend. Un generador **en backend** merece preferencia para documentos oficiales extensos y control de acceso, pero hoy no hay biblioteca PDF de composición instalada allí; la elección de biblioteca queda condicionada a una prueba de concepto y revisión de licencia en Fase 4. No trasladar el generador PDF manual de Jefatura como base de informes multipágina. No instalar Chromium/headless por defecto: aumenta imagen, memoria, superficie de mantenimiento y dependencia nativa. Para documentos pequeños, jsPDF existente reduce cambio; para largos, evaluar generador Node sin navegador, medición visual/memoria y compatibilidad offline antes de aprobar dependencia.

**Excel:** `managementExport` produce XML Spreadsheet `.xls`, no un libro `.xlsx` moderno. Para el Centro de informes se propone `.xlsx` tipado con hojas Resumen, Indicadores, OF, Ajustes, Motivos, Ciclos y Metodología, sujeto a biblioteca compatible y revisión de licencia en Fase 4. CSV UTF-8 con cabeceras y metadatos aparte para detalle simple. Preservar números/fechas como valores, formatos argentinos sólo visuales; neutralizar celdas controladas por usuario que comiencen por `=`, `+`, `-`, `@` o controles antes de escribir formatos interpretables por hoja de cálculo. Probar fórmulas maliciosas, valores largos, filas máximas y caracteres Unicode.

## 7. Referencias open source: patrones, sin adopción de plataforma

| Referencia | Patrón útil | Aplicación en LATEX | Adaptación | Licencia inspeccionada | Decisión |
| --- | --- | --- | --- | --- | --- |
| [Carbon](https://github.com/crbnos/carbon) | Vínculo explícito entre calidad, ejecución y trazabilidad por lote | Drill-down desde KPI a `lotId` y registro de calidad | LATEX conserva sus propios modelos y navegación; no replica ERP/QMS entero | [AGPLv3 con archivos enterprise comerciales](https://github.com/crbnos/carbon/blob/main/LICENSE) | Referencia conceptual; no copiar código/componentes. |
| [ERPNext](https://docs.frappe.io/erpnext/manufacturing-reports) | Informes diferenciados de OF abiertas, en proceso, terminadas y analítica de producción | Separar poblaciones de iniciadas/terminadas y filtros de manufactura | No importar modelo ERP ni asumir kg reales disponibles | [GPLv3](https://github.com/frappe/erpnext/blob/develop/license.txt) | Referencia de organización; implementación propia. |
| [Metabase](https://www.metabase.com/docs/latest/dashboards/filters) | Filtros de tablero, [drill-through](https://www.metabase.com/docs/latest/questions/visualizations/drill-through) y [exportación](https://www.metabase.com/docs/latest/questions/exporting-results) | Filtros compartidos, acceso al detalle y descarga con mismo contexto | Reportes predefinidos y autorización por planta de LATEX; sin editor libre | [AGPL fuera de enterprise; enterprise comercial](https://github.com/metabase/metabase/blob/master/LICENSE.txt) | Referencia UX; no añadir servidor ni copiar componentes. |

La revisión fue selectiva de documentación/repositorios oficiales, no auditoría de licencia de dependencias transitivas. Cualquier copia futura requiere evaluación legal específica; en este plan no se reutiliza código externo.

## 8. Registro de decisiones arquitectónicas

| ID | Problema y alternativas | Recomendación / justificación | Impacto, riesgo y revisión futura |
| --- | --- | --- | --- |
| ADR-01 | Historial ampliado vs nueva pantalla | Nueva `/reporteria` y enlace a Historial: audiencias y métricas distintas, trazabilidad conservada | Añade ruta/menú; revisar si la navegación se duplica. |
| ADR-02 | Cálculo en navegador vs backend | Métricas centralizadas en NestJS/PostgreSQL: población completa, permisos, consistencia de exportación | Más consultas backend; medir planes y límites. |
| ADR-03 | OF textual vs `lotId` | Clave interna por lote/planta/empresa: numeración no única en esquema | URLs y exportaciones deben incluir identidad estable; validar compartibilidad. |
| ADR-04 | Snapshot/estado vigente | Primera versión usa estado vigente con corte explícito y auditoría enlazada; no promete reconstrucción histórica | Informes recalculados pueden variar; revisar si negocio exige reproducción a fecha anterior. |
| ADR-05 | PDF jsPDF/backend/headless | Mantener PDFs existentes; ensayo de plantilla con jsPDF y decisión de generador backend tras medir documento extenso | Riesgo de divergencia si cliente calcula; constructor de dataset único obligatorio. Revisar en Fase 4. |
| ADR-06 | Índices/cache/materialización tempranos | Consulta agregada con índices actuales y medición primero | Riesgo de latencia a volumen alto; revisar según perfilado p95/planes. |
| ADR-07 | Catálogo fijo vs inferido | Catálogo explícito aprobado, sustentado por fuentes y cobertura | Mantenimiento al habilitar planta; revisar con nuevas integraciones. |

ISA-95/IEC 62264, ISO 22400 e ISO 9001/PDCA se usan como referencias de organización, definición y mejora; esta arquitectura no declara conformidad normativa ni certificación.
