# Contexto de la Planta de Látex

## 1. Propósito del documento

Este documento explica el entorno industrial en el que se utiliza el sistema LATEX: cómo se fabrica la pintura látex, qué sectores y equipos intervienen, cómo avanza una orden de fabricación y qué responsabilidad corresponde al sistema.

No es una descripción del código ni un diseño detallado de integración. Su finalidad es proporcionar contexto común a responsables de planta, técnicos de automatización, desarrolladores y futuras herramientas de inteligencia artificial antes de que propongan cambios funcionales o técnicos.

Cuando el documento menciona capacidades futuras, se las identifica expresamente. Esas capacidades representan una dirección de evolución y no deben interpretarse como disponibles actualmente.

## 2. Contexto general de la planta

La planta fabrica pinturas látex en tanques de proceso. Una fabricación recorre, de forma general, la siguiente cadena:

```text
Planificación
    ↓
Fabricación
    ↓
Laboratorio
    ↓
Envasado
    ↓
Paletizado
    ↓
Stretch
    ↓
Stock o despacho
```

En este entorno conviven cuatro niveles de responsabilidad diferentes:

### Automatización de proceso

El PLC, el SCADA y los automatismos de las máquinas controlan el proceso físico. Abren y cierran válvulas, accionan motores, ejecutan secuencias, esperan confirmaciones e impiden maniobras inseguras mediante interlocks.

### Ejecución productiva

Los operadores y los sectores ejecutan el trabajo: seleccionan recetas, agregan materias primas manuales, toman muestras, deciden ajustes, organizan líneas y confirman las operaciones realizadas.

### Trazabilidad

La trazabilidad relaciona los hechos productivos con una orden, un producto, un tanque, un momento y un responsable. Permite reconstruir lo ocurrido aunque el proceso físico ya haya terminado.

### Gestión

La gestión utiliza la información trazada para coordinar sectores, conocer pendientes, detectar demoras, calcular indicadores y tomar decisiones.

LATEX se ubica principalmente en los niveles de trazabilidad y gestión. No reemplaza la automatización existente ni ejecuta directamente el proceso físico.

## 3. Flujo productivo integral

Una orden comienza en Planificación, que define qué producto debe fabricarse y en qué cantidad. Fabricación ejecuta la receta en un tanque. Laboratorio analiza el producto y decide si puede liberarse, si requiere un ajuste o si debe rechazarse. Una vez aprobado, Envasado procesa el contenido del tanque.

La línea automática llena los envases, los transporta, forma los pallets y los envuelve. El pallet terminado queda disponible para stock, despacho o carga en un camión.

El flujo no es solamente una sucesión de máquinas. Entre cada sector existen entregas, esperas, decisiones y responsabilidades que LATEX debe hacer visibles.

## 4. Sector Fabricación

### 4.1 Operación actual

Fabricación utiliza un SCADA para ejecutar las recetas. El operador selecciona la receta correspondiente al producto e inicia el proceso.

El PLC realiza automáticamente las cargas de líquidos definidas en la receta. En determinadas etapas también se incorporan materias primas sólidas de forma manual, normalmente mediante bolsas. Cuando el operador termina la carga solicitada, confirma la operación en el SCADA y la receta continúa con el paso siguiente.

Este ciclo se repite hasta completar la fabricación:

```text
Seleccionar receta
       ↓
Iniciar fabricación
       ↓
Carga automática de líquidos
       ↓
Solicitud de carga manual, cuando corresponde
       ↓
Incorporación de sólidos y confirmación del operador
       ↓
Continuación de la receta
       ↓
Fin de fabricación
```

### 4.2 Responsabilidad del SCADA y del PLC

Son funciones propias de la automatización:

- Apertura y cierre de válvulas.
- Arranque y parada de motores.
- Carga automática de líquidos.
- Control de cantidades del proceso.
- Ejecución de la secuencia de receta.
- Espera de confirmaciones manuales.
- Avance entre etapas.
- Interlocks.
- Seguridad del proceso.

LATEX no debe intentar reemplazar estas funciones ni convertirse en un segundo sistema de control.

### 4.3 Información relevante para LATEX

LATEX registra o contextualiza información productiva como:

- Orden de fabricación.
- Producto y material.
- Receta utilizada.
- Tanque.
- Cantidad planificada.
- Hora de inicio y finalización.
- Usuario responsable.
- Estado de la fabricación.
- Peso actual del tanque.

### 4.4 Evolución posible

En el futuro, LATEX podría recibir del SCADA eventos de alto nivel como:

- Fabricación iniciada.
- Fabricación pausada.
- Fabricación reanudada.
- Fabricación terminada.

No es necesario replicar en LATEX cada señal individual del PLC. Deben integrarse los eventos que aporten contexto, trazabilidad o valor para la gestión.

## 5. Tanques y pesos

### 5.1 Tanques principales

La planta utiliza nueve tanques principales:

- TK101.
- TK102.
- TK103.
- TK104.
- TK105.
- TK106.
- TK107.
- TK108.
- TK109.

Cada tanque dispone de información de peso adquirida por sistemas existentes. Node-RED procesa esos datos y los envía mediante HTTP al backend de LATEX. La señal continua se almacena además segundo a segundo en InfluxDB, fuera de la memoria del backend.

### 5.2 Peso instantáneo y evento productivo

El peso instantáneo es telemetría: cambia continuamente y describe la condición actual del tanque. Por sí solo no explica qué operación está ocurriendo ni a qué lote pertenece.

Un evento de trazabilidad, en cambio, conserva un hecho productivo con su contexto.

```text
Telemetría instantánea
TK104 = 17.945 kg

Evento productivo
OF: 00458921
Tanque: TK104
Evento: fabricación finalizada
Peso en la transición: 17.945 kg
Hora: 10:18
```

LATEX conserva en RAM sólo el último peso recibido para aportar visibilidad en vivo y puede guardar fotografías puntuales en las transiciones relevantes. La serie completa permanece en InfluxDB y puede consultarse para reconstruir su evolución. Esta telemetría continua no debe confundirse con el historial productivo contextualizado que LATEX persiste en PostgreSQL.

## 6. Sector Laboratorio

### 6.1 Operación general

Cuando Fabricación termina un lote, el tanque queda pendiente de análisis. Laboratorio toma una muestra de la pintura y verifica si cumple con las especificaciones aplicables.

Todavía no se dispone de un relevamiento definitivo de todos los ensayos, parámetros, instrumentos y límites utilizados por Laboratorio. LATEX debe permitir que esta parte evolucione cuando esa información sea confirmada, sin inventar controles que no estén documentados.

### 6.2 Decisiones posibles

Laboratorio puede emitir tres decisiones generales:

- `APROBADO`: el producto cumple y queda disponible para Envasado.
- `AJUSTE`: el producto necesita una corrección y vuelve a Fabricación.
- `RECHAZADO`: el lote no puede continuar por el flujo normal.

El ciclo de análisis y ajuste puede repetirse:

```text
FABRICANDO
    ↓
LABORATORIO
    ↓
  AJUSTE
    ↓
LABORATORIO
    ↓
 APROBADO
```

Cada iteración debe quedar asociada al mismo lote. No debe perderse el primer resultado cuando exista un segundo o tercer análisis.

### 6.3 Información e indicadores futuros

Registrar las iteraciones permitirá calcular en el futuro:

- Lotes aprobados en el primer análisis.
- Lotes que necesitaron un ajuste.
- Lotes que necesitaron múltiples ajustes.
- Porcentaje de aprobación inicial.
- Tiempo total empleado en ajustes.
- Tiempo de espera antes de la atención de Laboratorio.
- Tiempo promedio de análisis.

## 7. Sector Envasado

### 7.1 Disponibilidad del tanque

Una vez aprobado por Laboratorio, el tanque queda disponible para Envasado. El sector decide cuándo procesarlo de acuerdo con la organización y disponibilidad de las líneas.

Los formatos de envase informados para la operación real son:

- 1 litro.
- 4 litros.
- 20 litros.

Estos formatos deben validarse contra la configuración vigente de LATEX antes de una puesta en producción o actualización de datos maestros.

Antes de iniciar el envasado se debe asociar, como mínimo:

- Orden de envasado.
- Tanque y producto.
- Línea.
- Formato.
- Hora de inicio.
- Responsables.

LATEX debe mostrar con claridad los tanques aprobados y cuánto tiempo llevan esperando:

```text
TK104
Producto: Látex Interior Blanco
Estado: APROBADO
Peso: 17.945 kg
Aprobado hace: 34 minutos
```

## 8. Línea automática de envasado

El llenado se realiza mediante una máquina automática fabricada por DeVree. La máquina toma la pintura proveniente del tanque y llena los envases. Luego, los envases avanzan por una cinta transportadora hacia el paletizado y el envoltorio final.

```text
Tanque
   ↓
Envasadora DeVree
   ↓
Cinta transportadora
   ↓
Robot paletizador
   ↓
Stretchadora
   ↓
Pallet terminado
   ↓
Stock / despacho / camión
```

El robot ordena los envases sobre el pallet. La stretchadora envuelve el pallet con film y lo deja listo para su movimiento posterior.

En la etapa inicial, LATEX puede representar toda esta cadena como una única etapa denominada `ENVASADO`. La subdivisión en llenado, transporte, paletizado y stretch sólo debería incorporarse si aporta trazabilidad o indicadores útiles y si existen señales confiables para hacerlo.

## 9. Posible integración futura con DeVree

LATEX no debe controlar directamente la envasadora. Una integración futura podría leer información de la línea, siempre que la interfaz y los datos disponibles sean confirmados con el fabricante o con Automatización.

Datos potencialmente útiles:

- Máquina en marcha o detenida.
- Cantidad de envases.
- Velocidad de producción.
- Formato activo.
- Cantidad producida.
- Alarmas.
- Motivo y duración de paradas.

Ejemplo conceptual futuro:

```text
OF: 00458921
Formato: 4 L
Cantidad planificada: 4.400 envases
Cantidad actual: 3.125 envases
Avance: 71 %
Velocidad: 28 envases/min
```

El ejemplo ilustra la información deseada; no afirma que la DeVree exponga actualmente esos datos ni presupone un protocolo de comunicación.

## 10. Rol del sistema LATEX

La separación conceptual de responsabilidades es:

```text
PLC / SCADA / BALANZAS / DEVREE / ROBOT
                    ↓
          NODE-RED / INTEGRACIONES
                    ↓
                  LATEX
                    ↓
 TRAZABILIDAD / COORDINACIÓN / INDICADORES / GESTIÓN
```

- **PLC, SCADA y automatismos:** controlan el proceso físico.
- **Node-RED e integraciones:** adquieren, normalizan y transportan señales y eventos.
- **LATEX:** relaciona los datos con el contexto productivo, conserva la historia y facilita la coordinación y el análisis.

LATEX debe ayudar a responder:

- ¿Qué producto hay actualmente en cada tanque?
- ¿Qué orden de fabricación corresponde?
- ¿Desde qué hora está en ese estado?
- ¿Qué sector debe actuar?
- ¿Cuánto tiempo lleva esperando?
- ¿Cuántas veces necesitó un ajuste?
- ¿Cuándo fue aprobado?
- ¿Cuándo empezó y terminó el envasado?
- ¿Qué línea y formato se utilizaron?
- ¿Cuánto producto se envasó?
- ¿Cuál fue la merma o el remanente?
- ¿Cuánto duró el ciclo completo?
- ¿Dónde se produjeron demoras?

## 11. Flujo de estados de los tanques

El flujo principal esperado es:

```text
VACÍO → FABRICANDO → LABORATORIO → APROBADO → ENVASANDO → VACÍO
```

Los caminos alternativos son:

```text
LABORATORIO → AJUSTE → LABORATORIO

LABORATORIO → RECHAZADO → VACÍO

VACÍO ↔ FUERA DE SERVICIO
```

Cada transición debe registrar como mínimo el tanque, lote, estado anterior, estado nuevo, fecha, hora y responsable. Cuando corresponda, también debe conservar motivo, observación y peso asociado.

El estado en LATEX representa la situación productiva registrada. El PLC y el SCADA continúan siendo la autoridad sobre la condición física y segura de los equipos.

## 12. Coordinación entre sectores

El cambio de estado debe ayudar a que el sector siguiente sepa que tiene una acción pendiente.

Ejemplos:

- Fabricación informa que un tanque está listo para Laboratorio.
- Laboratorio informa que el lote fue aprobado o que requiere ajuste.
- Envasado informa que terminó y que el tanque quedó disponible.

Una notificación visible no necesariamente significa que el trabajo fue recibido o terminado. Como evolución, LATEX debería distinguir entre aviso, recepción, atención y resolución, conservando quién se responsabilizó y cuánto demoró cada etapa.

Esta coordinación debe complementar, no reemplazar, las prácticas seguras de comunicación de la planta.

## 13. Trazabilidad por orden de fabricación

Uno de los objetivos principales es reconstruir la historia completa de una orden sin depender de la memoria de los operadores ni de la pantalla actual del SCADA.

Ejemplo ilustrativo:

```text
OF: 00458921
Producto: Látex Interior Blanco
Tanque: TK104

Fabricación
Inicio: 07:42
Fin: 10:18

Laboratorio
Ingreso: 10:18
Resultado: AJUSTE

Ajuste
Inicio: 10:53
Fin: 11:31

Segundo análisis
Inicio: 11:31
Resultado: APROBADO
Hora de aprobación: 11:43

Envasado
Inicio: 12:38
Fin: 15:12
Formato: 4 L

Peso antes de envasado: 17.945 kg
Peso residual: 185 kg
```

Esta línea temporal debe mantener todas las iteraciones y responsables. Una corrección posterior no debe borrar el valor anterior ni alterar silenciosamente la historia.

## 14. Importancia de los tiempos

LATEX debe medir la permanencia en cada estado para distinguir trabajo efectivo de espera:

- Tiempo de fabricación.
- Tiempo esperando Laboratorio.
- Tiempo de análisis.
- Tiempo de ajuste.
- Tiempo esperando Envasado.
- Tiempo de envasado.
- Tiempo total de ciclo.

Ejemplo:

```text
Fabricación:          2 h 36 min
Espera Laboratorio:     19 min
Laboratorio:             16 min
Ajuste:                  38 min
Segundo análisis:        12 min
Espera Envasado:         55 min
Envasado:             2 h 34 min
Tiempo total:         7 h 30 min
```

Separar estos tiempos permite detectar cuellos de botella. No alcanza con conocer solamente la duración total del lote: es necesario saber en qué sector o espera se consumió el tiempo.

## 15. Pesos, remanentes y merma

Los pesos pueden enriquecer la trazabilidad cuando están asociados a eventos concretos:

```text
Peso al finalizar fabricación: 17.945 kg
Peso al iniciar envasado:       17.760 kg
Peso residual:                     185 kg
```

En una evolución futura, también podrán compararse con los datos confirmados de la envasadora:

```text
Peso descargado desde el tanque: 17.760 kg
Peso teórico envasado:            17.612 kg
Diferencia:                          148 kg
```

Para interpretar una diferencia deben definirse previamente criterios de estabilidad, tolerancias, tara, calidad de señal, momento de las mediciones y tratamiento del producto remanente. Una diferencia calculada no debe etiquetarse automáticamente como pérdida sin esa validación.

Estos datos permitirán desarrollar indicadores de:

- Merma.
- Pérdidas confirmadas.
- Diferencia entre producto fabricado y envasado.
- Remanentes.
- Rendimiento.

## 16. Indicadores futuros

LATEX debe quedar preparado conceptualmente para calcular, cuando existan datos confiables:

- Tiempo promedio de fabricación.
- Tiempo promedio de Laboratorio.
- Tiempo promedio de espera.
- Tiempo promedio de Envasado.
- Tiempo total por orden de fabricación.
- Porcentaje de aprobación en el primer análisis.
- Cantidad de ajustes por producto y receta.
- Merma por lote y producto.
- Productividad de Envasado.
- Unidades producidas.
- Producción por turno.
- Cumplimiento de planificación.
- Utilización de tanques.
- Cuellos de botella.
- Tiempos improductivos.

No todos estos indicadores deben implementarse inmediatamente. Primero se debe asegurar la calidad, procedencia y significado de los datos que los alimentan.

## 17. Hechos actuales y evolución futura

### Hechos actuales confirmados

- La planta fabrica pinturas látex en tanques de proceso.
- Existen nueve tanques principales, TK101 a TK109.
- Fabricación ejecuta recetas mediante SCADA y PLC.
- Los líquidos se cargan automáticamente y determinados sólidos se agregan manualmente.
- Laboratorio decide aprobación, ajuste o rechazo.
- Envasado utiliza una máquina DeVree, cinta, robot paletizador y stretchadora.
- Node-RED envía los pesos de los tanques al backend de LATEX mediante HTTP.
- LATEX actúa como capa superior de estado, trazabilidad, coordinación y gestión.

### Capacidades futuras sujetas a relevamiento

- Recepción automática de eventos de alto nivel desde SCADA.
- Detalle de ensayos e instrumentos de Laboratorio.
- Lectura de estados, contadores, velocidades y alarmas de DeVree.
- Separación detallada de llenado, transporte, paletizado y stretch.
- Cálculo validado de balances, remanentes y mermas.
- Indicadores avanzados de productividad y cuellos de botella.

No se deben asumir protocolos, tags, frecuencias, interfaces ni capacidades de los equipos hasta que Automatización y los responsables del proceso los confirmen.

## 18. Principio de diseño

> LATEX debe evitar duplicar funciones que ya existen correctamente en los sistemas de automatización. Debe integrarse con ellos y consumir los eventos relevantes para la trazabilidad y la gestión.

LATEX no debe convertirse innecesariamente en:

- Un SCADA.
- Un historiador de todas las señales.
- Un sistema de control de PLC.
- Un sistema de seguridad de máquinas.

Debe concentrarse en:

- Trazabilidad.
- Coordinación entre sectores.
- Contextualización de datos.
- Historial y tiempos.
- Responsables.
- Producción y calidad.
- Envasado.
- Indicadores.
- Soporte a decisiones.

Toda propuesta de nueva función debería responder dos preguntas:

1. ¿Esta función ya pertenece correctamente al PLC, SCADA o automatismo de una máquina?
2. ¿Aporta contexto productivo, trazabilidad, coordinación o capacidad de decisión a LATEX?

Si la primera respuesta es afirmativa y la segunda es negativa, la función no debería incorporarse a LATEX.

## 19. Filosofía del proyecto

LATEX busca transformar señales y eventos aislados de la planta en información productiva comprensible:

```text
Proceso físico
      ↓
    Datos
      ↓
   Contexto
      ↓
 Trazabilidad
      ↓
 Indicadores
      ↓
  Decisiones
```

El valor del sistema no está únicamente en visualizar pesos o estados. Su valor está en comprender qué ocurrió con cada lote, cuánto tiempo tardó, quién intervino, dónde existieron esperas, cuántos ajustes fueron necesarios, cómo se envasó y cuál fue el resultado final.

Antes de proponer cambios en LATEX, se debe comprender el proceso industrial que esos cambios pretenden representar. La tecnología es el medio; la trazabilidad clara y útil de la producción es el objetivo.
