# Requisitos funcionales · Planta de Látex DISAL

Estado de referencia: 15 de septiembre de 2026.

Este documento separa el alcance vigente de la evolución recomendada. Los requisitos objetivo requieren relevamiento y validación con Fabricación, Laboratorio, Envasado, Automatización y Jefatura antes de implementarse.

## Alcance vigente

### Operación

- Nueve tanques fijos TK101–TK109.
- Flujo `VACIO → FABRICANDO → LABORATORIO → APROBADO → ENVASANDO → VACIO`.
- Caminos controlados de ajuste, rechazo y fuera de servicio.
- Pantallas separadas para Fabricación, Laboratorio y Envasado.
- Confirmaciones internas, control de versión y autorización en backend.
- Vista pública de TV configurada mediante una planta explícita en la URL, sin fallback silencioso a Látex.
- Nombre y código de la planta visibles en las vistas operativas y de monitoreo.
- Diálogos con foco inicial, recorrido de teclado contenido y devolución del foco al control de origen.
- Peso en vivo desde Node-RED sin persistencia de muestras continuas.
- Foto del peso únicamente al confirmar un cambio de etapa.

### Trazabilidad

- Inicio, fin y duración de cada estado.
- OF, material, descripción, cantidad planificada, prioridad, turno y programación.
- Responsable y motivo de cada transición o corrección.
- Decisiones e iteraciones de Laboratorio.
- Ciclos de muestra por iteración con hitos de solicitud, recepción y resolución.
- Bloqueo de la decisión de calidad hasta que Laboratorio confirme la recepción física de la muestra.
- OE, línea, formato, dosificadora, filtro, duración, kilogramos, unidades y merma de Envasado.
- Línea temporal consultable por OF.
- Fechas almacenadas con zona horaria y presentadas en Buenos Aires.

### Comunicación entre sectores

- Fabricación notifica a Laboratorio al enviar un tanque a análisis.
- Laboratorio notifica a Envasado al aprobar un lote.
- Laboratorio notifica a Fabricación cuando solicita un ajuste o rechaza un lote.
- Envasado notifica a Fabricación cuando finaliza y libera un tanque.
- Los avisos son personales, se filtran por sector y pueden marcarse como leídos.
- La lectura de un aviso no representa la recepción formal del trabajo. Para la entrega Fabricación–Laboratorio, la recepción de la muestra sí se confirma mediante un hito operativo específico.

### Jefatura

- Rol `JEFATURA` de sólo lectura operativa.
- Resumen diario para reunión: WIP, esperas, finalizados, calidad, envasado y alertas.
- Tiempo actual por tanque con semáforos configurables.
- Conteo de muestras esperando recepción o en análisis, y promedios de envío–recepción y recepción–resultado.
- Cierre diario persistido con observaciones del jefe.
- Exportación del resumen en PDF y Excel.

### Seguridad y continuidad

- JWT, contraseñas con hash y bloqueo por intentos fallidos.
- Separación lógica por empresa.
- PostgreSQL persistente y respaldo previo a migraciones.
- Docker Compose con proxy único de acceso.
- Auditoría de operaciones sensibles.

## Limitaciones conocidas del alcance vigente

- El estado mostrado es el estado operativo registrado por la aplicación; todavía no se reconstruye automáticamente la ejecución física completa del PLC.
- La grilla se actualiza por consulta periódica cada 2 segundos. Las notificaciones se consultan cada 3 segundos.
- El último peso recibido vive en memoria del backend y se pierde al reiniciarlo; la próxima lectura de Node-RED vuelve a poblarlo.
- InfluxDB, PLC y SCADA aún no están integrados al modelo ampliado de receta, pasos y cargas.
- La pantalla TV es pública dentro de la red donde se publique el servicio y muestra datos operativos de OF, material y OE. Cada dispositivo debe guardar una dirección `/tv?plant=CODIGO`; `/tv` sin planta abre solamente la selección de configuración.
- Un aviso leído no tiene estados de aceptación, atención o resolución.
- El cierre de envasado declara el tanque vacío por operación humana; no existe todavía una validación automática contra peso remanente.
- La relación persistida es una OE asociada a un lote. Debe confirmarse si la operación real admite relaciones uno-a-varios o varios-a-uno.
- El historial operativo devuelve hasta 1.000 períodos por consulta y todavía no ofrece paginación.

## Evolución funcional recomendada

### Entrega de trabajo entre sectores

- Cada traspaso debe generar una entrega vinculada con tanque, OF, sector emisor y sector receptor.
- La entrega debe distinguir `PENDIENTE`, `RECIBIDA`, `EN_PROCESO`, `RESUELTA`, `DEVUELTA` y `CANCELADA`.
- Debe registrar quién envía, quién recibe, timestamps, turno, observaciones, prioridad y fecha límite cuando corresponda.
- Una devolución o excepción debe exigir motivo.
- Los tiempos de recepción y resolución deben alimentar alertas y métricas, sin confundirse con el estado físico del tanque.
- Deben existir escalamiento y visibilidad de pendientes entre turnos.

### Estados operativos

Antes de ampliar la máquina de estados se debe validar con la planta la necesidad de representar:

- Espera de materia prima o recurso.
- Pausa de fabricación o envasado.
- Muestra tomada y análisis en curso.
- Retención o bloqueo de Calidad.
- Limpieza y verificación de tanque vacío.
- Transferencia entre tanques.
- Espera de línea y producto remanente.
- Mantenimiento programado.

Sólo deben incorporarse estados que modifiquen responsabilidad, trazabilidad, seguridad o indicadores.

### Integración industrial y tiempo real

- Recibir eventos idempotentes con identificador único, origen, timestamp, secuencia y calidad de señal.
- Conservar por separado el instante ocurrido en PLC y el instante recibido por DISAL.
- Implementar buffer y reintentos en Node-RED o en el integrador sin duplicar eventos.
- Mostrar diagnóstico de PLC, Node-RED, InfluxDB, balanzas y contadores.
- Detectar señal atrasada, congelada, fuera de rango o con mala calidad.
- Mantener InfluxDB como fuente de telemetría de alta frecuencia y PostgreSQL como fuente de eventos productivos consolidados.

### Recetas y fabricación

- Registrar una corrida única y una fotografía inmutable de código, versión, parámetros y pasos de receta.
- Registrar cargas automáticas y manuales con material, lote de proveedor, setpoint, tolerancia, cantidad real y desvío.
- Relacionar válvulas, cañerías, bombas, agitadores y alarmas con cada paso.
- Conservar correcciones manuales con valor anterior, nuevo, motivo y responsable.

### Laboratorio

- Identificar muestra, extracción, recepción, analista e iteración de análisis.
- Configurar ensayos y límites por familia de producto.
- Registrar valor, unidad, especificación, instrumento y resultado de cada ensayo.
- Relacionar cada ajuste con la no conformidad que lo originó y con su reanálisis.
- Evaluar firma o liberación electrónica y adjuntos según los requisitos internos.

### Envasado y balance

- Confirmar y modelar explícitamente la cardinalidad real entre OF, lotes y OE.
- Registrar contadores inicial/final, unidades buenas, rechazadas, reproceso, paradas y cambios de formato.
- Registrar peso inicial, remanente final y consumos parciales por lote.
- Validar el vaciado con una tolerancia de peso configurable; toda excepción debe quedar auditada.
- Calcular el balance de masa identificando diferencias no explicadas.

### Experiencia operativa

- Complementar la grilla con una cola por sector orientada a “qué requiere atención ahora”.
- Priorizar entregas no recibidas, esperas excedidas, falta de señal y desvíos.
- Evaluar códigos de barras o QR para OF, OE, muestras y materiales.
- Mostrar antigüedad y calidad de la lectura, no solamente el indicador en línea/sin señal.
- Evitar que una pantalla almacenada en caché permita interpretar datos antiguos como estado actual.

## Requisitos no funcionales objetivo

- Operación tolerante a cortes temporales de red, con procedimiento de contingencia y reconciliación posterior.
- Sincronización NTP de PLC, SCADA, Node-RED, InfluxDB y servidores.
- Migraciones de base de datos versionadas y repetibles para producción.
- Respaldo y restauración de PostgreSQL e InfluxDB probados periódicamente.
- HTTPS, control de acceso a la pantalla TV y segmentación de red según la política de Sistemas.
- Métricas, logs centralizados, alertas y health checks de todas las dependencias.
- Pruebas automatizadas de la máquina de estados, permisos, concurrencia, integraciones y recuperación ante fallas.
- Procedimiento documentado para operar cuando DISAL no se encuentre disponible.

## Orden sugerido de implementación

1. Relevamiento operativo y matriz PLC/SCADA/InfluxDB.
2. Entregas de trabajo con recepción y resolución entre sectores.
3. Captura confiable e idempotente de eventos industriales.
4. Receta, pasos, cargas y cálculo desde InfluxDB.
5. Muestras, ensayos, ajustes y reanálisis de Laboratorio.
6. Consumos de envasado, remanentes y relación OF–OE.
7. Balance de masa, indicadores y optimización.
# Evolución multiplanta (V0.0.18 candidata)

La aplicación incorpora contexto explícito para Látex, Terplast, Slurry y Enduido. El acceso requiere membresía usuario–planta; los IDs, estados y relaciones históricos de Látex se preservan mediante backfill. Slurry finaliza por trasvase temporizado sin OE, y Enduido opera sin sensor ni valores de peso ficticios. Los nombres físicos, líneas y tags de Terplast/Slurry continúan pendientes y sus integraciones no deben habilitarse hasta confirmarlos. Las rutas anteriores permanecen como compatibilidad exclusiva de Látex.
