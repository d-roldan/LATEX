# Flujo completo para el Node-RED externo de ENVASES

## Qué se importa

El bloque JSON al final de este documento es un **flujo completo importable**. También está disponible, sin texto adicional, en [`infra/node-red/examples/envases-woojin-externo-completo.json`](../infra/node-red/examples/envases-woojin-externo-completo.json). En Node-RED: menú **Import → Clipboard**, pegar el JSON completo y elegir **New flow**. La pestaña, el disparador periódico y las dos ramas InfluxDB llegan deshabilitados.

Se construyó a partir del [flujo que entregaste](../infra/node-red/examples/envases-woojin-flujo-recibido.json). Conserva la lectura manual, la conexión MySQL, el cálculo de cambios de contador, el envío HTTP a LATEX y los diagnósticos. Es una **sustitución** del flujo anterior: deshabilitá la pestaña anterior antes de habilitar ésta para evitar consultas y envíos duplicados. No importes el simulador local al Node-RED externo.

## Datos que toma y destino

Este flujo lee MariaDB. `real_data` no contiene las ocho parejas `Setting`/`Current` de la pantalla **Temperature Data** de CMS Board. Las temperaturas opcionales de `shot_data` y `shot_data_rec` corresponden al último disparo atribuido, no a una medida continua en vivo; ver [origen de temperaturas Woojin](ORIGEN_TEMPERATURAS_WOOJIN.md). El flujo no consulta la API TCP de DBS.

1. La consulta fija lee únicamente las cinco IP conocidas de `disal_cms.real_data` y obtiene el modelo mediante `itgr_machine_list.Machine_IP`. Extrae todos los campos de estado, tiempo de ciclo, tiempo de producción, contadores, promedio, alarma y timestamp de `real_data`. No acepta SQL desde mensajes de entrada.
2. Convierte los `DECIMAL` y los ciclos textuales a números, calcula la edad de la fila **en MariaDB**, conserva la fecha de CMS separada de la hora de recepción Node-RED y compara los contadores sólo entre timestamps diferentes. Un incremento observado no equivale necesariamente a una pieza buena ni a un disparo individual.
3. Busca el último ciclo de **cada apodo único** del catálogo: `shot_data.Machine_Name = itgr_machine_list.Machine_Nickname`. Une la receta de `shot_data_rec` únicamente cuando coinciden `idx = rec_idx`, `TimeStamp` y `Shot_Number`. El Function posterior comprueba otra vez IP, apodo, modelo, unicidad, número y fecha antes de agregar `ultimo_ciclo_tecnico` y los 16 campos de `recipe` a esa máquina. Los ciclos sin identidad comprobada no se agregan.
4. Envía un lote a `POST /api/plants/ENVASES/telemetry/injection-machines` con `source: NODE_RED_ENVASES`. Las cinco lecturas pueden estar obsoletas durante el descanso semanal: se envían con su timestamp real y `cms_row_fresh: false`; no se inventa actividad ni se considera caída de Node-RED sólo por ese motivo. Si falla la consulta de ciclos, el flujo envía los estados actuales sin parámetros técnicos y deja un diagnóstico.
5. Una rama **manual** independiente lee el último par global de `shot_data` y `shot_data_rec` sólo para diagnóstico. No lo envía a LATEX, porque ese registro por sí solo no trae IP. `Additional_Info_1` es el archivo del ciclo histórico, no una prueba del archivo cargado ahora en una máquina.
6. Dos ramas optativas escriben **directamente desde Node-RED a InfluxDB 2** mediante nodos Function → HTTP Request: `woojin_nodered_status` para las filas frescas con IP validada y `woojin_nodered_shot` para el último ciclo cuyo `Machine_Name` identifica inequívocamente una IP. Ambas usan `machine=INY01..INY05` y el timestamp de CMS. Son mediciones *raw* separadas de `woojin_status` y `woojin_shot` que escribe el backend para las gráficas de ApiDisal; activar esta rama no cambia por sí mismo las gráficas de la aplicación.

**Clasificación por IP:** el lote actual ya incluye `machine_ip` y `equipment_code` para cada fila de `real_data`; la API comprueba la IP, el modelo y el código de equipo. El vínculo de los disparos funcionará cuando configures CMS para que cada nuevo `shot_data.Machine_Name` sea **exactamente** el apodo de su inyectora en `itgr_machine_list.Machine_Nickname`:

| IP | `Machine_Name` esperado en nuevos disparos |
| --- | --- |
| `172.16.0.141` | `DL650G5` |
| `172.16.0.146` | `DL450G5` |
| `172.16.0.143` | `TB280G5-1` |
| `172.16.0.144` | `TB280G5-2` |
| `172.16.0.145` | `TB200G5` |

La configuración también puede actualizar `shot_data_rec.Machine_Name`; si ese campo continúa en `-`, la receta sigue vinculándose al disparo por identificador, fecha y número. Los históricos previos con `Machine_Name = '-'` **no se asignan retroactivamente**. Al 17/10/2026 las 145.265 filas de cada tabla de disparos tenían `Machine_Name = '-'`; por eso no habrá parámetros reales por máquina hasta que CMS registre nuevos ciclos con el apodo correcto. No usar coincidencias de hora, contador o archivo como sustituto de la identidad.

## Configuración antes de habilitarlo

1. En el nodo **Woojin CMS · configurar usuario sólo SELECT**, configurar host `10.1.0.105`, puerto `3306`, base `disal_cms` y una cuenta exclusiva de lectura con `SELECT` sobre `real_data`, `itgr_machine_list`, `shot_data` y `shot_data_rec`. Las credenciales no están en el JSON. El nodo requiere `node-red-node-mysql` (el flujo recibido declara `3.0.3`). El flujo no modifica ninguna tabla de CMS; la configuración del nombre en el software Woojin la realizás vos.
2. Definir en el entorno seguro de ese proceso Node-RED `DISAL_API_BASE_URL` con la URL alcanzable del backend **terminada en `/api`**, y `DISAL_ENVASES_INTEGRATION_KEY` con la clave de la integración real `NODE_RED_ENVASES` provisionada en LATEX. No pegar la clave en un Function, Debug, repositorio ni captura. La URL de `localhost` sólo sirve si el backend comparte el mismo espacio de red que Node-RED; normalmente hay que usar una dirección de red alcanzable desde el contenedor externo.
3. El SQL formatea `DATETIME` con el sufijo `-03:00`, coherente con la zona observada en MariaDB durante el relevamiento del 17/10/2026. Antes de activar el envío, comprobar `SELECT NOW(), UTC_TIMESTAMP(), TIMEDIFF(NOW(), UTC_TIMESTAMP());` en esa conexión. Si el offset real no es `-03:00`, ajustar las tres expresiones `DATE_FORMAT` del flujo. El `DATETIME` de CMS no almacena zona horaria por sí mismo.
4. Confirmar que la planta y la integración real están activas en LATEX. Si el backend local mantiene `DISAL_ENABLE_ENVASES_SIMULATOR=true` y recibe simulación, el snapshot prioriza la fuente simulada; desactivar ese modo en el backend donde quieras ver la señal real.
5. Para InfluxDB 2, crear un bucket con retención y token de **escritura solamente** para ese bucket en el entorno seguro de Node-RED. Definir `DISAL_ENVASES_INFLUX_URL` (origen HTTP sin barra final), `DISAL_ENVASES_INFLUX_ORG`, `DISAL_ENVASES_INFLUX_BUCKET`, `DISAL_ENVASES_INFLUX_TOKEN` y `DISAL_ENVASES_INFLUX_WRITE_ENABLED=true`. No pegar el token en el JSON ni en Debug. Se puede usar el mismo bucket que el backend si se desean conservar ambas series, ya que las mediciones tienen nombres distintos. Comprobar acceso de red desde Node-RED a InfluxDB.

## Prueba manual y activación

1. Dejar deshabilitado el Inject **Woojin · automático 5 s**. Deshabilitar el flujo anterior, habilitar esta nueva pestaña y desplegar sólo este flujo.
2. Pulsar **Woojin · consulta manual**. En **Resumen Woojin · lectura actual** verificar cinco IP, modelos, timestamps y `cantidad_filas_sql: 5`. En **ENVASES · diagnóstico API sin clave**, comprobar `statusCode: 201` o `200`, `accepted + ignored = 5`, `rejected = 0`. Las lecturas repetidas pueden contar como `ignored`; eso es esperado. Si una fila no tiene timestamp válido, el normalizador la excluye y el diagnóstico informa el problema.
3. En **Diagnóstico de atribución por IP**, `technical_attached: 0` es esperado mientras CMS siga escribiendo `Machine_Name = '-'`. Después de configurar los nombres y cuando cada máquina produzca un nuevo disparo, repetir la consulta manual: verificar una fila por apodo, el IP esperado y `technical_attached` hasta 5. En la respuesta HTTP, cada ciclo aceptado debe figurar como `technical: UPDATED` o `UNCHANGED`; comparar el número de disparo y el archivo con el panel CMS de esa máquina.
4. Consultar el endpoint de TV de LATEX y confirmar `source: NODE_RED_ENVASES`, `mode: LIVE`, y los cinco equipos. Comparar contadores y estados con HeidiSQL. Durante el fin de semana es normal `cmsFresh: false`; la comunicación Node-RED puede seguir reciente.
5. Pulsar **Consultar último ciclo SIN atribución** para revisar que la rama diagnóstica recupera mediciones, receta y archivo histórico sin publicarlos en ninguna tarjeta.
6. Sólo tras confirmar el lote manual, habilitar el Inject periódico de 5 segundos y desplegar. El flujo evita SQL simultáneo durante la ventana de consulta; el HTTP a LATEX espera 4 segundos y admite hasta dos reintentos con 3 segundos de separación.
7. Para guardar en InfluxDB, configurar las variables anteriores, habilitar los dos nodos Function, los dos HTTP Request, los dos nodos de resultado, Catch, error y Debug de InfluxDB; desplegar y repetir la consulta manual. El diagnóstico debe mostrar `ESCRITO` y `statusCode: 204`; revisar las mediciones `woojin_nodered_status` y, cuando haya disparos atribuidos, `woojin_nodered_shot`. La rama de estado no escribe filas CMS obsoletas. La rama de disparos indica `PENDIENTE_IDENTIFICAR_MAQUINA` si faltan nombres; **nunca atribuye** los históricos `Machine_Name='-'` por archivo o contador. El sondeo del último ciclo cada 5 s puede omitir disparos intermedios o los ocurridos durante una caída: no es una exportación exhaustiva de `shot_data`.

La etiqueta provisional de `Operation_Status` sigue lo que muestra el código de CMS Board: `0=PARO`, `1=AUTO`, `2=SEMI AUTO`, `3/4=MANUAL`; falta contrastar que `real_data.Operation_Status` usa esos mismos códigos en una jornada de operación. Motor y calefacción se interpretan provisionalmente como `0/1`. Los valores numéricos originales se envían igualmente. `Alarm_Status` se envía como código bruto; el flujo no inventa su significado.

## Cuando CMS Board muestra producción y `real_data` está detenida

El 19/10/2026 a las 07:22, CMS Board mostró cinco máquinas en AUTO con cantidades y ciclos, mientras el SELECT del flujo devolvió `cantidad_maquinas_frescas_cms: 0`, estados `0` y `Time_Stamp` del 17/10. La edad de aproximadamente 158–183 mil segundos se calculó con `NOW()` **dentro de MariaDB**: no es un retraso de siete milisegundos en Node-RED ni se corrige modificando el umbral de diez segundos. Los ceros y `PARO` son el **último contenido de la tabla**, no el estado que veía el operador. El normalizador marca ahora `estado_origen: REAL_DATA_DESACTUALIZADA`, muestra `filas_desactualizadas` y pinta su nodo en rojo. La API y el frontend siguen recibiendo el timestamp original y consideran estas lecturas obsoletas; la rama Influx de estados no las almacena.

En la primera exportación de ese diagnóstico, el Function HTTP transmitía también `estado_origen` y `filas_desactualizadas`. La API usa validación estricta y respondió `400` porque esos campos no pertenecen a `InjectionMachineBatchDto`. El Function **ENVASES · preparar envío real** ahora forma un cuerpo explícito sólo con los ocho campos admitidos del lote; el diagnóstico detallado permanece en Debug. El resultado HTTP muestra en `validation` los nombres de propiedades desconocidas sin exponer la clave ni el cuerpo completo. Si se importó la versión anterior, reemplazar ese Function o importar el JSON actualizado. Un `201` posterior indica recepción del lote, **no** que `real_data` haya recuperado la actualización.

El análisis existente de Woojin identifica la ruta inmediata de CMS Board como **API TCP de DBS → memoria de DBA → pantalla**. DBS tiene otra ruta, condicionada por `use_real_data_update` y `use_database_connection`, que intenta actualizar `real_data` por temporizador. La pantalla puede funcionar aunque esa escritura SQL esté desactivada o falle. La captura y el Debug prueban la discrepancia, pero **no identifican aún cuál condición falló**.

Comprobar en HeidiSQL, con la misma conexión `10.1.0.105/disal_cms` que utiliza Node-RED y sin modificar datos:

```sql
SELECT @@hostname AS servidor_sql, DATABASE() AS base_sql, NOW() AS hora_sql,
       r.Machine_IP, m.Machine_Nickname, r.Time_Stamp,
       TIMESTAMPDIFF(SECOND, r.Time_Stamp, NOW()) AS edad_segundos,
       r.Operation_Status, r.Current_Quantity, r.Cycle_Time_Current
FROM disal_cms.real_data AS r
LEFT JOIN disal_cms.itgr_machine_list AS m ON m.Machine_IP = r.Machine_IP
WHERE r.Machine_IP IN ('172.16.0.141','172.16.0.146','172.16.0.143','172.16.0.144','172.16.0.145')
ORDER BY r.Machine_IP;
```

Si HeidiSQL confirma los mismos timestamps antiguos, revisar en la instalación DBS la configuración efectiva de `use_real_data_update`, `use_database_connection`, la conexión SQL, errores de `QSqlQuery::exec`, filas afectadas y si DBA/DBS apuntan a la misma instancia que Node-RED. Ese trabajo corresponde al responsable del CMS; no cambiar esos valores a ciegas. Si HeidiSQL muestra filas recientes en otra instancia, corregir el destino de lectura del nodo MySQL tras comparar servidor, base y catálogo. **No ampliar la frescura a dos días ni reemplazar la tabla por `shot_data`**: ninguna acción haría que el modo AUTO de la captura llegase desde `real_data`. Para tomar el mismo canal de CMS Board hace falta un cliente de lectura de la API DBS validado por separado; el flujo actual no lo implementa.

Para saber si **los ciclos** siguen entrando en la misma MariaDB, usar esta consulta independiente en HeidiSQL:

```sql
SELECT NOW() AS hora_base_datos, idx, TimeStamp, Machine_Name,
       Shot_Number, Additional_Info_1 AS archivo_del_ciclo, Cycle_Time
FROM disal_cms.shot_data
ORDER BY idx DESC
LIMIT 10;
```

Si `TimeStamp` es reciente, la base aún recibe algunos ciclos aunque `real_data` no se actualice. Esos disparos no se pueden asignar por máquina mientras `Machine_Name` siga en `-`. Si también son antiguos, investigar la conexión o las escrituras de DBS en conjunto. En ninguno de los dos casos un `SELECT` distinto sobre `real_data` recuperará el estado vivo de CMS Board.

**Resultado del 19/10/2026 a las 07:37:** `shot_data` devolvió como última fila `idx=145265`, `TimeStamp=2026-10-17 11:21:13`, `Machine_Name='-'`. Era el mismo último índice del relevamiento del 17/10. Junto con las cinco filas inmóviles de `real_data`, esto acota el problema a la **ruta de persistencia SQL o al destino MariaDB que se está consultando**, no a una cláusula incorrecta del SELECT de Node-RED. El INI local analizado tenía `use_database_connection=1` y `use_real_data_update=1`, pero no demuestra cuáles son los valores efectivos ni a qué host apunta la instalación que hoy muestra CMS Board. Comparar la configuración vigente de DBS y sus errores SQL con `10.1.0.105/disal_cms` antes de modificar el flujo. La pantalla CMS Board puede seguir mostrando el estado de DBS por su API aunque MariaDB permanezca congelada.

## JSON listo para Import → Clipboard

Copiar **sólo** el bloque JSON siguiente, desde `[` hasta `]`.

```json
[
  {
    "id": "envases_woojin_live_v2",
    "type": "tab",
    "label": "ENVASES · Woojin real v2",
    "disabled": true,
    "info": "Importar deshabilitado. Configurar MySQL y API; probar manualmente. Las dos ramas InfluxDB permanecen deshabilitadas hasta configurar su bucket y token."
  },
  {
    "id": "w5_comment_externo_v2",
    "type": "comment",
    "z": "envases_woojin_live_v2",
    "name": "LEER ANTES: configurar y probar manual; auto deshabilitado",
    "info": "Este flujo sustituye al anterior, no debe ejecutarse en paralelo. Configurar MySQL sólo SELECT, API LATEX y, por separado, las variables DISAL_ENVASES_INFLUX_*. Los nodos InfluxDB llegan DESHABILITADOS. Estados de real_data: IP verificada. Disparos: sólo si Machine_Name coincide de forma única con itgr_machine_list.Machine_Nickname; los históricos con - siguen SIN INYECTORA IDENTIFICADA y NO se escriben por máquina. Probar Manual, luego habilitar auto 5 s y finalmente cada rama InfluxDB. No escribe en Woojin.",
    "x": 370,
    "y": 60,
    "wires": []
  },
  {
    "id": "w5_manual_externo_v2",
    "type": "inject",
    "z": "envases_woojin_live_v2",
    "name": "Woojin · consulta manual",
    "props": [
      {
        "p": "payload"
      },
      {
        "p": "topic",
        "vt": "str"
      }
    ],
    "repeat": "",
    "crontab": "",
    "once": false,
    "onceDelay": 0.1,
    "topic": "",
    "payload": "",
    "payloadType": "date",
    "x": 85,
    "y": 140,
    "wires": [
      [
        "w5_sql_externo_v2"
      ]
    ],
    "l": false
  },
  {
    "id": "w5_auto_5s_externo_v2",
    "type": "inject",
    "z": "envases_woojin_live_v2",
    "d": true,
    "name": "Woojin · automático 5 s (habilitar tras prueba)",
    "props": [
      {
        "p": "payload"
      },
      {
        "p": "topic",
        "vt": "str"
      }
    ],
    "repeat": "5",
    "crontab": "",
    "once": false,
    "onceDelay": 0.1,
    "topic": "",
    "payload": "",
    "payloadType": "date",
    "x": 210,
    "y": 205,
    "wires": [
      [
        "w5_sql_externo_v2"
      ]
    ]
  },
  {
    "id": "w5_sql_externo_v2",
    "type": "function",
    "z": "envases_woojin_live_v2",
    "name": "Woojin · SQL actual y modelo por IP",
    "func": "// Consulta fija: ninguna entrada puede cambiar el SQL.\nconst ahora = Date.now();\nif (Number(flow.get('envases_sql_busy_until') || 0) > ahora) {\n    node.status({fill:'yellow',shape:'ring',text:'SQL anterior pendiente'});\n    return null;\n}\nflow.set('envases_sql_busy_until', ahora + 30000);\nmsg.woojin_inicio_ms = ahora;\nmsg.topic = [\n    'SELECT r.Machine_IP, r.Machine_Name, m.Machine_Nickname AS Modelo,',\n    \"DATE_FORMAT(r.Time_Stamp, '%Y-%m-%dT%H:%i:%s-03:00') AS cms_timestamp_iso,\",\n    'r.Motor_Status, r.Heater_Status, r.Operation_Status,',\n    'r.Cycle_Time_Before, r.Cycle_Time_Current,',\n    'r.Production_Time_Hour, r.Production_Time_Min,',\n    'r.Total_Quantity, r.Current_Quantity, r.Avg_Quantity_Per_Hour,',\n    'r.Alarm_Status,',\n    'TIMESTAMPDIFF(SECOND, r.Time_Stamp, NOW()) AS cms_age_seconds',\n    'FROM disal_cms.real_data AS r',\n    'LEFT JOIN disal_cms.itgr_machine_list AS m ON m.Machine_IP = r.Machine_IP',\n    \"WHERE r.Machine_IP IN ('172.16.0.141','172.16.0.143','172.16.0.144','172.16.0.145','172.16.0.146')\",\n    'ORDER BY m.idx LIMIT 5'\n].join('\\n');\nmsg.payload = [];\nnode.status({fill:'blue',shape:'dot',text:'SELECT Woojin en curso'});\nreturn msg;",
    "outputs": 1,
    "timeout": 0,
    "noerr": 0,
    "initialize": "",
    "finalize": "",
    "libs": [],
    "x": 250,
    "y": 140,
    "wires": [
      [
        "w5_mysql_externo_v2"
      ]
    ]
  },
  {
    "id": "w5_mysql_externo_v2",
    "type": "mysql",
    "z": "envases_woojin_live_v2",
    "mydb": "woojin_database_externo_v2",
    "name": "Woojin CMS · sólo SELECT (configurar acceso)",
    "x": 560,
    "y": 140,
    "wires": [
      [
        "w5_normalize_externo_v2"
      ]
    ]
  },
  {
    "id": "w5_normalize_externo_v2",
    "type": "function",
    "z": "envases_woojin_live_v2",
    "name": "Woojin · normalizar último estado SQL",
    "func": "if (!Array.isArray(msg.payload)) {\n    flow.set('envases_sql_busy_until', 0);\n    node.status({fill:'red',shape:'ring',text:'Resultado SQL inválido'});\n    return [null, null, {payload:{status:'SQL_INVALIDO'}}];\n}\nconst catalogo = {\n    '172.16.0.141':'INY05', '172.16.0.146':'INY04',\n    '172.16.0.143':'INY03', '172.16.0.144':'INY02', '172.16.0.145':'INY01'\n};\nconst ahora = Date.now();\nconst historial = context.get('envases_contadores') || {};\nconst siguiente = {...historial};\nconst maquinas = [];\nconst eventos = [];\nconst problemas = [];\nconst vistos = new Set();\nfunction numero(value) {\n    if (value === null || value === undefined || value === '') return null;\n    const parsed = Number(typeof value === 'string' ? value.replace(',', '.') : value);\n    return Number.isFinite(parsed) ? parsed : null;\n}\nfunction estado(value, nombres) { return Object.prototype.hasOwnProperty.call(nombres, value) ? nombres[value] : 'NO_VALIDADO'; }\nfor (const fila of msg.payload) {\n    const ip = String(fila && fila.Machine_IP || '');\n    if (!catalogo[ip] || vistos.has(ip)) {\n        problemas.push({tipo:'IP_DESCONOCIDA_O_REPETIDA', machine_ip:ip});\n        continue;\n    }\n    vistos.add(ip);\n    const marca = fila.cms_timestamp_iso;\n    if (typeof marca !== 'string' || !Number.isFinite(Date.parse(marca))) {\n        problemas.push({tipo:'TIMESTAMP_INVALIDO', machine_ip:ip});\n        continue;\n    }\n    const edad = numero(fila.cms_age_seconds);\n    const fresca = edad !== null && edad >= 0 && edad <= 10;\n    const actual = numero(fila.Current_Quantity);\n    const previo = historial[ip];\n    let delta = null;\n    let cambio = fresca ? 'LINEA_BASE_INICIAL' : 'SIN_EVALUAR_POR_FRESCURA';\n    let ultimo = previo && previo.ultimo_incremento_ms || null;\n    if (fresca && actual === null) cambio = 'CONTADOR_INVALIDO';\n    else if (fresca && previo && typeof previo.contador === 'number' && previo.cms_timestamp !== marca) {\n        delta = actual - previo.contador;\n        if (delta > 0) {\n            cambio = 'INCREMENTO_DETECTADO';\n            ultimo = ahora;\n            eventos.push({payload:{evento:cambio,machine_ip:ip,delta,observado_en:new Date(ahora).toISOString()}});\n        } else if (delta < 0) {\n            cambio = 'REINICIO_O_RETROCESO_CONTADOR';\n            ultimo = null;\n            eventos.push({payload:{evento:cambio,machine_ip:ip,contador_actual:actual}});\n        } else cambio = 'SIN_INCREMENTO_EN_ESTA_LECTURA';\n    } else if (fresca && previo) cambio = 'SIN_CAMBIO';\n    if (fresca && actual !== null) siguiente[ip] = {contador:actual,cms_timestamp:marca,ultimo_incremento_ms:ultimo};\n    const op = numero(fila.Operation_Status);\n    const motor = numero(fila.Motor_Status);\n    const heater = numero(fila.Heater_Status);\n    const ciclo = numero(fila.Cycle_Time_Current);\n    const actividadReciente = ultimo && ahora - ultimo <= Math.max(90000, (ciclo || 0) * 3000);\n    maquinas.push({\n        machine_ip:ip, equipment_code:catalogo[ip],\n        modelo:typeof fila.Modelo === 'string' && fila.Modelo.trim() ? fila.Modelo.trim() : null,\n        machine_name_cms:fila.Machine_Name || null,\n        cms_timestamp:marca, cms_age_seconds:edad !== null && edad >= 0 ? edad : null,\n        cms_row_fresh:fresca, adquisicion_industrial_fresca:'NO_VERIFICADA',\n        operation_status_code:op, operation_status_text:estado(op,{0:'PARO',1:'AUTO',2:'SEMI AUTO',3:'MANUAL',4:'MANUAL'}),\n        motor_status_code:motor, motor_status_text:estado(motor,{0:'STOP',1:'RUN'}),\n        heater_status_code:heater, heater_status_text:estado(heater,{0:'OFF',1:'ON'}),\n        alarm_status_code:numero(fila.Alarm_Status),\n        cycle_time_before:numero(fila.Cycle_Time_Before), cycle_time_current:ciclo,\n        production_time_hour:numero(fila.Production_Time_Hour), production_time_min:numero(fila.Production_Time_Min),\n        total_quantity:numero(fila.Total_Quantity), current_quantity:actual,\n        avg_quantity_per_hour:numero(fila.Avg_Quantity_Per_Hour),\n        delta_contador_observado:delta, tipo_cambio_contador:cambio,\n        actividad_inferida:!fresca ? 'DATOS_CMS_DESACTUALIZADOS' : actividadReciente ? 'INCREMENTO_RECIENTE' : 'SIN_INCREMENTO_RECIENTE',\n        ultimo_incremento_detectado:ultimo ? new Date(ultimo).toISOString() : null\n    });\n}\nfor (const ip of Object.keys(catalogo)) if (!vistos.has(ip)) problemas.push({tipo:'SIN_FILA_SQL',machine_ip:ip});\ncontext.set('envases_contadores', siguiente);\nconst frescas = maquinas.filter(item => item.cms_row_fresh).length;\nconst origenDesactualizado = maquinas.length > 0 && frescas === 0;\nnode.status({fill:origenDesactualizado ? 'red' : maquinas.length === 5 ? 'green' : 'yellow',shape:origenDesactualizado ? 'ring' : 'dot',text:origenDesactualizado ? 'REAL_DATA SIN ACTUALIZAR: 0/' + maquinas.length : maquinas.length + '/5 filas válidas; ' + frescas + ' frescas'});\nconst resumen = {payload:{\n    fecha_recepcion_nodered:new Date(ahora).toISOString(),\n    cantidad_filas_sql:msg.payload.length, cantidad_maquinas_frescas_cms:frescas,\n    duracion_consulta_ms:typeof msg.woojin_inicio_ms === 'number' ? ahora - msg.woojin_inicio_ms : null,\n    estado_origen:origenDesactualizado ? 'REAL_DATA_DESACTUALIZADA' : frescas < maquinas.length ? 'REAL_DATA_PARCIALMENTE_DESACTUALIZADA' : 'REAL_DATA_RECIENTE',\n    aviso:origenDesactualizado ? 'Las filas SQL son antiguas: PARO y ceros son últimos valores almacenados, NO el estado actual. CMS Board usa la API de DBS. Revisar actualización DBS a real_data y conexión a MariaDB.' : 'Frescura SQL no confirma señal Modbus ni producción. Ciclos históricos sin IP no se asignan.',\n    filas_desactualizadas:maquinas.filter(item => !item.cms_row_fresh).map(item => ({machine_ip:item.machine_ip,modelo:item.modelo,ultimo_timestamp:item.cms_timestamp,edad_segundos:item.cms_age_seconds})),\n    maquinas\n}};\nreturn [resumen, eventos.length ? eventos : null, problemas.length ? {payload:{problemas}} : null];",
    "outputs": 3,
    "timeout": 0,
    "noerr": 0,
    "initialize": "",
    "finalize": "",
    "libs": [],
    "x": 890,
    "y": 140,
    "wires": [
      [
        "w5_debug_summary_externo_v2",
        "envases_technical_sql_v3",
        "envases_influx_status_prepare_v1"
      ],
      [
        "w5_debug_delta_externo_v2"
      ],
      [
        "w5_debug_influx_externo_v2"
      ]
    ]
  },
  {
    "id": "w5_debug_summary_externo_v2",
    "type": "debug",
    "z": "envases_woojin_live_v2",
    "name": "Resumen Woojin · último estado SQL",
    "active": true,
    "tosidebar": true,
    "console": false,
    "tostatus": false,
    "complete": "payload",
    "targetType": "msg",
    "statusVal": "",
    "statusType": "auto",
    "x": 1160,
    "y": 100,
    "wires": []
  },
  {
    "id": "w5_debug_delta_externo_v2",
    "type": "debug",
    "z": "envases_woojin_live_v2",
    "name": "EVENTOS contador (incrementos/reinicios)",
    "active": false,
    "tosidebar": true,
    "console": false,
    "tostatus": false,
    "complete": "payload",
    "targetType": "msg",
    "statusVal": "",
    "statusType": "auto",
    "x": 1230,
    "y": 140,
    "wires": []
  },
  {
    "id": "w5_debug_influx_externo_v2",
    "type": "debug",
    "z": "envases_woojin_live_v2",
    "name": "Diagnóstico de filas SQL (sin InfluxDB)",
    "active": true,
    "tosidebar": true,
    "console": false,
    "tostatus": false,
    "complete": "payload",
    "targetType": "msg",
    "statusVal": "",
    "statusType": "auto",
    "x": 1210,
    "y": 180,
    "wires": []
  },
  {
    "id": "envases-disal-prepare_externo_v2",
    "type": "function",
    "z": "envases_woojin_live_v2",
    "name": "ENVASES · preparar envío real",
    "func": "if (Number(flow.get('envases_http_busy_until') || 0) > Date.now())\n    return [null,{payload:{status:'ENVIO_OCUPADO'}}];\nconst base = env.get('DISAL_API_BASE_URL');\nconst key = env.get('DISAL_ENVASES_INTEGRATION_KEY');\nif (!base || !key) return [null,{payload:{status:'CONFIG_ERROR',message:'Falta URL de API o clave de integración'}}];\nif (!msg.payload || !Array.isArray(msg.payload.maquinas) || !msg.payload.maquinas.length)\n    return [null,{payload:{status:'SIN_LECTURAS_VALIDAS'}}];\nflow.set('envases_http_busy_until', Date.now() + 25000);\nmsg.method = 'POST';\nmsg.url = String(base).replace(/\\/+$/, '') + '/plants/ENVASES/telemetry/injection-machines';\nmsg.headers = {'content-type':'application/json','x-node-red-key':key};\n// El resumen Debug contiene campos operativos que el DTO estricto de la API no admite.\n// Construir explícitamente el contrato HTTP para no filtrarlos por accidente.\nmsg.payload = {\n    source:'NODE_RED_ENVASES',schemaVersion:1,\n    fecha_recepcion_nodered:msg.payload.fecha_recepcion_nodered,\n    cantidad_filas_sql:msg.payload.cantidad_filas_sql,\n    cantidad_maquinas_frescas_cms:msg.payload.cantidad_maquinas_frescas_cms,\n    duracion_consulta_ms:msg.payload.duracion_consulta_ms,\n    aviso:msg.payload.aviso,\n    maquinas:msg.payload.maquinas\n};\nmsg.envasesBody = msg.payload;\nmsg.envasesAttempt = 0;\nmsg.envasesMachineCount = msg.payload.maquinas.length;\nreturn [msg,null];",
    "outputs": 2,
    "timeout": 0,
    "noerr": 0,
    "initialize": "",
    "finalize": "",
    "libs": [],
    "x": 430,
    "y": 380,
    "wires": [
      [
        "envases-disal-http_externo_v2"
      ],
      [
        "envases-disal-debug_externo_v2"
      ]
    ]
  },
  {
    "id": "envases-disal-http_externo_v2",
    "type": "http request",
    "z": "envases_woojin_live_v2",
    "name": "ENVASES · POST API LATEX",
    "method": "use",
    "ret": "obj",
    "paytoqs": "ignore",
    "url": "",
    "tls": "",
    "persist": false,
    "proxy": "",
    "insecureHTTPParser": false,
    "authType": "",
    "senderr": false,
    "headers": [],
    "x": 810,
    "y": 380,
    "wires": [
      [
        "envases-disal-result_externo_v2"
      ]
    ],
    "timeout": "4000"
  },
  {
    "id": "envases-disal-result_externo_v2",
    "type": "function",
    "z": "envases_woojin_live_v2",
    "name": "ENVASES · resultado y reintento",
    "func": "const statusCode = Number(msg.statusCode || 0);\nconst attempt = Number(msg.envasesAttempt || 0);\nconst retry = statusCode === 0 || statusCode === 429 || statusCode >= 500;\nif (retry && attempt < 2) {\n    msg.envasesAttempt = attempt + 1;\n    msg.payload = msg.envasesBody;\n    msg.headers = {'content-type':'application/json','x-node-red-key':env.get('DISAL_ENVASES_INTEGRATION_KEY')};\n    return [msg,null];\n}\nflow.set('envases_http_busy_until',0);\nconst messages = msg.payload && msg.payload.message;\nconst validation = (Array.isArray(messages) ? messages : [messages])\n    .filter(value => typeof value === 'string' && /^property [a-zA-Z0-9_]+ should not exist$/.test(value))\n    .slice(0,5);\nreturn [null,{payload:{statusCode,attempts:attempt + 1,sent:msg.envasesMachineCount,\n    accepted:msg.payload && msg.payload.accepted,rejected:msg.payload && msg.payload.rejected,\n    ignored:msg.payload && msg.payload.ignored,\n    results:msg.payload && msg.payload.results || null,\n    validation,\n    error:statusCode >= 400 ? 'API rechazo el lote; revisar respuesta sin publicar secretos' : null}}];",
    "outputs": 2,
    "timeout": 0,
    "noerr": 0,
    "initialize": "",
    "finalize": "",
    "libs": [],
    "x": 1120,
    "y": 380,
    "wires": [
      [
        "envases-disal-delay_externo_v2"
      ],
      [
        "envases-disal-debug_externo_v2"
      ]
    ]
  },
  {
    "id": "envases-disal-delay_externo_v2",
    "type": "delay",
    "z": "envases_woojin_live_v2",
    "name": "ENVASES · reintento en 3 s",
    "pauseType": "delay",
    "timeout": "3",
    "timeoutUnits": "seconds",
    "rate": "1",
    "nbRateUnits": "1",
    "rateUnits": "second",
    "randomFirst": "1",
    "randomLast": "5",
    "randomUnits": "seconds",
    "drop": false,
    "allowrate": false,
    "outputs": 1,
    "x": 830,
    "y": 450,
    "wires": [
      [
        "envases-disal-http_externo_v2"
      ]
    ]
  },
  {
    "id": "envases-disal-catch_externo_v2",
    "type": "catch",
    "z": "envases_woojin_live_v2",
    "name": "ENVASES · capturar error HTTP",
    "scope": [
      "envases-disal-http_externo_v2"
    ],
    "uncaught": false,
    "x": 450,
    "y": 500,
    "wires": [
      [
        "envases-disal-error_externo_v2"
      ]
    ]
  },
  {
    "id": "envases-disal-error_externo_v2",
    "type": "function",
    "z": "envases_woojin_live_v2",
    "name": "ENVASES · error sin secretos",
    "func": "const attempt = Number(msg.envasesAttempt || 0);\nif (attempt < 2 && msg.envasesBody) {\n    msg.envasesAttempt = attempt + 1;\n    msg.payload = msg.envasesBody;\n    msg.headers = {'content-type':'application/json','x-node-red-key':env.get('DISAL_ENVASES_INTEGRATION_KEY')};\n    return [msg,null];\n}\nflow.set('envases_http_busy_until',0);\nreturn [null,{payload:{status:'HTTP_ERROR',attempts:attempt + 1,sent:msg.envasesMachineCount,\n    message:String(msg.error && msg.error.message || 'Error de red').slice(0,180)}}];",
    "outputs": 2,
    "timeout": 0,
    "noerr": 0,
    "initialize": "",
    "finalize": "",
    "libs": [],
    "x": 750,
    "y": 500,
    "wires": [
      [
        "envases-disal-delay_externo_v2"
      ],
      [
        "envases-disal-debug_externo_v2"
      ]
    ]
  },
  {
    "id": "envases-disal-debug_externo_v2",
    "type": "debug",
    "z": "envases_woojin_live_v2",
    "name": "ENVASES · diagnóstico API sin clave",
    "active": true,
    "tosidebar": true,
    "console": false,
    "tostatus": false,
    "complete": "payload",
    "targetType": "msg",
    "statusVal": "",
    "statusType": "auto",
    "x": 1110,
    "y": 510,
    "wires": []
  },
  {
    "id": "woojin_database_externo_v2",
    "type": "MySQLdatabase",
    "name": "Woojin CMS · configurar usuario sólo SELECT",
    "host": "10.1.0.105",
    "port": "3306",
    "db": "disal_cms",
    "tz": "",
    "charset": "UTF8"
  },
  {
    "id": "envases_technical_sql_v3",
    "type": "function",
    "z": "envases_woojin_live_v2",
    "name": "Woojin · último ciclo por apodo único",
    "func": "if (!msg.payload || !Array.isArray(msg.payload.maquinas)) {\n    flow.set('envases_sql_busy_until',0);\n    return null;\n}\nmsg.envasesSummary = msg.payload;\n// Sólo nombres exactos y únicos del catálogo. Los históricos con '-' no coinciden.\nmsg.topic = [\n    'SELECT m.Machine_IP AS source_ip, m.Machine_Nickname AS source_model,',\n    's.Machine_Name AS source_machine_name, s.idx AS shot_idx, p.rec_idx AS recipe_idx,',\n    \"DATE_FORMAT(s.TimeStamp, '%Y-%m-%dT%H:%i:%s-03:00') AS shot_timestamp_iso,\",\n    's.Shot_Number, s.Additional_Info_1 AS archivo_historico, s.Cavity, s.NGmark,',\n    's.Cycle_Time, s.Injection_Time, s.Filling_Time, s.Max_Injection_Pressure,',\n    's.Max_Injection_Speed, s.Switch_Over_Position, s.Max_Switch_Over_Pressure,',\n    's.Cushion_Position, s.Plasticizing_Time, s.Plasticizing_Position,',\n    's.Average_Screw_RPM, s.Max_Screw_RPM, s.Average_Back_Pressure, s.Max_Back_Pressure,',\n    's.Clamp_Close_Time, s.Clamp_open_time, s.Clamp_Open_Position, s.Resin_weight,',\n    's.Barrel_Temperature_1, s.Barrel_Temperature_2, s.Barrel_Temperature_3,',\n    's.Barrel_Temperature_4, s.Barrel_Temperature_5, s.Barrel_Temperature_6, s.Barrel_Temperature_7,',\n    's.Mold_Temperature_1, s.Mold_Temperature_2, s.Mold_Temperature_3, s.Mold_Temperature_4,',\n    's.Mold_Temperature_5, s.Mold_Temperature_6, s.Mold_Temperature_7, s.Mold_Temperature_8,',\n    's.Mold_Temperature_9, s.Mold_Temperature_10, s.Mold_Temperature_11, s.Mold_Temperature_12,',\n    's.Hopper_Temperature,',\n    'p.Inj_Velocity, p.Inj_Pressure, p.Inj_Position, p.SOV_Time, p.SOV_Position,',\n    'p.Hld_Pressure, p.Hld_Time, p.Hld_Vel, p.Chg_Position, p.Chg_Speed, p.BackPressure,',\n    'p.Suckback_Position, p.Suckback_Speed, p.Barrel_Temperature, p.Mold_Temperature, p.Timer',\n    'FROM disal_cms.itgr_machine_list AS m',\n    'JOIN disal_cms.shot_data AS s ON s.idx = (',\n    ' SELECT MAX(s2.idx) FROM disal_cms.shot_data AS s2',\n    ' WHERE s2.Machine_Name = m.Machine_Nickname)',\n    'JOIN disal_cms.shot_data_rec AS p ON p.rec_idx = s.idx',\n    ' AND p.TimeStamp = s.TimeStamp AND p.Shot_Number = s.Shot_Number',\n    \" AND (p.Machine_Name = s.Machine_Name OR p.Machine_Name IN ('','-') OR p.Machine_Name IS NULL)\",\n    \"WHERE m.Machine_IP IN ('172.16.0.141','172.16.0.143','172.16.0.144','172.16.0.145','172.16.0.146')\",\n    \" AND m.Machine_Nickname <> '' AND m.Machine_Nickname <> '-'\",\n    ' AND (SELECT COUNT(*) FROM disal_cms.itgr_machine_list AS m2',\n    '      WHERE m2.Machine_Nickname = m.Machine_Nickname) = 1'\n].join('\\n');\nmsg.payload = [];\nreturn msg;",
    "outputs": 1,
    "noerr": 0,
    "x": 460,
    "y": 230,
    "wires": [
      [
        "envases_technical_mysql_v3"
      ]
    ]
  },
  {
    "id": "envases_technical_mysql_v3",
    "type": "mysql",
    "z": "envases_woojin_live_v2",
    "mydb": "woojin_database_externo_v2",
    "name": "Woojin CMS · ciclos identificados",
    "x": 780,
    "y": 230,
    "wires": [
      [
        "envases_technical_merge_v3"
      ]
    ]
  },
  {
    "id": "envases_technical_merge_v3",
    "type": "function",
    "z": "envases_woojin_live_v2",
    "name": "Asignar ciclo sólo a IP verificada",
    "func": "flow.set('envases_sql_busy_until',0);\nconst summary = msg.envasesSummary;\nif (!summary || !Array.isArray(summary.maquinas)) return null;\nconst rows = Array.isArray(msg.payload) ? msg.payload : [];\nconst countsIp = {};\nconst countsShot = {};\nfor (const row of rows) {\n    countsIp[row.source_ip] = (countsIp[row.source_ip] || 0) + 1;\n    countsShot[row.shot_idx] = (countsShot[row.shot_idx] || 0) + 1;\n}\nconst reasons = [];\nconst number = (v) => {\n    if (v === null || v === undefined || v === '') return null;\n    const n = Number(v);\n    return Number.isFinite(n) ? n : null;\n};\nconst text = (v) => v === null || v === undefined ? null : String(v);\nfor (const row of rows) {\n    const reading = summary.maquinas.find(item => item.machine_ip === row.source_ip);\n    const shot = number(row.Shot_Number);\n    const stamp = row.shot_timestamp_iso;\n    const cavity = number(row.Cavity);\n    const ngmark = number(row.NGmark);\n    if (!reading || countsIp[row.source_ip] !== 1 || countsShot[row.shot_idx] !== 1 ||\n        row.source_machine_name !== row.source_model || reading.modelo !== row.source_model ||\n        number(row.shot_idx) !== number(row.recipe_idx) ||\n        !Number.isInteger(shot) || shot < 0 ||\n        (cavity !== null && (!Number.isInteger(cavity) || cavity < 0)) ||\n        (ngmark !== null && (!Number.isInteger(ngmark) || ngmark < 0)) ||\n        typeof stamp !== 'string' || !Number.isFinite(Date.parse(stamp)) ||\n        Date.parse(stamp) > Date.now() + 30000) {\n        reasons.push({machine_ip:row.source_ip,reason:'VINCULO_O_CICLO_INVALIDO'});\n        continue;\n    }\n    reading.ultimo_ciclo_tecnico = {\n        machine_ip:row.source_ip, identity_source:'CMS_MACHINE_NAME',\n        shot_number:shot, timestamp:stamp, mold_name:text(row.archivo_historico),\n        cavity, ngmark, cycle_time:number(row.Cycle_Time),\n        injection_time:number(row.Injection_Time), filling_time:number(row.Filling_Time),\n        max_injection_pressure:number(row.Max_Injection_Pressure), max_injection_speed:number(row.Max_Injection_Speed),\n        switch_over_position:number(row.Switch_Over_Position), max_switch_over_pressure:number(row.Max_Switch_Over_Pressure),\n        cushion_position:number(row.Cushion_Position), plasticizing_time:number(row.Plasticizing_Time),\n        plasticizing_position:number(row.Plasticizing_Position), average_screw_rpm:number(row.Average_Screw_RPM),\n        max_screw_rpm:number(row.Max_Screw_RPM), average_back_pressure:number(row.Average_Back_Pressure),\n        max_back_pressure:number(row.Max_Back_Pressure), clamp_close_time:number(row.Clamp_Close_Time),\n        clamp_open_time:number(row.Clamp_open_time), clamp_open_position:number(row.Clamp_Open_Position),\n        resin_weight:number(row.Resin_weight),\n        barrel_temperatures:Array.from({length:7},(_,i)=>number(row['Barrel_Temperature_' + (i+1)])),\n        mold_temperatures:Array.from({length:12},(_,i)=>number(row['Mold_Temperature_' + (i+1)])),\n        hopper_temperature:number(row.Hopper_Temperature),\n        recipe:{\n            inj_velocity:text(row.Inj_Velocity), inj_pressure:text(row.Inj_Pressure), inj_position:text(row.Inj_Position),\n            sov_time:number(row.SOV_Time), sov_position:number(row.SOV_Position),\n            hld_pressure:text(row.Hld_Pressure), hld_time:text(row.Hld_Time), hld_vel:text(row.Hld_Vel),\n            chg_position:text(row.Chg_Position), chg_speed:text(row.Chg_Speed),\n            back_pressure:text(row.BackPressure), suckback_position:text(row.Suckback_Position),\n            suckback_speed:text(row.Suckback_Speed), barrel_temperature:text(row.Barrel_Temperature),\n            mold_temperature:text(row.Mold_Temperature), timer:text(row.Timer)\n        }\n    };\n}\nmsg.payload = summary;\nconst attached = summary.maquinas.filter(item => item.ultimo_ciclo_tecnico).length;\nnode.status({fill:attached ? 'green' : 'yellow',shape:'dot',text:attached + '/5 ciclos con IP verificada'});\nreturn [msg,{payload:{technical_attached:attached,rows:rows.length,rejected:reasons,\n    note:attached ? 'Machine_Name unido de forma unica al catalogo' : 'PENDIENTE_IDENTIFICAR_MAQUINA: CMS aun no entrega Machine_Name util; no escribir disparos por IP'}}];",
    "outputs": 2,
    "noerr": 0,
    "x": 1090,
    "y": 230,
    "wires": [
      [
        "envases-disal-prepare_externo_v2",
        "envases_influx_shot_prepare_v1"
      ],
      [
        "envases_technical_debug_v3"
      ]
    ]
  },
  {
    "id": "envases_technical_debug_v3",
    "type": "debug",
    "z": "envases_woojin_live_v2",
    "name": "Diagnóstico de atribución por IP",
    "active": true,
    "tosidebar": true,
    "console": false,
    "tostatus": false,
    "complete": "payload",
    "targetType": "msg",
    "x": 1400,
    "y": 260,
    "wires": []
  },
  {
    "id": "envases_technical_error_v3",
    "type": "catch",
    "z": "envases_woojin_live_v2",
    "name": "Woojin · error consulta de ciclos",
    "scope": [
      "envases_technical_mysql_v3"
    ],
    "uncaught": false,
    "x": 470,
    "y": 290,
    "wires": [
      [
        "envases_technical_fallback_v3"
      ]
    ]
  },
  {
    "id": "envases_technical_fallback_v3",
    "type": "function",
    "z": "envases_woojin_live_v2",
    "name": "Enviar estados sin ciclos si falla SQL",
    "func": "flow.set('envases_sql_busy_until',0);\nif (!msg.envasesSummary) return [null,{payload:{status:'TECHNICAL_SQL_ERROR',message:'No se pudo recuperar resumen'}}];\nmsg.payload = msg.envasesSummary;\nreturn [msg,{payload:{status:'TECHNICAL_SQL_ERROR',message:String(msg.error && msg.error.message || 'Error SQL').slice(0,180),technical_attached:0}}];",
    "outputs": 2,
    "noerr": 0,
    "x": 770,
    "y": 290,
    "wires": [
      [
        "envases-disal-prepare_externo_v2"
      ],
      [
        "envases_technical_debug_v3"
      ]
    ]
  },
  {
    "id": "envases_sql_error_v2",
    "type": "catch",
    "z": "envases_woojin_live_v2",
    "name": "Woojin · error SQL",
    "scope": [
      "w5_mysql_externo_v2"
    ],
    "uncaught": false,
    "x": 520,
    "y": 260,
    "wires": [
      [
        "envases_sql_reset_v2"
      ]
    ]
  },
  {
    "id": "envases_sql_reset_v2",
    "type": "function",
    "z": "envases_woojin_live_v2",
    "name": "Woojin · liberar consulta",
    "func": "flow.set('envases_sql_busy_until',0);\nreturn {payload:{status:'SQL_ERROR',message:String(msg.error && msg.error.message || 'Error SQL').slice(0,180)}};",
    "outputs": 1,
    "noerr": 0,
    "x": 790,
    "y": 260,
    "wires": [
      [
        "w5_debug_influx_externo_v2"
      ]
    ]
  },
  {
    "id": "envases_shot_comment_v2",
    "type": "comment",
    "z": "envases_woojin_live_v2",
    "name": "PENDIENTE: identificar inyectora de disparos antiguos",
    "info": "shot_data y shot_data_rec no contienen IP; los registros históricos observados tenían Machine_Name = -. Esta rama consulta un solo par y sólo lo muestra en Debug: no llega a LATEX ni a InfluxDB por máquina. Después de identificar y verificar cada inyectora, configurar CMS para guardar Machine_Name igual al apodo único de itgr_machine_list. No inferir IP por archivo, contador u hora.",
    "x": 370,
    "y": 610,
    "wires": []
  },
  {
    "id": "envases_shot_manual_v2",
    "type": "inject",
    "z": "envases_woojin_live_v2",
    "name": "Consultar último ciclo SIN atribución",
    "props": [
      {
        "p": "payload"
      }
    ],
    "repeat": "",
    "crontab": "",
    "once": false,
    "onceDelay": 0.1,
    "payload": "",
    "payloadType": "date",
    "x": 160,
    "y": 670,
    "wires": [
      [
        "envases_shot_sql_v2"
      ]
    ]
  },
  {
    "id": "envases_shot_sql_v2",
    "type": "function",
    "z": "envases_woojin_live_v2",
    "name": "SQL ciclo y receta sin IP",
    "func": "msg.topic = [\n    'SELECT s.idx, s.Machine_Name, s.Additional_Info_1 AS archivo_historico,',\n    \"DATE_FORMAT(s.TimeStamp, '%Y-%m-%dT%H:%i:%s-03:00') AS shot_timestamp_iso,\",\n    's.Shot_Number, s.Cavity, s.NGmark, s.Cycle_Time, s.Injection_Time, s.Filling_Time,',\n    's.Max_Injection_Pressure, s.Max_Injection_Speed, s.Switch_Over_Position,',\n    's.Max_Switch_Over_Pressure, s.Cushion_Position, s.Plasticizing_Time, s.Plasticizing_Position,',\n    's.Average_Screw_RPM, s.Max_Screw_RPM, s.Average_Back_Pressure, s.Max_Back_Pressure,',\n    's.Clamp_Close_Time, s.Clamp_open_time, s.Clamp_Open_Position, s.Resin_weight,',\n    's.Barrel_Temperature_1, s.Barrel_Temperature_2, s.Barrel_Temperature_3,',\n    's.Barrel_Temperature_4, s.Barrel_Temperature_5, s.Barrel_Temperature_6, s.Barrel_Temperature_7,',\n    's.Mold_Temperature_1, s.Mold_Temperature_2, s.Mold_Temperature_3, s.Mold_Temperature_4,',\n    's.Mold_Temperature_5, s.Mold_Temperature_6, s.Mold_Temperature_7, s.Mold_Temperature_8,',\n    's.Mold_Temperature_9, s.Mold_Temperature_10, s.Mold_Temperature_11, s.Mold_Temperature_12,',\n    's.Hopper_Temperature,',\n    'p.Inj_Velocity, p.Inj_Pressure, p.Inj_Position, p.SOV_Time, p.SOV_Position,',\n    'p.Hld_Pressure, p.Hld_Time, p.Hld_Vel, p.Chg_Position, p.Chg_Speed, p.BackPressure,',\n    'p.Suckback_Position, p.Suckback_Speed, p.Barrel_Temperature, p.Mold_Temperature, p.Timer',\n    'FROM disal_cms.shot_data AS s',\n    'LEFT JOIN disal_cms.shot_data_rec AS p ON p.rec_idx = s.idx',\n    'AND p.TimeStamp = s.TimeStamp AND p.Shot_Number = s.Shot_Number',\n    'ORDER BY s.idx DESC LIMIT 1'\n].join('\\n');\nmsg.payload = [];\nreturn msg;",
    "outputs": 1,
    "noerr": 0,
    "x": 420,
    "y": 670,
    "wires": [
      [
        "envases_shot_mysql_v2"
      ]
    ]
  },
  {
    "id": "envases_shot_mysql_v2",
    "type": "mysql",
    "z": "envases_woojin_live_v2",
    "mydb": "woojin_database_externo_v2",
    "name": "Woojin CMS · último ciclo",
    "x": 690,
    "y": 670,
    "wires": [
      [
        "envases_shot_normalize_v2"
      ]
    ]
  },
  {
    "id": "envases_shot_normalize_v2",
    "type": "function",
    "z": "envases_woojin_live_v2",
    "name": "Marcar ciclo SIN IP",
    "func": "const row = Array.isArray(msg.payload) ? msg.payload[0] : null;\nreturn {payload:row ? {atribucion:'NO_VERIFICADA',advertencia:'NO asignar a ninguna inyectora ni mostrar como archivo actual',ciclo:row} : {atribucion:'NO_VERIFICADA',status:'SIN_CICLO'}};",
    "outputs": 1,
    "noerr": 0,
    "x": 930,
    "y": 670,
    "wires": [
      [
        "envases_shot_debug_v2"
      ]
    ]
  },
  {
    "id": "envases_shot_debug_v2",
    "type": "debug",
    "z": "envases_woojin_live_v2",
    "name": "Último ciclo sin IP · sólo diagnóstico",
    "active": true,
    "tosidebar": true,
    "console": false,
    "tostatus": false,
    "complete": "payload",
    "targetType": "msg",
    "x": 1220,
    "y": 670,
    "wires": []
  },
  {
    "id": "envases_influx_comment_v1",
    "type": "comment",
    "z": "envases_woojin_live_v2",
    "name": "InfluxDB optativo · disparos sin identidad quedan pendientes",
    "info": "Configurar DISAL_ENVASES_INFLUX_WRITE_ENABLED=true, DISAL_ENVASES_INFLUX_URL, DISAL_ENVASES_INFLUX_ORG, DISAL_ENVASES_INFLUX_BUCKET y DISAL_ENVASES_INFLUX_TOKEN en el entorno de Node-RED. Habilitar cada rama tras prueba manual. Estados: IP validada y fila fresca. Disparos: sólo Machine_Name que coincide de forma única con Machine_Nickname e IP validada. Los históricos con Machine_Name=- siguen PENDIENTE_IDENTIFICAR_MAQUINA y no se escriben por máquina. Mediciones raw separadas del historial curado de la API. Este sondeo de último disparo no garantiza capturar todos los ciclos.",
    "x": 410,
    "y": 790,
    "wires": []
  },
  {
    "id": "envases_influx_status_prepare_v1",
    "type": "function",
    "z": "envases_woojin_live_v2",
    "name": "Influx · estados por IP validada",
    "d": true,
    "func": "const enabled = String(env.get('DISAL_ENVASES_INFLUX_WRITE_ENABLED') || '').toLowerCase() === 'true';\nconst base = String(env.get('DISAL_ENVASES_INFLUX_URL') || '').replace(/\\/$/, '');\nconst org = String(env.get('DISAL_ENVASES_INFLUX_ORG') || '');\nconst bucket = String(env.get('DISAL_ENVASES_INFLUX_BUCKET') || '');\nconst token = String(env.get('DISAL_ENVASES_INFLUX_TOKEN') || '');\nif (!enabled || !/^https?:\\/\\/[^/?#]+$/.test(base) || !org || !bucket || !token) {\n    node.status({fill:'yellow',shape:'ring',text:'Influx desactivado o incompleto'});\n    return [null,{payload:{status:'INFLUX_NO_CONFIGURADO'}}];\n}\nconst url = base + '/api/v2/write?org=' + encodeURIComponent(org) + '&bucket=' + encodeURIComponent(bucket) + '&precision=ms';\nconst catalog = {'172.16.0.141':['INY05','DL650G5'],'172.16.0.146':['INY04','DL450G5'],'172.16.0.143':['INY03','TB280G5-1'],'172.16.0.144':['INY02','TB280G5-2'],'172.16.0.145':['INY01','TB200G5']};\nconst valid = (r) => r && catalog[r.machine_ip] && catalog[r.machine_ip][0] === r.equipment_code && catalog[r.machine_ip][1] === r.modelo;\nconst num = (v) => typeof v === 'number' && Number.isFinite(v) ? v : null;\nconst str = (v) => typeof v === 'string' ? '\"' + v.replace(/\\\\/g,'\\\\\\\\').replace(/\"/g,'\\\\\"').replace(/\\n/g,' ') + '\"' : null;\nconst stamp = (v) => { const t = Date.parse(v); return Number.isFinite(t) && t <= Date.now() + 30000 ? t : null; };\nconst machines = msg.payload && Array.isArray(msg.payload.maquinas) ? msg.payload.maquinas : [];\nconst lines = [];\nconst kind = 'STATUS';\nfor (const r of machines) {\n    if (!valid(r) || r.cms_row_fresh !== true) continue;\n    const t = stamp(r.cms_timestamp);\n    if (t === null) continue;\n    const fields = [];\n    for (const key of [\"operation_status_code\",\"motor_status_code\",\"heater_status_code\",\"alarm_status_code\",\"cycle_time_before\",\"cycle_time_current\",\"production_time_hour\",\"production_time_min\",\"total_quantity\",\"current_quantity\",\"avg_quantity_per_hour\"]) { const v = num(r[key]); if (v !== null) fields.push(key + '=' + v); }\n    if (fields.length) lines.push('woojin_nodered_status,machine=' + r.equipment_code + ',source=NODE_RED_ENVASES ' + fields.join(',') + ' ' + t);\n}\nif (!lines.length) return [null,{payload:{status:'SIN_PUNTOS',kind,reason:kind === 'SHOT' ? 'PENDIENTE_IDENTIFICAR_MAQUINA para disparos sin Machine_Name' : 'SIN_FILAS_CMS_FRESCAS'}}];\nnode.status({fill:'green',shape:'dot',text:kind + ': ' + lines.length + ' puntos'});\nreturn [{url,method:'POST',headers:{Authorization:'Token ' + token,'Content-Type':'text/plain; charset=utf-8'},payload:lines.join('\\n'),influxKind:kind,influxPoints:lines.length},null];",
    "outputs": 2,
    "noerr": 0,
    "x": 400,
    "y": 830,
    "wires": [
      [
        "envases_influx_status_http_v1"
      ],
      [
        "envases_influx_debug_v1"
      ]
    ]
  },
  {
    "id": "envases_influx_shot_prepare_v1",
    "type": "function",
    "z": "envases_woojin_live_v2",
    "name": "Influx · sólo disparo atribuido",
    "d": true,
    "func": "const enabled = String(env.get('DISAL_ENVASES_INFLUX_WRITE_ENABLED') || '').toLowerCase() === 'true';\nconst base = String(env.get('DISAL_ENVASES_INFLUX_URL') || '').replace(/\\/$/, '');\nconst org = String(env.get('DISAL_ENVASES_INFLUX_ORG') || '');\nconst bucket = String(env.get('DISAL_ENVASES_INFLUX_BUCKET') || '');\nconst token = String(env.get('DISAL_ENVASES_INFLUX_TOKEN') || '');\nif (!enabled || !/^https?:\\/\\/[^/?#]+$/.test(base) || !org || !bucket || !token) {\n    node.status({fill:'yellow',shape:'ring',text:'Influx desactivado o incompleto'});\n    return [null,{payload:{status:'INFLUX_NO_CONFIGURADO'}}];\n}\nconst url = base + '/api/v2/write?org=' + encodeURIComponent(org) + '&bucket=' + encodeURIComponent(bucket) + '&precision=ms';\nconst catalog = {'172.16.0.141':['INY05','DL650G5'],'172.16.0.146':['INY04','DL450G5'],'172.16.0.143':['INY03','TB280G5-1'],'172.16.0.144':['INY02','TB280G5-2'],'172.16.0.145':['INY01','TB200G5']};\nconst valid = (r) => r && catalog[r.machine_ip] && catalog[r.machine_ip][0] === r.equipment_code && catalog[r.machine_ip][1] === r.modelo;\nconst num = (v) => typeof v === 'number' && Number.isFinite(v) ? v : null;\nconst str = (v) => typeof v === 'string' ? '\"' + v.replace(/\\\\/g,'\\\\\\\\').replace(/\"/g,'\\\\\"').replace(/\\n/g,' ') + '\"' : null;\nconst stamp = (v) => { const t = Date.parse(v); return Number.isFinite(t) && t <= Date.now() + 30000 ? t : null; };\nconst machines = msg.payload && Array.isArray(msg.payload.maquinas) ? msg.payload.maquinas : [];\nconst lines = [];\nconst kind = 'SHOT';\nfor (const r of machines) {\n    const s = r.ultimo_ciclo_tecnico;\n    if (!valid(r) || !s || s.machine_ip !== r.machine_ip || s.identity_source !== 'CMS_MACHINE_NAME') continue;\n    const t = stamp(s.timestamp);\n    if (t === null || !Number.isInteger(s.shot_number) || s.shot_number < 0) continue;\n    const fields = [];\n    for (const key of [\"shot_number\",\"cavity\",\"ngmark\",\"cycle_time\",\"injection_time\",\"filling_time\",\"max_injection_pressure\",\"max_injection_speed\",\"switch_over_position\",\"max_switch_over_pressure\",\"cushion_position\",\"plasticizing_time\",\"plasticizing_position\",\"average_screw_rpm\",\"max_screw_rpm\",\"average_back_pressure\",\"max_back_pressure\",\"clamp_close_time\",\"clamp_open_time\",\"clamp_open_position\",\"resin_weight\",\"hopper_temperature\"]) { const v = num(s[key]); if (v !== null) fields.push(key + '=' + v); }\n    const mold = str(s.mold_name); if (mold !== null) fields.push('mold_name=' + mold);\n    for (const key of ['inj_velocity','inj_pressure','inj_position','hld_pressure','hld_time','hld_vel','chg_position','chg_speed','back_pressure','suckback_position','suckback_speed','barrel_temperature','mold_temperature','timer']) {\n        const value = str(s.recipe && s.recipe[key]); if (value !== null) fields.push('recipe_' + key + '=' + value);\n    }\n    for (const key of ['sov_time','sov_position']) {\n        const value = num(s.recipe && s.recipe[key]); if (value !== null) fields.push('recipe_' + key + '=' + value);\n    }\n    for (const [key,values] of [['barrel_temp',s.barrel_temperatures],['mold_temp',s.mold_temperatures]]) {\n        if (Array.isArray(values)) values.forEach((value,index) => { const v = num(value); if (v !== null) fields.push(key + '_' + (index+1) + '=' + v); });\n    }\n    lines.push('woojin_nodered_shot,machine=' + r.equipment_code + ',source=NODE_RED_ENVASES ' + fields.join(',') + ' ' + t);\n}\nif (!lines.length) return [null,{payload:{status:'SIN_PUNTOS',kind,reason:kind === 'SHOT' ? 'PENDIENTE_IDENTIFICAR_MAQUINA para disparos sin Machine_Name' : 'SIN_FILAS_CMS_FRESCAS'}}];\nnode.status({fill:'green',shape:'dot',text:kind + ': ' + lines.length + ' puntos'});\nreturn [{url,method:'POST',headers:{Authorization:'Token ' + token,'Content-Type':'text/plain; charset=utf-8'},payload:lines.join('\\n'),influxKind:kind,influxPoints:lines.length},null];",
    "outputs": 2,
    "noerr": 0,
    "x": 400,
    "y": 880,
    "wires": [
      [
        "envases_influx_shot_http_v1"
      ],
      [
        "envases_influx_debug_v1"
      ]
    ]
  },
  {
    "id": "envases_influx_status_http_v1",
    "type": "http request",
    "z": "envases_woojin_live_v2",
    "name": "InfluxDB 2 · escribir estados",
    "d": true,
    "method": "use",
    "ret": "txt",
    "paytoqs": "ignore",
    "url": "",
    "tls": "",
    "persist": false,
    "proxy": "",
    "insecureHTTPParser": false,
    "authType": "",
    "senderr": false,
    "headers": [],
    "timeout": "4000",
    "x": 700,
    "y": 830,
    "wires": [
      [
        "envases_influx_status_result_v1"
      ]
    ]
  },
  {
    "id": "envases_influx_shot_http_v1",
    "type": "http request",
    "z": "envases_woojin_live_v2",
    "name": "InfluxDB 2 · escribir disparos",
    "d": true,
    "method": "use",
    "ret": "txt",
    "paytoqs": "ignore",
    "url": "",
    "tls": "",
    "persist": false,
    "proxy": "",
    "insecureHTTPParser": false,
    "authType": "",
    "senderr": false,
    "headers": [],
    "timeout": "4000",
    "x": 700,
    "y": 880,
    "wires": [
      [
        "envases_influx_shot_result_v1"
      ]
    ]
  },
  {
    "id": "envases_influx_status_result_v1",
    "type": "function",
    "z": "envases_woojin_live_v2",
    "name": "Influx · resultado status sin credenciales",
    "d": true,
    "func": "const code = Number(msg.statusCode);\nreturn {payload:{kind:msg.influxKind,points:msg.influxPoints,statusCode:code,status:code === 204 ? 'ESCRITO' : 'INFLUX_ERROR'}};",
    "outputs": 1,
    "noerr": 0,
    "x": 970,
    "y": 830,
    "wires": [
      [
        "envases_influx_debug_v1"
      ]
    ]
  },
  {
    "id": "envases_influx_shot_result_v1",
    "type": "function",
    "z": "envases_woojin_live_v2",
    "name": "Influx · resultado shot sin credenciales",
    "d": true,
    "func": "const code = Number(msg.statusCode);\nreturn {payload:{kind:msg.influxKind,points:msg.influxPoints,statusCode:code,status:code === 204 ? 'ESCRITO' : 'INFLUX_ERROR'}};",
    "outputs": 1,
    "noerr": 0,
    "x": 970,
    "y": 880,
    "wires": [
      [
        "envases_influx_debug_v1"
      ]
    ]
  },
  {
    "id": "envases_influx_catch_v1",
    "type": "catch",
    "z": "envases_woojin_live_v2",
    "name": "Influx · error HTTP",
    "d": true,
    "scope": [
      "envases_influx_status_http_v1",
      "envases_influx_shot_http_v1"
    ],
    "uncaught": false,
    "x": 700,
    "y": 930,
    "wires": [
      [
        "envases_influx_error_v1"
      ]
    ]
  },
  {
    "id": "envases_influx_error_v1",
    "type": "function",
    "z": "envases_woojin_live_v2",
    "name": "Influx · error sin secretos",
    "d": true,
    "func": "return {payload:{status:'INFLUX_HTTP_ERROR',kind:msg.influxKind || 'UNKNOWN'}};",
    "outputs": 1,
    "noerr": 0,
    "x": 970,
    "y": 930,
    "wires": [
      [
        "envases_influx_debug_v1"
      ]
    ]
  },
  {
    "id": "envases_influx_debug_v1",
    "type": "debug",
    "z": "envases_woojin_live_v2",
    "name": "Influx · diagnóstico sin credenciales",
    "d": true,
    "active": true,
    "tosidebar": true,
    "console": false,
    "tostatus": false,
    "complete": "payload",
    "targetType": "msg",
    "x": 1260,
    "y": 880,
    "wires": []
  }
]
```
