# LATEX — Diseño e implementación planificada del módulo de Reportería y Analítica Industrial

> Plan maestro aportado por el usuario el 05/11/2026. Esta versión conserva el alcance, reglas y entregables de la especificación recibida en la conversación. La primera ejecución comprende exclusivamente la Fase 0.

## Misión y límite de ejecución

Evolucionar LATEX hacia una reportería industrial profesional, confiable y escalable para Laboratorio, Fabricación, Envasado, Jefatura y Gerencia. Crear una pantalla principal **Reportería** independiente de **Historial**, preservando y reutilizando su trazabilidad. Aprovechar React 18, TypeScript, Vite, React Router, TanStack Query, Recharts, NestJS 10, Prisma, PostgreSQL, Docker Compose y las integraciones existentes. No introducir otra plataforma, framework, microservicios o servidor BI sin necesidad demostrada.

**Primera ejecución: sólo inspección, diagnóstico, arquitectura y planificación.** No implementar código, instalar dependencias, escribir datos, ejecutar migraciones ni desplegar. Las fases 1 a 5 requieren autorización expresa individual. Toda reportería debe ser de solo lectura respecto de la operación y no modificar tanques, decisiones de Laboratorio, PLC, telemetría, Node-RED o integraciones.

Antes de diseñar: leer `AGENTS.md`, skills pertinentes, `docs/ESTRATEGIA_VALIDACION.md`, manuales de Fabricación y Laboratorio, documentación industrial y código vigente. Verificar afirmaciones contra código. Inspeccionar en particular `PlantHistoryPage.tsx`, `history-pdf.ts`, `history-summary-pdf.ts`, `PlantManagementPage.tsx`, `AppRouter.tsx`, `AppLayout.tsx`, `plant.controller.ts`, `plant.service.ts`, `schema.prisma` y consumidores.

## Referencias conceptuales y externas

Usar ISA-95/IEC 62264 para organización de procesos y datos, ISO 22400 para definiciones de KPI e ISO 9001/PDCA como referencia metodológica, sin afirmar certificación. Revisar selectivamente Carbon (`crbnos/carbon`), ERPNext (`frappe/erpnext`) y Metabase (`metabase/metabase`) y producir matriz de patrón, aplicación, adaptación, licencia y decisión. Inspeccionar licencias antes de reutilizar código; priorizar soluciones propias con bibliotecas instaladas.

## Pantalla funcional `/reporteria`

Cuatro secciones: **Resumen general** consolidado sobre plantas autorizadas, **Laboratorio** (primera prioridad funcional: muestras, decisiones, ajustes, aprobación inicial, tiempos, causas, Pareto y tendencias), **Producción** (OF, plan, cantidades reales sólo verificadas, tiempos, tanques, plantas y envasado como métrica distinta) y **Centro de informes** (plantillas predefinidas, filtros válidos, vista previa, PDF, Excel y CSV). Cada KPI debe permitir abrir sus registros de origen.

Diseñar catálogo de capacidades analíticas por planta: fabricación por lotes, Laboratorio, Envasado, Telemetría, Inyectoras y Planificación, verificadas contra configuración real. El consolidado sólo incluye plantas autorizadas, distingue cero de «No aplica», declara plantas incluidas y excluidas y evita comparar magnitudes diferentes. El backend aplica obligatoriamente empresa, rol y `UserPlantAccess`.

## Indicadores y reglas de dato

Cada KPI debe especificar ID estable, nombre, objetivo, definición, fórmula, unidad, granularidad, fuente, fecha de inclusión, exclusiones, nulos, relación con otros KPI, límites históricos, ejemplo numérico, pruebas y disponibilidad: **verificable**, **calculable con limitaciones** o **no disponible**. No presentar estimaciones como mediciones oficiales.

Laboratorio: solicitud de ajuste candidata = `QualityDecision.result = AJUSTE`, excluyendo cancelaciones según semántica definida; su edición no crea otra solicitud. OF con ajustes = lotes únicos. Motivos = `adjustmentReasons`, con menciones separadas de solicitudes; materiales no multiplican decisiones. Aprobación al primer análisis = primera decisión resuelta por lote, con población y período explícitos. Espera de recepción = `receivedAt - requestedAt`; espera de análisis = `analysisStartedAt - receivedAt`; análisis transcurrido = `resolvedAt - analysisStartedAt`; permanencia en Laboratorio = intersección de intervalos `LABORATORIO` con el período, sin equipararla a trabajo efectivo. No sumar tiempos superpuestos. Evaluar tasas por 100 OF, distribución de ajustes, muestras por lote, ciclos, tiempo a aprobación, rechazos y causas por producto/planta.

Producción: distinguir cantidad planificada, cantidad fabricada real, diferencia plan-real, kg por tanque, fabricación, liberación, envasado, merma y unidades. No inferir kg fabricados sumando pesos históricos ni usar una balanza como cantidad final sin validar. No calcular OEE sin tiempos planificados, producción ideal, pérdidas y paradas confiables. Identificar futuras fuentes SAP, PLC, Node-RED o InfluxDB sin integrarlas en Fase 0.

**Pareto prioritario:** por motivo, planta, producto, mes y OF. Mostrar solicitudes y menciones por separado. Una solicitud con tres motivos cuenta como una solicitud y tres menciones. En Pareto de menciones, porcentaje = menciones del motivo / menciones totales; el acumulado llega a 100 %. Si se usa solicitudes como denominador, etiquetarlo y advertir que la suma puede superar 100 %. Conservar texto original, cambios de catálogo, motivos libres, desconocidos y correcciones.

Períodos en `America/Argentina/Buenos_Aires`, inicio inclusivo y fin exclusivo. Distinguir OF iniciadas, terminadas, decisiones, muestras recibidas y lotes con actividad. Repartir intervalos que cruzan meses según intersección; una duración completa de ciclo puede atribuirse al mes de resolución si se documenta. Identificar lotes por `lotId`, `plantId`, `companyId`, no sólo por texto de OF. Determinar si los informes reflejan estado vigente o reconstrucción a corte; no prometer inmutabilidad no garantizada por `PlantAuditLog`.

## Historial existente: diagnóstico y Fase 1

Investigar PRODUCTO incorrecto en informe resumido, desde captura y corrección hasta persistencia, consulta y PDF; proponer reparación histórica auditada, nunca sobrescritura automática. Eliminar «Estados en el período» sólo del resumen PDF de Laboratorio. Diseñar orden ascendente/descendente en columnas aplicables del resumen por OF, con comparadores correctos y ordenamiento sobre el conjunto filtrado completo cuando haya paginación. Vincular informes con OF en Historial conservando planta, lote y filtros. Mantener Historial como pantalla separada y preservar ambos PDFs actuales durante transición.

## Arquitectura técnica candidata

Evaluar `apps/backend/src/modules/reporting/` y `apps/frontend/src/features/reporting/`; validar convenciones. Separar consultas PostgreSQL/Prisma, métricas testeables, contratos DTO tipados, presentación React y exportación sobre un dataset validado y versionado. Rutas candidatas bajo `/api/reporting`: `overview`, `laboratory`, `laboratory/adjustments`, `production`, `orders` y `exports`; comprobar prefijo vigente. Autenticación, empresa, roles, plantas, filtros, rango y límites en todo endpoint; ninguno público. Agregar en PostgreSQL, paginar con orden determinista, medir planes e índices antes de crearlos. No introducir tablas de KPI, vistas materializadas ni sincronización sin necesidad medida. Pantalla, PDF y Excel deben usar iguales definiciones, filtros, período, corte, unidad y exclusiones.

Comparar jsPDF actual, generación NestJS, composición PDF y HTML a PDF headless por calidad, tamaño, mantenimiento, seguridad, páginas extensas, Docker sin internet, dependencias nativas, memoria y licencia; recomendar una opción concreta sin nuevo servicio de inicio. PDFs editoriales con identificación, resumen, desarrollo, detalle y metodología; logo, versión, corte, usuario, paginación, tablas multipágina, A4 apropiado, formatos argentinos y sin truncamiento silencioso. Libro Excel propuesto con hojas Resumen, Indicadores, OF, Ajustes, Motivos, Ciclos de Laboratorio y Metodología; conservar tipos numéricos/fechas y evitar inyección de fórmulas.

UX moderna industrial, consistente con LATEX y temas claro/oscuro: menú, filtros persistentes, selección múltiple de plantas, mes/año y rango, gráficos interactivos, tablas ordenables, drill-down, paginación, carga, vacío, errores, diseño responsive, teclado y contraste. Diseñar wireframes escritorio y pantalla reducida. Proponer matriz explícita de lectura/exportación para LABORATORIO, FABRICACION, ENVASADO, MONITOREO, JEFATURA y ADMIN, sin conceder acciones operativas.

## Escenarios obligatorios a preparar

A: una OF, dos muestras, un ajuste y aprobación final = una OF, una solicitud, dos iteraciones, sin aprobación inicial. B: una solicitud, tres motivos y varios materiales = una solicitud, tres menciones. C: estado entre octubre y noviembre = repartir ocupación. D: mismo texto de OF en distintas plantas = lotes separados. E: corregir motivo = semántica vigente y auditoría documentadas. F: muestra sin resolución = tiempos/resultados finales nulos. G: usuario con subconjunto de plantas = backend impide filtrar planta ajena. H: pantalla/PDF/Excel con filtros y corte iguales = totales iguales. I: volumen grande = medir consultas, respuesta y recursos antes de fijar metas. J: no alterar Fabricación, Laboratorio, Envasado, Historial, Jefatura, PDFs, integraciones ni accesos multiplanta.

## Fases y autorizaciones

0. **Diagnóstico y planificación:** auditoría de Historial, inventario de fuentes, KPI, riesgos, arquitectura, wireframes, plan y backlog; sólo documentación.
1. **Correcciones de Historial:** PRODUCTO, columna, ordenamiento, consultas y regresiones; datos correctos y trazabilidad preservada.
2. **Base de reportería:** backend, contratos, métricas, filtros/roles, agregaciones y frontend; API comprobada y autorizada.
3. **Laboratorio:** dashboard, KPI, Pareto, tiempos, comparación y drill-down; conciliación con origen.
4. **Centro de informes:** PDF, Excel, vista previa, informes, metadatos y auditoría; equivalencia con pantalla y revisión visual.
5. **Producción y expansión:** métricas productivas sólo con fuentes demostrables, plan-real, plantas, tiempos y tendencias.

Cada fase requiere revisión antes de la siguiente; ninguna publicación ni despliegue está incluido. Para fases posteriores, usar rama de trabajo y entornos seguros; nunca seeds, resets o escrituras productivas para probar.

## Seguridad industrial

No migrar durante planificación, corregir datos automáticamente, alterar control de tanques, ampliar permisos sin revisión, consultar plantas ajenas, publicar sin autorización, exponer datos sensibles, generar temporales industriales sin control, saturar PostgreSQL ni conectar analítica al control de PLC. Las pruebas con datos usan fixtures o copias autorizadas.

## Cinco entregables de Fase 0

1. `01-AUDITORIA.md`: hechos, archivos, funciones, defectos, fuentes, calidad de datos y riesgos.
2. `02-INDICADORES.md`: catálogo formal de KPI, fórmulas, fuentes, unidades, períodos, ejemplos y calidad.
3. `03-ARQUITECTURA.md`: backend, frontend, contratos, multiplanta, seguridad, reportes, alternativas y decisiones.
4. `04-UX-REPORTES.md`: navegación, wireframes, dashboards, filtros, PDF y componentes.
5. `PLAN_IMPLEMENTACION.md`: fases, dependencias, tareas, complejidad, riesgos, pruebas, aceptación y orden.

Cada archivo distingue hechos verificados, propuestas y decisiones pendientes, con rutas concretas. Incluir matriz de trazabilidad requisito → fuente → cálculo → servicio → endpoint → pantalla → informe → prueba → fase. Registrar decisiones arquitectónicas con problema, alternativas, recomendación, justificación, impacto, riesgo y condición de revisión.

La respuesta final de Fase 0 debe presentar resumen ejecutivo, diagnóstico, problemas, datos utilizables y ausentes, diseño, estrategia técnica y PDF/Excel, referencias open source, fases, riesgos, primera fase recomendada y archivos generados. **Detenerse al terminar Fase 0.**
