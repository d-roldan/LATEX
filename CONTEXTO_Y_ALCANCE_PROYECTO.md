# Contexto y alcance integral · Sistema de trazabilidad DISAL

> Documento maestro del proyecto. Estado de referencia: 3 de septiembre de 2026.

## 1. Propósito del documento

Este documento reúne el contexto industrial, el alcance implementado, la arquitectura vigente y la evolución prevista del sistema de planta de látex DISAL. Debe utilizarse como fuente común para conversar con Producción, Automatización, Laboratorio, Envasado, Sistemas y Jefatura.

El objetivo final es disponer de una trazabilidad completa y consultable de una orden productiva, desde el inicio de la receta hasta el cierre del envasado:

```text
Orden de fabricación
  → receta ejecutada
  → cargas de materias primas
  → operaciones de proceso y agitación
  → controles de laboratorio y ajustes
  → aprobación
  → orden de envasado
  → envases producidos, rechazo y merma
  → cierre y balance del lote
```

## 2. Visión del proyecto

DISAL necesita un sistema industrial que permita conocer, para cada orden de fabricación:

- Qué producto se fabricó.
- En qué tanque se procesó.
- Qué receta y versión se utilizaron.
- Qué materias primas se cargaron.
- Cuál era el setpoint de cada carga.
- Cuánto peso ingresó realmente.
- Qué válvulas y equipos intervinieron.
- Cuándo comenzó y terminó cada operación.
- Qué tiempos de proceso, espera y detención existieron.
- Qué determinó Laboratorio y qué ajustes se realizaron.
- Qué orden de envasado consumió el lote.
- Cuántos kilogramos y envases buenos se produjeron.
- Qué rechazos, mermas y diferencias de balance existieron.
- Quién realizó, confirmó o corrigió cada intervención humana.

La información debe poder reconstruirse históricamente sin depender de la pantalla actual del SCADA ni de la memoria de los operadores.

## 3. Contexto industrial confirmado

### 3.1 Control de proceso existente

La planta ya dispone de un PLC operado mediante SCADA. El operador selecciona o carga una receta de látex y el PLC ejecuta automáticamente su secuencia:

- Carga los productos necesarios etapa por etapa.
- Utiliza válvulas asociadas a las cañerías de materias primas.
- Trabaja con setpoints de peso para cada carga.
- Controla el agitador y otras operaciones automáticas del proceso.
- Presenta la operación al usuario mediante SCADA.

Por lo tanto, el nuevo sistema no debe reemplazar al PLC ni actuar como segundo controlador de proceso. Su función será recibir los datos de ejecución, asociarlos con la orden productiva, consolidarlos y conservar la trazabilidad.

### 3.2 Historial de peso existente

El peso de los tanques se almacena históricamente segundo a segundo en InfluxDB. Esta señal permitirá:

- Reconstruir el peso antes, durante y después de cada carga.
- Calcular el incremento real de peso asociado a una apertura de válvula.
- Comparar cantidad programada y cantidad incorporada.
- Analizar estabilidad, sobrecargas, interrupciones y diferencias.
- Conservar evidencia detallada sin duplicar todas las muestras en PostgreSQL.

La aplicación web actual recibe además el último peso desde Node-RED aproximadamente cada dos segundos para mostrarlo en vivo. Esas lecturas en vivo permanecen en memoria del backend y no se guardan en PostgreSQL.

## 4. Planta y equipos

La planta tiene nueve tanques fijos:

| Tanque | `scaleKey` | Volumen nominal | Máximo visual en kg |
|---|---|---:|---:|
| TK101 | `TK101` | 40.000 L | 60.000 kg |
| TK102 | `TK102` | 40.000 L | 60.000 kg |
| TK103 | `TK103` | 30.000 L | 45.000 kg |
| TK104 | `TK104` | 30.000 L | 45.000 kg |
| TK105 | `TK105` | 20.000 L | 30.000 kg |
| TK106 | `TK106` | 20.000 L | 30.000 kg |
| TK107 | `TK107` | 20.000 L | 30.000 kg |
| TK108 | `TK108` | 7.000 L | 10.500 kg |
| TK109 | `TK109` | 7.000 L | 10.500 kg |

El máximo en kilogramos se calcula con el factor conservador de diseño `1,5 kg/L`.

## 5. Identificadores y reglas de datos

| Dato | Regla vigente |
|---|---|
| Orden de fabricación (OF) | Exactamente 8 dígitos |
| Orden de envasado (OE) | Exactamente 8 dígitos |
| Material | Exactamente 6 dígitos; normalmente comienza con `60` |
| Tanque | TK101 a TK109 |
| Peso | Kilogramos; visualización redondeada al kg en paneles |
| Peso específico | Hasta 3 decimales |
| Fecha técnica | Instante UTC |
| Fecha presentada | `America/Argentina/Buenos_Aires` |

Para la trazabilidad ampliada será necesario incorporar identificadores estables adicionales:

- Identificador de ejecución o corrida de receta.
- Código y versión de receta.
- Identificador de paso de receta.
- Identificador de válvula y equipo.
- Código de materia prima y, cuando exista, lote de proveedor.
- Identificador único de evento originado en PLC/SCADA o Node-RED.

## 6. Alcance implementado actualmente

### 6.1 Usuarios y roles

| Rol | Función |
|---|---|
| `FABRICACION` | Iniciar y corregir lotes, enviar a laboratorio y gestionar servicio |
| `LABORATORIO` | Aprobar, solicitar ajuste o rechazar |
| `ENVASADO` | Iniciar, cambiar, corregir y finalizar órdenes de envasado |
| `MONITOREO` | Visualización e historial sin modificaciones |
| `JEFATURA` | Resumen diario, historial, cierres y exportaciones |
| `ADMIN` | Acceso completo y administración de usuarios |

La interfaz oculta las operaciones no autorizadas y el backend valida nuevamente el rol en cada endpoint.

### 6.2 Flujo productivo vigente

```text
VACIO → FABRICANDO → LABORATORIO → APROBADO → ENVASANDO → VACIO
                         │
                         ├─→ AJUSTE → LABORATORIO
                         └─→ RECHAZADO → VACIO

VACIO ↔ FUERA_DE_SERVICIO
```

### 6.3 Información registrada actualmente

- OF, material y descripción.
- Tanque y estado vigente.
- Inicio, fin y duración de cada estado.
- Cantidad planificada, prioridad, turno y fecha programada.
- Responsable de cada transición o corrección.
- Decisiones de Laboratorio, legajo, peso específico y motivo.
- OE, línea, formato, inicio, fin y duración.
- Kilogramos envasados, envases producidos y merma cuando se informan.
- Fotografía puntual del peso al cambiar de estado.
- Auditoría de correcciones con valores anterior y nuevo.
- Cierre diario y observaciones de Jefatura.

### 6.4 Pantallas vigentes

- Fabricación.
- Laboratorio.
- Envasado.
- Monitoreo de planta y vista pública para televisores con planta explícita en la URL.
- Historial de estados y línea temporal por lote.
- Resumen diario para Jefatura.
- Administración de usuarios.

La interfaz está preparada para Full HD, tiene menú desplegable, pantalla completa, confirmaciones internas y actualización frecuente de pesos. La planta activa se identifica por nombre y código; `/tv` requiere configurarla mediante `?plant=CODIGO` para evitar que un televisor muestre otra operación por omisión. Los diálogos conservan el foco dentro de la interacción y las pantallas principales se descargan como módulos independientes.

## 7. Arquitectura actual

| Componente | Tecnología | Responsabilidad |
|---|---|---|
| Frontend | React, TypeScript, Vite | Operación sectorial, monitoreo e informes |
| Backend | NestJS, Prisma | Reglas, seguridad, estados, auditoría e integraciones |
| Base transaccional | PostgreSQL 16 | Lotes, estados, calidad, envasado, usuarios y cierres |
| Integración | Node-RED | Recepción, adaptación y envío de señales |
| Proxy | Nginx | Punto de entrada HTTP |
| Infraestructura | Docker Compose | Ejecución de los servicios DISAL |
| Historiador externo | InfluxDB | Peso segundo a segundo de los tanques |
| Control industrial | PLC + SCADA | Ejecución real y segura de la receta |

Contenedores vigentes:

- `disal-db`
- `disal-backend`
- `disal-frontend`
- `disal-nginx`
- `disal-node-red`

InfluxDB, PLC y SCADA forman parte del contexto industrial, pero todavía no están integrados funcionalmente al modelo de trazabilidad ampliada de esta aplicación.

## 8. Principio de integración con PLC y SCADA

La frontera de responsabilidades propuesta es:

### PLC/SCADA

- Ejecuta la lógica automática.
- Controla válvulas, bombas, agitadores y seguridades.
- Administra interlocks y condiciones de proceso.
- Determina el avance físico de la receta.
- Permite al operador iniciar, detener o intervenir según la lógica autorizada.

### Sistema DISAL

- Recibe la receta iniciada y una fotografía de sus valores.
- Registra el inicio, avance, fin y resultado de cada paso.
- Relaciona señales físicas con OF, tanque, material y receta.
- Consulta InfluxDB para consolidar cantidades reales.
- Conserva eventos productivos y auditoría.
- Presenta trazabilidad, indicadores, excepciones y balances.

### Node-RED o servicio de integración

- Lee o recibe tags/eventos del PLC.
- Normaliza nombres, unidades, timestamps y calidad de señal.
- Genera identificadores idempotentes.
- Envía eventos al backend DISAL.
- Reintenta ante interrupciones sin crear duplicados.

DISAL no debe escribir comandos de apertura, cierre, marcha o parada al PLC dentro del alcance de trazabilidad. Una futura capacidad de mando requeriría un proyecto de automatización, seguridad funcional y validación separado.

## 9. Alcance objetivo de trazabilidad integral

### 9.1 Inicio de ejecución de receta

Al comenzar una fabricación se debe guardar una fotografía inmutable de:

- OF.
- Material fabricado.
- Descripción.
- Tanque.
- Código y versión de receta.
- Identificador de corrida generado por PLC/SCADA.
- Fecha/hora de inicio.
- Usuario u operador de SCADA.
- Parámetros efectivos de la receta.
- Lista ordenada de pasos.
- Material, setpoint, tolerancia y unidad de cada carga.
- Tiempos y velocidades programadas de agitación.

No alcanza con conservar una referencia a la receta maestra: si la receta cambia posteriormente, la ejecución histórica debe seguir mostrando exactamente los valores con los que se fabricó.

### 9.2 Carga automática de materias primas

Cada paso de carga deberá registrar:

- Corrida de receta y OF.
- Número y nombre del paso.
- Tanque destino.
- Válvula, bomba o equipo utilizado.
- Cañería.
- Material previsto.
- Setpoint de peso.
- Tolerancia inferior y superior.
- Peso inicial estabilizado.
- Peso final estabilizado.
- Incremento real de peso.
- Desvío absoluto y porcentual respecto del setpoint.
- Hora de orden, apertura, cierre y estabilización.
- Duración de la carga.
- Resultado: completada, cancelada, interrumpida, excedida o corregida.
- Modo automático/manual.
- Alarmas, pausas e intervenciones asociadas.

### 9.3 Operaciones de proceso

Además de las válvulas, la ejecución debería conservar:

- Inicio y fin de agitación.
- Velocidad o setpoint del agitador, si está disponible.
- Cambios de velocidad.
- Tiempo efectivo de marcha y tiempo detenido.
- Activación de bombas o recirculaciones relevantes.
- Esperas automáticas de receta.
- Alarmas que pausaron o afectaron la fabricación.
- Reanudaciones, saltos de paso o acciones manuales.

### 9.4 Cargas manuales

Pigmentos, aditivos, bolsas u otros materiales agregados manualmente deben poder registrarse con:

- Material.
- Lote de materia prima, si se controla.
- Cantidad objetivo.
- Cantidad real.
- Unidad.
- Responsable.
- Fecha/hora.
- Motivo y autorización si se trata de una corrección.

Si el aumento puede observarse en la balanza, también se debe asociar su diferencia de peso.

### 9.5 Laboratorio y ajustes

La trazabilidad ampliada debe relacionar cada decisión de calidad con:

- Muestra y momento de extracción.
- Especificaciones esperadas.
- Resultados medidos.
- Aprobación, ajuste o rechazo.
- Responsable y legajo.
- Instrucción de ajuste.
- Nueva carga o acción ejecutada como consecuencia.
- Repeticiones del ciclo Laboratorio–Ajuste.

### 9.6 Envasado

Cada OE debe vincularse con una o más OF de origen según la regla real de planta. Como mínimo debe conservar:

- OE de 8 dígitos.
- OF y lote de origen.
- Material.
- Tanque de alimentación.
- Línea y formato.
- Fecha/hora de inicio y fin.
- Contador inicial y final.
- Envases buenos.
- Envases rechazados.
- Unidades reprocesadas, si aplica.
- Kilogramos envasados.
- Merma declarada.
- Peso inicial y remanente final del tanque.
- Paradas y cambios de formato.
- Operadores responsables.

Cuando una OF se divide en varias OE, o una OE utiliza más de una OF, debe existir una relación explícita de consumos; no debe inferirse solamente por proximidad horaria.

## 10. Uso de InfluxDB para calcular cargas

InfluxDB continuará siendo la fuente de la señal de peso de alta frecuencia. PostgreSQL almacenará el resultado productivo consolidado y las referencias necesarias para auditar el cálculo.

### 10.1 Método preliminar

Para una apertura de válvula entre `t0` y `t1`:

1. Consultar una ventana anterior a `t0`.
2. Calcular un peso inicial estabilizado mediante mediana o filtro acordado.
3. Consultar la señal durante la apertura.
4. Esperar la estabilización posterior al cierre.
5. Calcular el peso final estabilizado.
6. Obtener `carga real = peso final - peso inicial`.
7. Comparar la carga real con el setpoint del paso.
8. Guardar el resultado, ventanas consultadas, algoritmo y calidad del cálculo.

### 10.2 Evidencia a conservar en PostgreSQL

- Peso inicial y final utilizados.
- Diferencia calculada.
- Setpoint y tolerancia.
- Timestamps de apertura, cierre y estabilización.
- Identificación de la serie de InfluxDB.
- Versión del algoritmo de cálculo.
- Calidad o nivel de confianza.
- Indicador de corrección manual.
- Motivo, usuario y valores anterior/nuevo de una corrección.

### 10.3 Limitaciones físicas

Si dos materiales ingresan simultáneamente al mismo tanque, la balanza sólo informa el incremento combinado. Para atribuir masa a cada producto se necesitará una de estas condiciones:

- Que la receta impida cargas simultáneas trazables.
- Que existan caudalímetros por línea.
- Que el PLC entregue cantidades reales independientes.
- Que se utilice una conciliación estimada, claramente identificada como tal.

También deben contemplarse vibración del agitador, espuma, oscilaciones, producto adherido a cañerías, goteo posterior al cierre y resolución real de la balanza.

## 11. Configuración válvula–material

Debe existir una configuración histórica y versionada que relacione:

```text
válvula → cañería → material → unidad → vigencia
```

Ejemplo conceptual:

| Válvula | Cañería | Material | Código | Desde | Hasta |
|---|---|---|---|---|---|
| VALV-101-AGUA | Agua TK101 | Agua | 600001 | 2026-09-01 | — |
| VALV-101-EMU | Emulsión TK101 | Emulsión acrílica | 600145 | 2026-09-01 | — |

La vigencia es obligatoria: si una cañería cambia de producto, una fabricación antigua debe conservar la asignación que existía al momento de ejecutarse.

## 12. Modelo de datos objetivo

Las entidades vigentes se mantendrán y podrán ampliarse con:

| Entidad propuesta | Propósito |
|---|---|
| `Recipe` | Identidad de receta maestra |
| `RecipeVersion` | Versión aprobada y parámetros |
| `RecipeExecution` | Corrida concreta asociada a OF y tanque |
| `RecipeExecutionStep` | Fotografía y resultado de cada paso |
| `IndustrialAsset` | Válvula, agitador, bomba, cañería o contador |
| `AssetMaterialAssignment` | Material asociado a un activo y vigencia |
| `ValveEvent` | Orden, apertura, cierre y estado de válvula |
| `ProductionCharge` | Carga consolidada, setpoint, cantidad real y desvío |
| `ManualCharge` | Incorporación manual confirmada |
| `EquipmentRun` | Marcha/parada y parámetros de agitadores o bombas |
| `ProcessAlarmEvent` | Alarma, reconocimiento y duración |
| `PackagingCounterEvent` | Lectura o delta de contador de envases |
| `PackagingLotConsumption` | Relación explícita entre OE y lotes/OF consumidos |
| `ProductionReconciliation` | Balance final de masa y diferencias |
| `IntegrationInbox` | Recepción idempotente y diagnóstico de eventos externos |

Las entidades actuales `Tank`, `ProductionLot`, `TankStateHistory`, `QualityDecision`, `PackagingOrder`, `PlantAuditLog` y `DailyPlantClosure` siguen siendo válidas.

## 13. Línea temporal objetivo de una OF

Ejemplo de resultado esperado:

```text
08:02:10  OF 26090101 iniciada en TK101 con receta LAT-INT v12
08:03:04  Paso 10 iniciado: carga de agua, SP 3.500 kg
08:08:32  Válvula VALV-101-AGUA cerrada; carga calculada 3.512 kg
08:09:01  Paso 20 iniciado: agitación a 420 rpm
08:21:01  Agitación completada; tiempo efectivo 12 min
08:22:13  Paso 30 iniciado: emulsión, SP 3.600 kg
08:28:48  Carga calculada 3.584 kg; desvío -16 kg
10:42:16  Fabricación enviada a Laboratorio
11:06:22  Laboratorio solicita ajuste de viscosidad
11:18:09  Carga correctiva de espesante: 32 kg
12:10:40  Lote aprobado
13:05:11  OE 86090104 iniciada, formato 4 L
17:28:55  OE finalizada: 3.720 envases buenos, 18 rechazados
17:31:03  Tanque vacío; lote cerrado
```

## 14. Balance de masa objetivo

Al finalizar el lote se debe poder calcular:

```text
total de cargas automáticas
+ total de cargas manuales
- producto envasado
- merma declarada
- remanente final
= diferencia no explicada
```

El informe debe mostrar cantidades, porcentaje de diferencia y nivel de aceptación según tolerancias definidas por Producción.

No se debe ocultar una diferencia mediante correcciones destructivas. Toda corrección debe dejar el valor original, el nuevo valor, el motivo y el responsable.

## 15. Información para Jefatura

Además del resumen diario actual, el alcance objetivo permitirá presentar:

- OF activas y avance de receta.
- Paso actual y tiempo estimado restante.
- Cargas completadas contra setpoint.
- Desvíos de carga por producto, tanque y receta.
- Tiempo efectivo de fabricación y tiempos de espera.
- Utilización y detenciones de agitadores.
- Ajustes y rechazos de Laboratorio.
- Lotes aprobados pendientes de envasado.
- OE activas y avance de unidades.
- Envases buenos, rechazados y merma.
- Balance de masa por OF.
- Alarmas o intervenciones manuales relevantes.
- Comparación entre turnos, productos y períodos.

## 16. Requisitos no funcionales

- Timestamps sincronizados mediante NTP entre PLC, SCADA, Node-RED, InfluxDB y servidores.
- Eventos idempotentes para soportar reintentos.
- Ordenamiento por fecha de origen y secuencia del PLC.
- Indicador de calidad de señal.
- Separación entre evento recibido y evento consolidado.
- Operación tolerante a cortes temporales de red.
- Cola o buffer local en integración cuando el backend no esté disponible.
- Auditoría inmutable de modificaciones productivas.
- Autorización por rol y empresa.
- Credenciales y certificados fuera del repositorio.
- Respaldo y restauración probados de PostgreSQL.
- Retención y respaldo definidos para InfluxDB.
- Interfaces legibles en ambiente productivo y Full HD.
- Diagnóstico visible de PLC, Node-RED, InfluxDB, balanzas y contadores sin comunicación.

## 17. Información pendiente para cerrar el diseño

### 17.1 PLC y comunicaciones

- Marca, modelo y versión del PLC.
- Protocolo disponible: OPC UA, Modbus TCP, MQTT, API, base intermedia u otro.
- Si el PLC expone eventos o sólo valores actuales de tags.
- Lista completa de tags, tipos, escalas, unidades y calidad.
- Frecuencia de actualización.
- Timestamps generados en PLC o asignados por el integrador.
- Contador de secuencia o identificador de evento disponible.
- Política de reconexión y retención ante cortes.
- Red, IP, puertos, certificados y restricciones de acceso.

### 17.2 Recetas

- Cómo se identifica una receta y su versión.
- Quién crea, aprueba y modifica recetas.
- Estructura completa de una receta real.
- Cómo informa el PLC la receta iniciada.
- Cómo se identifica una corrida única.
- Campos disponibles por paso.
- Setpoint, tolerancias y unidades.
- Señales de inicio, progreso, completado, cancelado y fallo.
- Posibilidad de saltar, repetir o editar un paso durante la ejecución.
- Conservación de los valores efectivos si el operador modifica un parámetro.

### 17.3 Válvulas, cañerías y materiales

- Inventario de válvulas y nomenclatura del PLC.
- Tanques alcanzados por cada válvula.
- Material que transporta cada cañería.
- Si una misma válvula o línea puede cambiar de material.
- Señal de comando y señal de confirmación física abierta/cerrada.
- Tiempo de tránsito o goteo después del cierre.
- Posibilidad de válvulas simultáneas en un tanque.
- Existencia de caudalímetros u otras mediciones independientes.

### 17.4 Agitadores y equipos

- Tags de marcha, parada, velocidad, corriente y falla.
- Unidad de velocidad y precisión.
- Equipos adicionales relevantes: bombas, recirculaciones, dispersores o molinos.
- Qué eventos deben considerarse productivos y cuáles sólo diagnósticos.

### 17.5 InfluxDB y balanzas

- Versión de InfluxDB.
- Organización, bucket, measurement y tags utilizados.
- Nombre de fields para peso bruto/neto.
- Relación exacta entre serie y TK101–TK109.
- Retención configurada y volumen histórico disponible.
- Resolución, precisión y frecuencia real de cada balanza.
- Calidad o estados de error guardados.
- Sincronización horaria efectiva.
- Acceso de sólo lectura para el backend o servicio de cálculo.
- Ventanas y filtro que Producción acepta para estabilizar el peso.

### 17.6 Cargas manuales

- Qué productos se agregan manualmente.
- Cómo se pesan actualmente.
- Si se requiere lote de proveedor o sólo código de material.
- Quién confirma y quién autoriza correcciones.
- Tolerancias aceptadas.

### 17.7 Laboratorio

- Variables analizadas para cada familia de látex.
- Límites de especificación.
- Equipos de laboratorio con salida digital, si existen.
- Identificación de muestra.
- Datos que deben escribirse manualmente.
- Reglas de aprobación y ajustes.

### 17.8 Envasado

- PLC o sistema que controla cada línea.
- Tags de inicio, fin, marcha, parada y formato.
- Disponibilidad de contador total, buenos y rechazados.
- Momento y reglas de reseteo del contador.
- Relación real entre OF y OE: uno a uno, uno a varios o varios a uno.
- Cómo se mide la merma.
- Cómo se confirma el vaciado del tanque.
- Si se registran pallets, etiquetas, lotes impresos o turnos.

### 17.9 Gestión y operación

- Responsable funcional de cada dato.
- Qué correcciones puede realizar cada rol.
- Período durante el cual puede corregirse una fabricación.
- Tolerancias y umbrales de alerta.
- Informes obligatorios para reunión diaria.
- Necesidad de firma o cierre electrónico del lote.
- Retención legal o interna requerida.
- Disponibilidad objetivo y procedimiento cuando el sistema está fuera de línea.

## 18. Contrato preliminar de eventos

El contrato definitivo dependerá del mapa de tags, pero conceptualmente una carga debería llegar con esta información:

```json
{
  "eventId": "PLC1-20260903-000012345",
  "eventType": "RECIPE_STEP_COMPLETED",
  "occurredAt": "2026-09-03T14:32:18.125Z",
  "source": "PLC-LATEX-01",
  "recipeExecutionId": "RUN-20260903-0042",
  "recipeCode": "LAT-INT",
  "recipeVersion": "12",
  "manufacturingOrder": "26090101",
  "tankKey": "TK101",
  "stepNumber": 30,
  "operation": "CHARGE",
  "assetKey": "VALV-101-EMU",
  "materialCode": "600145",
  "setpointKg": 3600,
  "plcActualKg": 3588,
  "startedAt": "2026-09-03T14:25:40.100Z",
  "finishedAt": "2026-09-03T14:32:18.125Z",
  "mode": "AUTO",
  "result": "COMPLETED",
  "sequence": 12345,
  "signalQuality": "GOOD"
}
```

El backend podría enriquecer ese evento consultando InfluxDB y agregar el incremento calculado de balanza, sin modificar el evento original.

## 19. Etapas recomendadas de implementación

### Etapa 1 · Relevamiento industrial

- Obtener exportación de tags.
- Documentar recetas y estados del PLC.
- Crear matriz válvula–cañería–material–tanque.
- Documentar esquema de InfluxDB.
- Identificar señales de envasado.

### Etapa 2 · Captura de ejecución

- Recibir inicio y fin de receta.
- Guardar fotografía de receta y pasos.
- Recibir estados de pasos, válvulas y agitadores.
- Implementar idempotencia, secuencia y diagnóstico.

### Etapa 3 · Cálculo de cargas

- Consultar InfluxDB.
- Definir algoritmo de estabilización.
- Calcular peso real y desvíos.
- Validar resultados contra fabricaciones conocidas.

### Etapa 4 · Integración de calidad y ajustes

- Vincular muestras y resultados.
- Relacionar ajustes con nuevas cargas o pasos.
- Completar iteraciones de laboratorio.

### Etapa 5 · Integración de envasado

- Capturar contadores y tiempos.
- Relacionar OF, lotes y OE.
- Registrar buenos, rechazados, merma y remanente.

### Etapa 6 · Balance e indicadores

- Conciliar receta, cargas, envasado, merma y saldo.
- Incorporar reportes de Jefatura.
- Definir alertas y criterios de cierre.

## 20. Criterios de aceptación del alcance objetivo

1. Toda ejecución de receta queda asociada inequívocamente con una OF y un tanque.
2. La receta histórica conserva su versión y valores efectivos.
3. Cada paso informa inicio, fin, duración, resultado y origen.
4. Cada carga identifica material, setpoint, cantidad real y desvío.
5. La cantidad calculada desde InfluxDB puede auditarse y reproducirse.
6. Los reintentos de integración no duplican eventos.
7. Las intervenciones manuales quedan identificadas con responsable y motivo.
8. Laboratorio y ajustes forman parte de la misma línea temporal.
9. Cada OE informa cantidades buenas, rechazadas, kilogramos y merma.
10. La relación entre OF, lotes y OE es explícita.
11. El balance de masa identifica cualquier diferencia no explicada.
12. Jefatura puede reconstruir una orden completa sin consultar varios sistemas manualmente.
13. Un cambio posterior de receta o asignación de cañería no altera el pasado.
14. Una interrupción temporal de comunicaciones no pierde eventos ni cambia el control del PLC.
15. DISAL permanece desacoplado de la lógica de seguridad y mando del proceso.

## 21. Decisiones ya confirmadas

- El sistema pertenece a DISAL y no debe conservar referencias a proyectos anteriores.
- Se operan exactamente nueve tanques, TK101 a TK109.
- El PLC/SCADA ya ejecuta automáticamente las recetas.
- Existe historial de peso segundo a segundo en InfluxDB.
- La aplicación web no necesita guardar en PostgreSQL cada muestra continua.
- Los pesos visibles se redondean al kilogramo.
- No se muestran ni operan comandos TARA/CERO.
- La OF y la OE tienen 8 dígitos.
- El material tiene 6 dígitos y normalmente comienza con `60`.
- Jefatura utiliza el resumen diario para presentar el estado al gerente.
- La trazabilidad futura debe alcanzar cada carga de fabricación y el envasado por lote.

## 22. Fuera de alcance o sujeto a proyecto separado

- Reemplazar la lógica del PLC o el SCADA.
- Accionar válvulas, bombas o agitadores desde la aplicación web.
- Modificar interlocks o seguridades de proceso.
- Atribuir con certeza cargas simultáneas sin una medición independiente.
- Corregir retroactivamente datos sin auditoría.
- Utilizar datos estimados como si fueran mediciones confirmadas.

## 23. Próximo entregable necesario

El próximo documento técnico debería ser la **Matriz de Integración PLC/SCADA/InfluxDB**, confeccionada con Automatización. Debe contener:

1. Lista de tags y tipos.
2. Estados y secuencias de receta.
3. Eventos disponibles.
4. Válvulas, equipos, tanques y materiales.
5. Campos y series de InfluxDB.
6. Señales de las líneas de envasado.
7. Ejemplos reales de una fabricación completa.
8. Criterios de timestamps, calidad, reintentos e idempotencia.

Con esa matriz se podrá cerrar el modelo de datos definitivo y especificar los endpoints de integración sin hacer suposiciones sobre el comportamiento del PLC.
