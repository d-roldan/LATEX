# Fase 0 · Experiencia de Reportería e informes

**Estado:** wireframes y especificación de interacción, sin componentes construidos. **Anclaje real:** `apps/frontend/src/app/router/AppRouter.tsx` carga páginas con `lazy`; `shared/layouts/AppLayout.tsx` contiene menú, selector de planta, tema y controles móviles; `features/plant/useActivePlant.ts` conserva `?plant=`, `features/plant/PlantHistoryPage.tsx` abre trazabilidad en `Dialog`, usa Recharts y genera los PDFs existentes. La ruta `/reporteria` y los componentes citados abajo son **propuestos**.

## 1. Mapa de navegación

```text
Menú lateral LATEX
├─ Historial (permanece independiente)
└─ Reportería  /reporteria
   ├─ Resumen general       ?vista=resumen
   ├─ Laboratorio           ?vista=laboratorio
   ├─ Producción            ?vista=produccion
   └─ Centro de informes    ?vista=informes
       └─ plantilla predefinida → vista previa → PDF / Excel / CSV

Tarjeta KPI / fila / punto de gráfico → detalle con filtros intactos
Detalle de OF → Historial ?plant=<código>&lotId=<id>&... → trazabilidad
```

El `lotId` es necesario para enlaces exactos; la pantalla Historial actual abre el diálogo con estado local y todavía no interpreta ese parámetro. Fase 1/3 deberán acordar la semántica del enlace. Si LABORATORIO no obtiene permiso de Historial, el drill-down debe usar una vista de detalle autorizada del módulo, nunca una ruta que lo redirija sin explicación.

## 2. Wireframe de escritorio

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ SIDEBAR │ Reportería                         Último corte: 05/11 14:30 ART  │
│         │ [Resumen] [Laboratorio] [Producción] [Centro de informes]        │
│         │ Plantas [Látex ▾] [Terplast ▾]  Período [Oct 2026 ▾] [Aplicar]  │
│         │ Producto [Todos ▾]  Tanque [Todos ▾]  [Limpiar] [Guardar enlace] │
│         ├───────────────────────────────────────────────────────────────────┤
│         │  OF evaluadas  │ Ajustes  │ Aprobación inicial │ Espera mediana   │
│         │  120  → detalle│  34 →... │  71 % → detalle     │  28 min → ...    │
│         │  fuente / cobertura / diferencia vs período comparable           │
│         ├────────────────────────────────┬──────────────────────────────────┤
│         │ Evolución mensual              │ Pareto de motivos                │
│         │ [gráfico + tabla accesible]     │ [barras + acumulado + tabla]     │
│         ├────────────────────────────────┴──────────────────────────────────┤
│         │ OF con decisiones [ordenar] [filtrar] [página 1 de N]            │
│         │ Planta | OF | Producto | Iteraciones | Ajustes | Estado | Abrir  │
│         └───────────────────────────────────────────────────────────────────┘
└──────────────────────────────────────────────────────────────────────────────┘
```

Las cifras del wireframe son ficticias. La tarjeta debe incluir población (`n`), fórmula abreviada, unidad, cobertura y enlace «Ver registros». Si la métrica no está disponible, usar **No aplica**, **Sin datos** o **Pendiente de validación** con motivo; jamás mostrar 0 % sin denominador. El gráfico de Pareto separa solicitudes y menciones: eje de barras en menciones, línea acumulada sobre total de menciones, resumen de solicitudes en texto. Tabla accesible debajo del gráfico.

## 3. Wireframe de pantalla reducida

```text
┌───────────────────────────────┐
│ ☰  Reportería       Tema      │
│ [Laboratorio ▾]              │
│ Plantas: 2 seleccionadas      │
│ Oct 2026  [Filtros ▾] [Aplicar]│
├───────────────────────────────┤
│ Aprobación inicial 71 %       │
│ 85/120 OF · Ver registros →   │
├───────────────────────────────┤
│ Ajustes 34 · Ver detalle →    │
├───────────────────────────────┤
│ Pareto [gráfico desplazable]  │
│ Motivo   Menciones   % acum.  │
├───────────────────────────────┤
│ OF [Buscar] [Ordenar ▾]       │
│ tarjeta por OF → Historial    │
│ [Cargar más / página]         │
└───────────────────────────────┘
```

En móvil, filtros secundarios se abren en un panel con foco gestionado, resumen visible de lo aplicado y botón «Aplicar». La tabla se convierte en filas condensadas sin ocultar criterios críticos. No depender del hover para detalles. Mantener contraste, foco visible, zoom del navegador y `prefers-reduced-motion`.

## 4. Experiencia de filtros y drill-down

| Interacción | Diseño propuesto | Prueba de aceptación |
| --- | --- | --- |
| Plantas múltiples | Selector con sólo plantas autorizadas, estados «compatible», «sin datos» y «no aplica»; control «todas las autorizadas» | Cambio de planta no muestra datos cacheados de otra; servidor rechaza ID ajeno. |
| Mes/año y rango | `month=YYYY-MM` como valor predeterminado; rango personalizado `[desde, hasta exclusivo)` con visualización de fechas locales | Octubre incluye 01/10 00:00 y excluye 01/11 00:00 ART; atrás/adelante conserva filtros. |
| Producto/OF/tanque | Filtros contextualizados por capacidad y planta; OF textual es búsqueda, enlace lleva `lotId` | Dos OF con mismo texto en plantas distintas siguen separadas. |
| Persistencia | Parámetros compartibles en URL; query keys incluyen usuario, plantas y todos los filtros; opción de «Limpiar» | Recarga y navegación restauran estado sin filtrar datos de otra sesión. |
| Tarjeta/gráfico | Clic abre conjunto de registros que explica el valor, con filtros y fórmula visibles | El número de IDs de origen concilia con KPI, salvo métrica de menciones cuya unidad se rotula. |
| Tablas | Ordenamiento por tipo en backend, desempate estable y paginación | Segunda página respeta orden global y no repite/omite registros. |
| Errores y vacíos | Mensaje accionable con reintento y fecha de corte; diferenciar sin datos/no aplica/sin permiso | Lectores de pantalla y teclado reciben el estado sin depender de color. |

El selector global de `AppLayout` es de **una** planta y `useActivePlant.select()` cambia rutas según la planta. La nueva selección múltiple debe ser local a Reportería, con `plantIds[]` de la API; no modificar el selector operativo global para simular «todas». El menú puede mostrar Reportería por rol, pero el servidor decide el acceso real.

## 5. Secciones y contenido inicial

| Sección | Primer conjunto recomendado | Contenido condicionado |
| --- | --- | --- |
| Resumen general | OF iniciadas/terminadas, decisiones, solicitudes y cobertura con desglose de plantas | Aprobación inicial sólo con cohorte conciliada; kg reales fabricados fuera. |
| Laboratorio | Muestras, esperas, análisis transcurrido, solicitudes, OF afectadas, Pareto, tabla de decisiones | Tendencias y comparación por producto tras calidad de descripciones; permanencia separada de tiempo de trabajo. |
| Producción | OF, plan conocido, intervalos de fabricación y OE diferenciadas | Plan-real, kg fabricados, OEE y merma de fabricación bloqueados hasta fuente validada. |
| Centro de informes | Plantillas 1–3, filtros, cobertura, vista previa, metodología y exportación | Plantillas 4–6 se habilitan por fases/validación. |

## 6. Sistema de diseño de PDF

**Plantillas propuestas:** (1) mensual de Laboratorio; (2) resumen por OF multiplanta; (3) detalle de ajustes; luego (4) trazabilidad individual; (5) Producción mensual; (6) comparación entre plantas. Las tres primeras son prioridad. El Historial existente y sus PDFs continúan durante transición.

```text
┌────────────────────── A4 vertical, portada ──────────────────────┐
│ Logo Grupo DISAL                        REPORTE / versión R-001  │
│ INFORME MENSUAL DE LABORATORIO                                   │
│ Octubre 2026 · Plantas: Látex, Terplast                          │
│ Corte: 05/11/2026 14:30 ART · Generado: ... · Usuario: ...       │
│ Cobertura: 2/3 plantas compatibles · 120 OF evaluadas            │
│                                                                   │
│ Resumen ejecutivo comprobable                                    │
│ [KPI] [KPI] [KPI]   diferencias vs mes comparable                │
│ Advertencias de dato / exclusiones                               │
├────────────────────── páginas interiores ────────────────────────┤
│ Evolución / Pareto / tiempos con unidades y leyendas             │
│ Tabla de OF, decisiones y motivos (cabecera repetida)            │
│ Enlaces/IDs de registro, sin truncamiento silencioso             │
├────────────────────── anexo / metodología ───────────────────────┤
│ Definiciones, fórmulas, cohortes, fuentes, cobertura, límites     │
│ Grupo DISAL · Confidencialidad según política · Página X de Y   │
└───────────────────────────────────────────────────────────────────┘
```

Paleta basada en la identidad actual (`history-summary-pdf.ts` usa azul oscuro `#09233f`), con contraste comprobado; tipografía jerárquica y tabulares numéricos; A4 horizontal para tablas anchas, vertical para resumen; márgenes y encabezados repetidos; gráficos vectoriales o alta resolución con equivalente tabular. Formatos `es-AR` y fechas con ART explícito. Un informe extenso puede tener resumen PDF y anexo completo/Excel, con conteo total y aviso del límite; nunca cortar filas sin aviso. La vista previa muestra portada, metadatos, páginas estimadas y advertencias antes de descargar.

**Excel propuesto:** hojas Resumen, Indicadores, OF, Ajustes, Motivos, Ciclos de Laboratorio y Metodología. Fechas/números tipados, identificadores estables, `datasetVersion`, filtros, corte y cobertura. CSV sólo para tablas simples. Celdas textuales se neutralizan contra fórmulas. La descarga no incluye datos de plantas fuera del alcance.

## 7. Componentes existentes y futuros

| Existente | Reutilización propuesta | No duplicar / riesgo |
| --- | --- | --- |
| `AppLayout`, `AppRouter`, `ProtectedRoute` | Menú, tema y ruta protegida | Autorización efectiva sigue en backend. |
| `useActivePlant` | Contexto de planta activa inicial y enlace a Historial | No representa selección múltiple. |
| `Dialog` y enlaces de `PlantHistoryPage` | Trazabilidad individual, si se agrega enlace por `lotId` | No copiar toda la página ni depender de carga de 1.000 filas. |
| Recharts ya instalado | Series y Pareto con tabla de apoyo | Evitar gráfico sin datos subyacentes accesibles. |
| `history-pdf.ts`, `history-summary-pdf.ts` | Referencia de estilo y transición | No calcular KPI mensual en el frontend ni extender PDF de Historial como motor universal. |
| `PlantManagementPage` | Referencia de descarga y corte diario | Su `.xls` XML no representa el nuevo libro `.xlsx`. |

**Pendiente de decisión:** audiencia exacta de cada plantilla, permisos de exportación por rol, terminología «producto» vs «semielaborado», retención de documentos generados y tamaño máximo, una vez medidos datos reales.
