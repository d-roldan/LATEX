# ENVASES · monitoreo Woojin

La estructura observada de la base MariaDB del software CMS se documenta en [BASE_DATOS_CMS_WOOJIN.md](BASE_DATOS_CMS_WOOJIN.md).
El origen estático de las parejas de temperatura de la pantalla nativa se resume en [ORIGEN_TEMPERATURAS_WOOJIN.md](ORIGEN_TEMPERATURAS_WOOJIN.md).

La consulta fija de cinco máquinas del Node-RED industrial puede tomar el modelo de
`itgr_machine_list.Machine_Nickname` mediante el `JOIN` de
[`envases-woojin-real-data.sql`](../infra/node-red/examples/envases-woojin-real-data.sql).
Se conserva el flujo existente que ya consulta CMS; el archivo es una propuesta de sustitución
de su sentencia SQL, no una consulta adicional ni un despliegue del Node-RED compartido.
`real_data` aporta los 14 campos de estado que admite la API cuando su timestamp avanza. El 19/10/2026 se comprobó una discrepancia operativa: CMS Board mostraba cinco máquinas en AUTO mientras las cinco filas SQL conservaban fechas del 17/10 y ceros. Por eso el flujo marca `REAL_DATA_DESACTUALIZADA` y no se debe presentar esos ceros como estado actual. La [guía del flujo externo](FLUJO_NODERED_EXTERNO_ENVASES.md#cuando-cms-board-muestra-producción-y-real_data-está-detenida) contiene la consulta de contraste y las comprobaciones del tramo DBS → MariaDB. Durante el descanso de fin
de semana su última lectura puede quedar antigua aunque la adquisición funcione normalmente
en los días de producción.

## Alcance

ENVASES es una planta independiente de ENVASADO. El backend recibe el resumen ya producido por el Node-RED industrial externo y conserva el último valor aceptado de cada inyectora en memoria. No consulta MariaDB ni Modbus, ni envía órdenes a las máquinas. Puede escribir series históricas en un bucket dedicado de InfluxDB cuando se configura `INFLUXDB_ENVASES_BUCKET`; no escribe muestras en PostgreSQL. Tras reiniciar el backend, las cinco tarjetas muestran **Sin datos** hasta el siguiente lote, aunque el historial configurado permanece en InfluxDB.

Como la caché vigente es local al proceso (igual que la telemetría de pesos actual), la recepción y las consultas deben llegar a la misma instancia de backend. Un despliegue con varias réplicas necesitaría un almacén compartido antes de habilitar balanceo libre entre ellas.

La pantalla autenticada es `/envases?plant=ENVASES`; la TV de consulta pública sigue el modelo existente en `/tv?plant=ENVASES`. La API pública de TV no expone la clave ni concede acciones de administración. Para restringirla en una instalación concreta sería necesario cambiar el modelo público de TV de la aplicación.

## Organización del tablero

- **Tarjeta y TV:** mostrar los datos que `real_data` atribuye directamente a una IP: modo, motor, calefacción, contador actual, total, ciclo actual/anterior, promedio y tiempo de producción. El color resume el modo y el texto lo identifica. Una marca de lectura antigua impide presentar esos valores como actuales durante el descanso o una pérdida de comunicación.
- **Popup, General y Producción:** conservar todos los códigos y contadores de `real_data`, fecha CMS, recepción en LATEX y diagnóstico de frescura. El cero se muestra como valor, separado de «No informado».
- **Popup, Parámetros de inyección y Ajustes del ciclo:** separar resultados medidos en `shot_data` de las series de parámetros de `shot_data_rec`. Mostrar el timestamp del disparo y el origen de su vínculo con la máquina. La comparación por zona presenta ajuste y medición del **último disparo**, nunca temperaturas instantáneas. Las siete posiciones de cilindro se rotulan «Zona CMS» y la octava se compara con tolva. El análisis del CMS Board identifica otras ocho parejas vivas (`Ext Nozzle`, `Nozzle`, `Heater1`–`Heater4`, `Oil`, `Hopper`) entregadas a DBA por la API DBS; no demuestra equivalencia de esas tarjetas con las columnas de disparos ni sus unidades.
- **Popup, Histórico:** graficar ciclo, contador y, cuando exista disparo atribuido, ajuste y medición por zona. Las fuentes real y simulada están separadas.
- **Archivo:** mostrar `Additional_Info_1` como «archivo del último ciclo» únicamente cuando ese ciclo esté atribuido a una IP. No presentarlo como archivo cargado en este instante: `real_data` no ofrece ese dato.

Esta distribución conserva la TV legible a distancia y deja las series técnicas extensas para el popup. No requiere que el navegador consulte MariaDB; la API entrega una instantánea normalizada por máquina cada dos segundos.

## Catálogo y umbrales

El catálogo central está en `apps/backend/src/modules/plant/injection-machines.config.ts` y viaja en la respuesta de consulta; el frontend no mantiene una copia de las IP. Orden visible: Inyectora 1 / INY01 / 172.16.0.145 / TB200G5, Inyectora 2 / INY02 / 172.16.0.144 / TB280G5-2, Inyectora 3 / INY03 / 172.16.0.143 / TB280G5-1, Inyectora 4 / INY04 / 172.16.0.146 / DL450G5, Inyectora 5 / INY05 / 172.16.0.141 / DL650G5. Para agregar, cambiar u ocultar una inyectora, editar una entrada del catálogo y desplegar el backend. El frontend genera las tarjetas desde la lista devuelta y admite más equipos sin cambios. Los flujos de Node-RED deben enviar el mismo `equipment_code` para cada IP: una discrepancia se informa como `Código de equipo incorrecto` y deja la lectura fuera de la tarjeta.

El cambio de códigos altera también las etiquetas `machine=INYxx` del historial de InfluxDB. Los puntos escritos antes del cambio conservan el significado anterior; consultar una serie por código puede mezclar equipos a través de la fecha de transición. Para conservar la trazabilidad, migrar esas series con una correspondencia IP/código y una fecha de corte verificada antes de usar el histórico por código como histórico continuo.

Los umbrales declarados en ese archivo son: CMS 10 s, recepción Node-RED 30 s, incremento observado 60 s y refresco visual 2 s. Ajustar el segundo y el tercero a la cadencia real de adquisición. La frescura se calcula con timestamps absolutos ISO 8601 UTC y la hora se presenta en la zona local del navegador. Un timestamp SQL reciente no valida la adquisición Modbus. `AUTO` tampoco confirma producción física. El valor `adquisicion_industrial_fresca` se muestra sin reinterpretarlo.

## Preparación de la base y permisos

No hay cambio de schema ni migración. `Plant` y `PlantIntegration` existentes admiten este módulo; las inyectoras se catalogan de forma declarativa porque `Tank` contiene estados, lotes y capacidad específicos de tanques. El seed de una instalación nueva crea la planta sin inventar tanques. Para una instalación existente, preparar la empresa destino mediante el script idempotente `prisma:provision-envases`. **No ejecutar el seed general sobre una base existente para esta incorporación:** también realiza otras tareas de inicialización.

1. Verificar respaldo y empresa destino. Si no usa `seed_company_disal`, definir `SYSTEM_OWNER_COMPANY_ID`.
2. Generar una clave aleatoria exclusiva de al menos 32 caracteres y cargarla como `ENVASES_NODE_RED_KEY` sólo en el entorno del proceso que ejecutará el script y en el almacén de credenciales del Node-RED externo. No copiarla a Git ni al frontend. El script almacena su hash SHA-256 en `PlantIntegration` con fuente `NODE_RED_ENVASES`.
3. Después de compilar el backend, ejecutar desde `apps/backend` `npm run build` y `npm run prisma:provision-envases` en el destino autorizado, con `DATABASE_URL` y las variables anteriores apuntando explícitamente a ese destino. Sin la variable de clave, sólo crea la planta y deja la integración pendiente. El backend en ejecución no necesita la clave en su entorno: compara contra el hash guardado.
4. Asignar ENVASES a cada usuario autorizado desde la administración de usuarios existente. La creación de la planta no concede permisos automáticamente. Comprobar con un usuario asignado y uno sin asignación.

Este procedimiento está preparado, pero **no se ejecutó contra producción**. Tampoco se importó ni habilitó ningún flujo en Node-RED externo.

## Contrato HTTP

`POST /api/plants/ENVASES/telemetry/injection-machines` requiere `X-Node-Red-Key` y una `PlantIntegration` activa de fuente `NODE_RED_ENVASES`. El cuerpo es el objeto `msg.payload` de `RESUMEN 5 WOOJIN` con `source: "NODE_RED_ENVASES"` y `schemaVersion: 1` añadidos:

```json
{
  "source": "NODE_RED_ENVASES",
  "schemaVersion": 1,
  "fecha_recepcion_nodered": "2026-10-16T18:46:28.685Z",
  "cantidad_filas_sql": 5,
  "cantidad_maquinas_frescas_cms": 5,
  "duracion_consulta_ms": 5,
  "maquinas": [
    {
      "machine_ip": "172.16.0.141",
      "modelo": "DL650G5",
      "cms_timestamp": "2026-10-16T18:46:27.000Z",
      "current_quantity": 11429,
      "operation_status_code": 1,
      "operation_status_text": "AUTO",
      "adquisicion_industrial_fresca": "NO_VERIFICADA"
    }
  ]
}
```

Se admiten lotes parciales. Cada IP conocida y visible se relaciona con su código estable; el modelo recibido, si existe, debe coincidir con el catálogo. Una IP desconocida o un modelo distinto se rechazan por máquina, sin perder las aceptadas. Se rechazan IP repetidas en el mismo lote, timestamps futuros, tipos inválidos y campos fuera del contrato. Se ignora una lectura cuyo `cms_timestamp` sea igual o anterior al último aceptado de esa inyectora. Respuesta: `accepted`, `rejected`, `ignored`, `receivedAt`, `persisted` y `results` por IP. `persisted` es verdadero sólo si se almacenaron en InfluxDB **todas** las lecturas aceptadas del lote; la caché operativa puede actualizarse aunque InfluxDB no esté configurado o falle. Un lote válido, aunque repita muestras, actualiza la última comunicación del emisor; no altera contadores.

`GET /api/plants/ENVASES/telemetry/injection-machines` requiere sesión, rol de planta y asignación ENVASES al usuario. `GET /api/plants/ENVASES/tv/injection-machines` es público conforme al TV existente. Ambos devuelven un único lote ordenado con cinco equipos y `reading: null` para los que aún no recibieron datos. `communication`, `cmsFresh`, `communicationFresh` y `counterRecent` se recalculan al consultar. La recepción desde Node-RED, la frescura SQL de CMS y la validación industrial son diagnósticos independientes. Los valores nulos y los códigos desconocidos permanecen visibles.

El popup incorpora una línea histórica de estado, verde para `AUTO` y roja para `MANUAL`/`PARO`/`STOP`, a partir de lecturas vigentes enviadas por Node-RED e identificadas por IP. El backend escribe `woojin_operating_state` en el bucket dedicado de ENVASES al cambiar el estado y cada 30 segundos como latido. Un hueco mayor a 90 segundos se representa gris, sin inferir que la máquina se detuvo. El endpoint histórico acepta `metric=state` y devuelve muestras sin agregarlas, para no ocultar transiciones breves. Esta serie comienza al activarse el bucket; los disparos antiguos de HeidiSQL no aportan estados de encendido/detención fiables.

El popup consulta además `GET /api/plants/ENVASES/injection-machines/:code/cms-shots` para mostrar hasta 50 disparos por página de `shot_data`, con parámetros de `shot_data_rec` vinculados por índice, número, hora y archivo. Requiere sesión y acceso a ENVASES; acepta `before=<idx>` para cargar registros anteriores. El backend toma `current_file_name` de la lectura real reciente de esa inyectora y filtra por coincidencia **exacta** de `Additional_Info_1`. La respuesta marca `attribution: CURRENT_FILE_MATCH`: el archivo identifica el molde actual, pero no prueba que todos sus disparos antiguos se hayan hecho en esa IP. No mezcla estas filas con las series verificadas por IP de InfluxDB. Los disparos repetidos del mismo número de archivo se muestran una sola vez por página. Los archivos actuales de las inyectoras 3, 4 y 5 no tienen filas en la muestra CMS consultada el 19/10/2026; el popup lo indica sin inventar un histórico.

Para esta lectura configurar `CMS_DB_HOST`, `CMS_DB_PORT`, `CMS_DB_USER`, `CMS_DB_PASSWORD` y `CMS_DB_NAME` sólo en el entorno del backend. La conexión usa una transacción de solo lectura, consultas fijas parametrizadas y límite de 151 filas SQL por página. La cuenta entregada actualmente (`cms`) tiene privilegios completos; sustituirla por una cuenta limitada a `SELECT` antes de usar esta conexión fuera del entorno local. No registrar la contraseña en Git ni en Node-RED Debug.

`cycle_time_current` y `cycle_time_before` se muestran en segundos como **unidad inferida pendiente de confirmación**. `production_time_hour` y `production_time_min` se rotulan como tiempo reportado por CMS. `total_quantity` es total reportado por CMS, no meta. El delta de contador indica cambio entre consultas, no piezas producidas en un segundo. El código de alarma se muestra en bruto: cero no se interpreta como ausencia confirmada de alarma.

## Historial de ENVASES

Configurar en el backend `INFLUXDB_URL`, `INFLUXDB_ORG` o `INFLUXDB_ORG_ID`, `INFLUXDB_ENVASES_BUCKET` y `INFLUXDB_ENVASES_TOKEN` con un bucket **dedicado** creado en InfluxDB. El token exclusivo de ENVASES tiene prioridad sobre `INFLUXDB_TOKEN`, usado por las demás plantas; si no se configura, se usa el token general. Dejar `INFLUXDB_ENVASES_BUCKET` vacío desactiva la escritura y la consulta histórica sin afectar el tablero actual. La clave debe permitir escribir y consultar ese bucket. No compartirla con Node-RED ni el frontend. Antes de activarlo en producción, revisar retención y respaldo del bucket según la política de la planta.

El backend escribe `woojin_status` por IP validada y timestamp de `real_data`, con ciclo actual, contador actual, total, promedio y código de operación. Un `woojin_shot` por disparo **atribuido** guarda número, ciclo y temperaturas medidas/ajustadas de cilindro, tolva y molde cuando estén presentes. Los tags `machine=INY01..INY05` y `source=NODE_RED_ENVASES` o `NODE_RED_ENVASES_SIM` impiden mezclar equipos y simulación. Las lecturas rechazadas, repetidas, antiguas o marcadas como obsoletas no alimentan el estado histórico; un disparo nuevo atribuido sí puede registrarse aunque `real_data` repita timestamp. El endpoint autenticado `GET /api/plants/ENVASES/injection-machines/:code/history` exige asignación de ENVASES y acepta `source`, `metric=state|cycle|quantity|temperature`, `hours=1|6|24|72|168` y `zone=1..20`. Las zonas 1–7 son cilindro, 8 es tolva y 9–20 son molde. La TV no consulta ni muestra este historial.

Este registro comienza **desde su activación**. El flujo externo envía el último ciclo técnico y ahora ofrece dos ramas optativas para escribir en InfluxDB las mediciones raw `woojin_nodered_status` y `woojin_nodered_shot`, separadas de las series curadas del backend que consulta la interfaz. Un disparo omitido entre dos consultas no se recupera automáticamente por ninguna de estas rutas. El histórico anterior de `shot_data`/`shot_data_rec` permanece sin IP verificable; no se atribuye por similitud de contador o de molde. Para importarlo por inyectora hace falta comprobar la correspondencia contador/archivo/IP con producción y validar los cambios de molde. En ausencia de un ciclo atribuido, la gráfica de temperaturas indica que aún no hay datos.

La gráfica `metric=temperature` representa temperaturas asociadas a **disparos atribuidos**, no la evolución continua de `Setting`/`Current` que presenta CMS Board. Para obtener esa serie continua hace falta una adquisición adicional de la API DBS, validada operativamente, con IP, timestamp y frescura propios; no se debe etiquetar la gráfica actual como temperatura en vivo.

## Rama importable de Node-RED

### Ciclos técnicos y parámetros de receta

`real_data` no contiene las mediciones de `shot_data` ni las cadenas por etapas de
`shot_data_rec`. El contrato opcional `ultimo_ciclo_tecnico` admite los resultados del último
disparo y un objeto `recipe` con los dieciséis campos de `shot_data_rec`: `inj_velocity`,
`inj_pressure`, `inj_position`, `sov_time`, `sov_position`, `hld_pressure`, `hld_time`, `hld_vel`,
`chg_position`, `chg_speed`, `back_pressure`, `suckback_position`, `suckback_speed`,
`barrel_temperature`, `mold_temperature` y `timer`. Las series separadas por `/` se conservan
como texto de CMS, sin deducir unidades.

Para que la API publique un ciclo **real** dentro de una inyectora, el ciclo debe incluir
`machine_ip` igual a la IP de la lectura y `identity_source` igual a `CMS_MACHINE_NAME` o
`NODE_RED_MACHINE_CONTEXT`, según el vínculo efectivamente verificado. El simulador usa
`SIMULATED`. Si falta esa atribución, la API conserva los campos actuales de `real_data` y
omite el ciclo técnico de la tarjeta; la respuesta de recepción indica
`technical: UNATTRIBUTED` para ese equipo. La API separa `reading` (estado actual) de
`ultimo_ciclo_tecnico` (último disparo atribuido) y puede actualizar el segundo aunque el
`cms_timestamp` de `real_data` no haya cambiado. Los registros observados de `shot_data` y
`shot_data_rec` tienen `Machine_Name = '-'`; el `JOIN` por IP de `real_data` con
`itgr_machine_list` **no identifica esos disparos antiguos**. El usuario confirmó que puede
configurar CMS para guardar en los nuevos disparos el apodo de la máquina como
`shot_data.Machine_Name`. El flujo externo preparado sólo vincula un nuevo ciclo a una IP
cuando ese valor coincide exactamente y de forma única con
`itgr_machine_list.Machine_Nickname`, la receta coincide en identificador, fecha y número de
disparo, y la IP/modelo corresponden a una lectura actual. Los registros previos con `-`
quedan sin atribución. El nombre de archivo de `Additional_Info_1` corresponde al último
ciclo registrado, no certifica el archivo cargado en ese instante.

### Envío del resumen actual

El [flujo externo completo](FLUJO_NODERED_EXTERNO_ENVASES.md) sustituye el flujo SQL/HTTP recibido del usuario e incluye un bloque JSON listo para importar. Lee `real_data` y el modelo de `itgr_machine_list`, conserva la comparación de contadores y envía lotes a LATEX. Consulta los últimos ciclos por apodo único y agrega parámetros técnicos sólo a la IP comprobada. Mantiene además una lectura manual del último par global `shot_data`/`shot_data_rec` **sólo en Debug**. El documento explica cómo configurar el nombre en CMS, el acceso de solo lectura, las variables `DISAL_API_BASE_URL` y `DISAL_ENVASES_INTEGRATION_KEY`, la zona horaria, la prueba manual y la activación periódica sin duplicar el flujo anterior.

`infra/node-red/examples/envases-woojin-http-branch.json` queda como ejemplo anterior de rama HTTP para quien mantenga el flujo legado; no debe importarse además del flujo completo. La conectividad productiva sigue pendiente de la importación y configuración por el responsable del Node-RED externo compartido. No se reinició ni desplegó ese servicio como parte de la preparación local.

## Simulación local para visualizar las tarjetas

El simulador local tiene fuente, clave y caché propias (`NODE_RED_ENVASES_SIM`, `ENVASES_SIM_NODE_RED_KEY`). Su configuración, controles de escenarios, parámetros de último ciclo, pruebas y límites están en [SIMULADOR_ENVASES_WOOJIN.md](SIMULADOR_ENVASES_WOOJIN.md). No reutilizar la clave real ni importar el flujo de demostración en el Node-RED industrial externo.

## Validación y límites

La ruta de lectura directa de DBS, confirmada el 19/10/2026 y preparada como flujo importable
deshabilitado, se documenta en [Integración ENVASES por API DBS](INTEGRACION_ENVASES_DBS_API.md).
El flujo SQL anterior y el nuevo flujo DBS no deben publicar simultáneamente la misma fuente.

La verificación local debe incluir contrato válido/inválido, permisos, parcialidad, duplicados, códigos desconocidos, nulidad, caída de señal, compilaciones y vista en 1920 × 1080 y tamaños menores. Una muestra de prueba local demuestra el recorrido de aplicación; no demuestra conectividad productiva con CMS ni la asignación de disparos antiguos. El nuevo historial requiere probar un bucket dedicado antes de habilitarlo en producción. El flujo externo incluye ramas de escritura InfluxDB deshabilitadas por defecto, con token y bucket definidos en el entorno de Node-RED; la escritura curada para las gráficas sigue a cargo del backend.
