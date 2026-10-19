// Genera un flujo importable a partir del flujo que entregó el usuario.
// No contiene credenciales ni despliega cambios en el Node-RED externo.
const fs = require('node:fs');
const path = require('node:path');

const dir = __dirname;
const input = JSON.parse(fs.readFileSync(path.join(dir, 'envases-woojin-flujo-recibido.json'), 'utf8'));
const suffix = '_externo_v2';
const tabId = 'envases_woojin_live_v2';
const oldIds = new Set(input.map((node) => node.id));
const id = (oldId) => `${oldId}${suffix}`;
const nodes = input
  .filter((node) => node.type !== 'global-config' && node.id !== 'envases-disal-comment')
  .map((node) => ({
    ...node,
    id: id(node.id),
    z: node.z ? tabId : undefined,
    mydb: node.mydb ? id(node.mydb) : undefined,
    scope: Array.isArray(node.scope) ? node.scope.map(id) : undefined,
    wires: Array.isArray(node.wires)
      ? node.wires.map((output) => output.map((target) => (oldIds.has(target) ? id(target) : target)))
      : undefined
  }));

const node = (oldId) => nodes.find((item) => item.id === id(oldId));
nodes.unshift({ id: tabId, type: 'tab', label: 'ENVASES · Woojin real v2', disabled: true, info: 'Importar deshabilitado. Configurar MySQL y API; probar manualmente. Las dos ramas InfluxDB permanecen deshabilitadas hasta configurar su bucket y token.' });
node('w5_comment').name = 'LEER ANTES: configurar y probar manual; auto deshabilitado';
node('w5_comment').info = 'Este flujo sustituye al anterior, no debe ejecutarse en paralelo. Configurar MySQL sólo SELECT, API LATEX y, por separado, las variables DISAL_ENVASES_INFLUX_*. Los nodos InfluxDB llegan DESHABILITADOS. Estados de real_data: IP verificada. Disparos: sólo si Machine_Name coincide de forma única con itgr_machine_list.Machine_Nickname; los históricos con - siguen SIN INYECTORA IDENTIFICADA y NO se escriben por máquina. Probar Manual, luego habilitar auto 5 s y finalmente cada rama InfluxDB. No escribe en Woojin.';
node('w5_manual').name = 'Woojin · consulta manual';
node('w5_auto_5s').name = 'Woojin · automático 5 s (habilitar tras prueba)';
node('w5_sql').name = 'Woojin · SQL actual y modelo por IP';
node('w5_sql').func = `// Consulta fija: ninguna entrada puede cambiar el SQL.
const ahora = Date.now();
if (Number(flow.get('envases_sql_busy_until') || 0) > ahora) {
    node.status({fill:'yellow',shape:'ring',text:'SQL anterior pendiente'});
    return null;
}
flow.set('envases_sql_busy_until', ahora + 30000);
msg.woojin_inicio_ms = ahora;
msg.topic = [
    'SELECT r.Machine_IP, r.Machine_Name, m.Machine_Nickname AS Modelo,',
    "DATE_FORMAT(r.Time_Stamp, '%Y-%m-%dT%H:%i:%s-03:00') AS cms_timestamp_iso,",
    'r.Motor_Status, r.Heater_Status, r.Operation_Status,',
    'r.Cycle_Time_Before, r.Cycle_Time_Current,',
    'r.Production_Time_Hour, r.Production_Time_Min,',
    'r.Total_Quantity, r.Current_Quantity, r.Avg_Quantity_Per_Hour,',
    'r.Alarm_Status,',
    'TIMESTAMPDIFF(SECOND, r.Time_Stamp, NOW()) AS cms_age_seconds',
    'FROM disal_cms.real_data AS r',
    'LEFT JOIN disal_cms.itgr_machine_list AS m ON m.Machine_IP = r.Machine_IP',
    "WHERE r.Machine_IP IN ('172.16.0.141','172.16.0.143','172.16.0.144','172.16.0.145','172.16.0.146')",
    'ORDER BY m.idx LIMIT 5'
].join('\\n');
msg.payload = [];
node.status({fill:'blue',shape:'dot',text:'SELECT Woojin en curso'});
return msg;`;
node('w5_mysql').name = 'Woojin CMS · sólo SELECT (configurar acceso)';
node('w5_normalize').name = 'Woojin · normalizar último estado SQL';
node('w5_normalize').func = `if (!Array.isArray(msg.payload)) {
    flow.set('envases_sql_busy_until', 0);
    node.status({fill:'red',shape:'ring',text:'Resultado SQL inválido'});
    return [null, null, {payload:{status:'SQL_INVALIDO'}}];
}
const catalogo = {
    '172.16.0.141':'INY01', '172.16.0.146':'INY02',
    '172.16.0.143':'INY03', '172.16.0.144':'INY04', '172.16.0.145':'INY05'
};
const ahora = Date.now();
const historial = context.get('envases_contadores') || {};
const siguiente = {...historial};
const maquinas = [];
const eventos = [];
const problemas = [];
const vistos = new Set();
function numero(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(typeof value === 'string' ? value.replace(',', '.') : value);
    return Number.isFinite(parsed) ? parsed : null;
}
function estado(value, nombres) { return Object.prototype.hasOwnProperty.call(nombres, value) ? nombres[value] : 'NO_VALIDADO'; }
for (const fila of msg.payload) {
    const ip = String(fila && fila.Machine_IP || '');
    if (!catalogo[ip] || vistos.has(ip)) {
        problemas.push({tipo:'IP_DESCONOCIDA_O_REPETIDA', machine_ip:ip});
        continue;
    }
    vistos.add(ip);
    const marca = fila.cms_timestamp_iso;
    if (typeof marca !== 'string' || !Number.isFinite(Date.parse(marca))) {
        problemas.push({tipo:'TIMESTAMP_INVALIDO', machine_ip:ip});
        continue;
    }
    const edad = numero(fila.cms_age_seconds);
    const fresca = edad !== null && edad >= 0 && edad <= 10;
    const actual = numero(fila.Current_Quantity);
    const previo = historial[ip];
    let delta = null;
    let cambio = fresca ? 'LINEA_BASE_INICIAL' : 'SIN_EVALUAR_POR_FRESCURA';
    let ultimo = previo && previo.ultimo_incremento_ms || null;
    if (fresca && actual === null) cambio = 'CONTADOR_INVALIDO';
    else if (fresca && previo && typeof previo.contador === 'number' && previo.cms_timestamp !== marca) {
        delta = actual - previo.contador;
        if (delta > 0) {
            cambio = 'INCREMENTO_DETECTADO';
            ultimo = ahora;
            eventos.push({payload:{evento:cambio,machine_ip:ip,delta,observado_en:new Date(ahora).toISOString()}});
        } else if (delta < 0) {
            cambio = 'REINICIO_O_RETROCESO_CONTADOR';
            ultimo = null;
            eventos.push({payload:{evento:cambio,machine_ip:ip,contador_actual:actual}});
        } else cambio = 'SIN_INCREMENTO_EN_ESTA_LECTURA';
    } else if (fresca && previo) cambio = 'SIN_CAMBIO';
    if (fresca && actual !== null) siguiente[ip] = {contador:actual,cms_timestamp:marca,ultimo_incremento_ms:ultimo};
    const op = numero(fila.Operation_Status);
    const motor = numero(fila.Motor_Status);
    const heater = numero(fila.Heater_Status);
    const ciclo = numero(fila.Cycle_Time_Current);
    const actividadReciente = ultimo && ahora - ultimo <= Math.max(90000, (ciclo || 0) * 3000);
    maquinas.push({
        machine_ip:ip, equipment_code:catalogo[ip],
        modelo:typeof fila.Modelo === 'string' && fila.Modelo.trim() ? fila.Modelo.trim() : null,
        machine_name_cms:fila.Machine_Name || null,
        cms_timestamp:marca, cms_age_seconds:edad !== null && edad >= 0 ? edad : null,
        cms_row_fresh:fresca, adquisicion_industrial_fresca:'NO_VERIFICADA',
        operation_status_code:op, operation_status_text:estado(op,{0:'PARO',1:'AUTO',2:'SEMI AUTO',3:'MANUAL',4:'MANUAL'}),
        motor_status_code:motor, motor_status_text:estado(motor,{0:'STOP',1:'RUN'}),
        heater_status_code:heater, heater_status_text:estado(heater,{0:'OFF',1:'ON'}),
        alarm_status_code:numero(fila.Alarm_Status),
        cycle_time_before:numero(fila.Cycle_Time_Before), cycle_time_current:ciclo,
        production_time_hour:numero(fila.Production_Time_Hour), production_time_min:numero(fila.Production_Time_Min),
        total_quantity:numero(fila.Total_Quantity), current_quantity:actual,
        avg_quantity_per_hour:numero(fila.Avg_Quantity_Per_Hour),
        delta_contador_observado:delta, tipo_cambio_contador:cambio,
        actividad_inferida:!fresca ? 'DATOS_CMS_DESACTUALIZADOS' : actividadReciente ? 'INCREMENTO_RECIENTE' : 'SIN_INCREMENTO_RECIENTE',
        ultimo_incremento_detectado:ultimo ? new Date(ultimo).toISOString() : null
    });
}
for (const ip of Object.keys(catalogo)) if (!vistos.has(ip)) problemas.push({tipo:'SIN_FILA_SQL',machine_ip:ip});
context.set('envases_contadores', siguiente);
const frescas = maquinas.filter(item => item.cms_row_fresh).length;
const origenDesactualizado = maquinas.length > 0 && frescas === 0;
node.status({fill:origenDesactualizado ? 'red' : maquinas.length === 5 ? 'green' : 'yellow',shape:origenDesactualizado ? 'ring' : 'dot',text:origenDesactualizado ? 'REAL_DATA SIN ACTUALIZAR: 0/' + maquinas.length : maquinas.length + '/5 filas válidas; ' + frescas + ' frescas'});
const resumen = {payload:{
    fecha_recepcion_nodered:new Date(ahora).toISOString(),
    cantidad_filas_sql:msg.payload.length, cantidad_maquinas_frescas_cms:frescas,
    duracion_consulta_ms:typeof msg.woojin_inicio_ms === 'number' ? ahora - msg.woojin_inicio_ms : null,
    estado_origen:origenDesactualizado ? 'REAL_DATA_DESACTUALIZADA' : frescas < maquinas.length ? 'REAL_DATA_PARCIALMENTE_DESACTUALIZADA' : 'REAL_DATA_RECIENTE',
    aviso:origenDesactualizado ? 'Las filas SQL son antiguas: PARO y ceros son últimos valores almacenados, NO el estado actual. CMS Board usa la API de DBS. Revisar actualización DBS a real_data y conexión a MariaDB.' : 'Frescura SQL no confirma señal Modbus ni producción. Ciclos históricos sin IP no se asignan.',
    filas_desactualizadas:maquinas.filter(item => !item.cms_row_fresh).map(item => ({machine_ip:item.machine_ip,modelo:item.modelo,ultimo_timestamp:item.cms_timestamp,edad_segundos:item.cms_age_seconds})),
    maquinas
}};
return [resumen, eventos.length ? eventos : null, problemas.length ? {payload:{problemas}} : null];`;
node('w5_normalize').wires = [[id('w5_debug_summary'), 'envases_technical_sql_v3', 'envases_influx_status_prepare_v1'], [id('w5_debug_delta')], [id('w5_debug_influx')]];
node('w5_debug_influx').name = 'Diagnóstico de filas SQL (sin InfluxDB)';
node('w5_debug_influx').active = true;
node('w5_debug_summary').name = 'Resumen Woojin · último estado SQL';
node('envases-disal-prepare').name = 'ENVASES · preparar envío real';
node('envases-disal-prepare').func = `if (Number(flow.get('envases_http_busy_until') || 0) > Date.now())
    return [null,{payload:{status:'ENVIO_OCUPADO'}}];
const base = env.get('DISAL_API_BASE_URL');
const key = env.get('DISAL_ENVASES_INTEGRATION_KEY');
if (!base || !key) return [null,{payload:{status:'CONFIG_ERROR',message:'Falta URL de API o clave de integración'}}];
if (!msg.payload || !Array.isArray(msg.payload.maquinas) || !msg.payload.maquinas.length)
    return [null,{payload:{status:'SIN_LECTURAS_VALIDAS'}}];
flow.set('envases_http_busy_until', Date.now() + 25000);
msg.method = 'POST';
msg.url = String(base).replace(/\\/+$/, '') + '/plants/ENVASES/telemetry/injection-machines';
msg.headers = {'content-type':'application/json','x-node-red-key':key};
// El resumen Debug contiene campos operativos que el DTO estricto de la API no admite.
// Construir explícitamente el contrato HTTP para no filtrarlos por accidente.
msg.payload = {
    source:'NODE_RED_ENVASES',schemaVersion:1,
    fecha_recepcion_nodered:msg.payload.fecha_recepcion_nodered,
    cantidad_filas_sql:msg.payload.cantidad_filas_sql,
    cantidad_maquinas_frescas_cms:msg.payload.cantidad_maquinas_frescas_cms,
    duracion_consulta_ms:msg.payload.duracion_consulta_ms,
    aviso:msg.payload.aviso,
    maquinas:msg.payload.maquinas
};
msg.envasesBody = msg.payload;
msg.envasesAttempt = 0;
msg.envasesMachineCount = msg.payload.maquinas.length;
return [msg,null];`;
node('envases-disal-http').timeout = '4000';
node('envases-disal-result').func = `const statusCode = Number(msg.statusCode || 0);
const attempt = Number(msg.envasesAttempt || 0);
const retry = statusCode === 0 || statusCode === 429 || statusCode >= 500;
if (retry && attempt < 2) {
    msg.envasesAttempt = attempt + 1;
    msg.payload = msg.envasesBody;
    msg.headers = {'content-type':'application/json','x-node-red-key':env.get('DISAL_ENVASES_INTEGRATION_KEY')};
    return [msg,null];
}
flow.set('envases_http_busy_until',0);
const messages = msg.payload && msg.payload.message;
const validation = (Array.isArray(messages) ? messages : [messages])
    .filter(value => typeof value === 'string' && /^property [a-zA-Z0-9_]+ should not exist$/.test(value))
    .slice(0,5);
return [null,{payload:{statusCode,attempts:attempt + 1,sent:msg.envasesMachineCount,
    accepted:msg.payload && msg.payload.accepted,rejected:msg.payload && msg.payload.rejected,
    ignored:msg.payload && msg.payload.ignored,
    results:msg.payload && msg.payload.results || null,
    validation,
    error:statusCode >= 400 ? 'API rechazo el lote; revisar respuesta sin publicar secretos' : null}}];`;
node('envases-disal-error').func = `const attempt = Number(msg.envasesAttempt || 0);
if (attempt < 2 && msg.envasesBody) {
    msg.envasesAttempt = attempt + 1;
    msg.payload = msg.envasesBody;
    msg.headers = {'content-type':'application/json','x-node-red-key':env.get('DISAL_ENVASES_INTEGRATION_KEY')};
    return [msg,null];
}
flow.set('envases_http_busy_until',0);
return [null,{payload:{status:'HTTP_ERROR',attempts:attempt + 1,sent:msg.envasesMachineCount,
    message:String(msg.error && msg.error.message || 'Error de red').slice(0,180)}}];`;
node('woojin_database').name = 'Woojin CMS · configurar usuario sólo SELECT';
node('woojin_database').host = '10.1.0.105';
node('woojin_database').port = '3306';
node('woojin_database').db = 'disal_cms';
// El nodo de configuración exportado deliberadamente no contiene usuario ni contraseña.

nodes.push(
  {id:'envases_technical_sql_v3',type:'function',z:tabId,name:'Woojin · último ciclo por apodo único',func:`if (!msg.payload || !Array.isArray(msg.payload.maquinas)) {
    flow.set('envases_sql_busy_until',0);
    return null;
}
msg.envasesSummary = msg.payload;
// Sólo nombres exactos y únicos del catálogo. Los históricos con '-' no coinciden.
msg.topic = [
    'SELECT m.Machine_IP AS source_ip, m.Machine_Nickname AS source_model,',
    's.Machine_Name AS source_machine_name, s.idx AS shot_idx, p.rec_idx AS recipe_idx,',
    "DATE_FORMAT(s.TimeStamp, '%Y-%m-%dT%H:%i:%s-03:00') AS shot_timestamp_iso,",
    's.Shot_Number, s.Additional_Info_1 AS archivo_historico, s.Cavity, s.NGmark,',
    's.Cycle_Time, s.Injection_Time, s.Filling_Time, s.Max_Injection_Pressure,',
    's.Max_Injection_Speed, s.Switch_Over_Position, s.Max_Switch_Over_Pressure,',
    's.Cushion_Position, s.Plasticizing_Time, s.Plasticizing_Position,',
    's.Average_Screw_RPM, s.Max_Screw_RPM, s.Average_Back_Pressure, s.Max_Back_Pressure,',
    's.Clamp_Close_Time, s.Clamp_open_time, s.Clamp_Open_Position, s.Resin_weight,',
    's.Barrel_Temperature_1, s.Barrel_Temperature_2, s.Barrel_Temperature_3,',
    's.Barrel_Temperature_4, s.Barrel_Temperature_5, s.Barrel_Temperature_6, s.Barrel_Temperature_7,',
    's.Mold_Temperature_1, s.Mold_Temperature_2, s.Mold_Temperature_3, s.Mold_Temperature_4,',
    's.Mold_Temperature_5, s.Mold_Temperature_6, s.Mold_Temperature_7, s.Mold_Temperature_8,',
    's.Mold_Temperature_9, s.Mold_Temperature_10, s.Mold_Temperature_11, s.Mold_Temperature_12,',
    's.Hopper_Temperature,',
    'p.Inj_Velocity, p.Inj_Pressure, p.Inj_Position, p.SOV_Time, p.SOV_Position,',
    'p.Hld_Pressure, p.Hld_Time, p.Hld_Vel, p.Chg_Position, p.Chg_Speed, p.BackPressure,',
    'p.Suckback_Position, p.Suckback_Speed, p.Barrel_Temperature, p.Mold_Temperature, p.Timer',
    'FROM disal_cms.itgr_machine_list AS m',
    'JOIN disal_cms.shot_data AS s ON s.idx = (',
    ' SELECT MAX(s2.idx) FROM disal_cms.shot_data AS s2',
    ' WHERE s2.Machine_Name = m.Machine_Nickname)',
    'JOIN disal_cms.shot_data_rec AS p ON p.rec_idx = s.idx',
    ' AND p.TimeStamp = s.TimeStamp AND p.Shot_Number = s.Shot_Number',
    " AND (p.Machine_Name = s.Machine_Name OR p.Machine_Name IN ('','-') OR p.Machine_Name IS NULL)",
    "WHERE m.Machine_IP IN ('172.16.0.141','172.16.0.143','172.16.0.144','172.16.0.145','172.16.0.146')",
    " AND m.Machine_Nickname <> '' AND m.Machine_Nickname <> '-'",
    ' AND (SELECT COUNT(*) FROM disal_cms.itgr_machine_list AS m2',
    '      WHERE m2.Machine_Nickname = m.Machine_Nickname) = 1'
].join('\\n');
msg.payload = [];
return msg;`,outputs:1,noerr:0,x:460,y:230,wires:[['envases_technical_mysql_v3']]},
  {id:'envases_technical_mysql_v3',type:'mysql',z:tabId,mydb:id('woojin_database'),name:'Woojin CMS · ciclos identificados',x:780,y:230,wires:[['envases_technical_merge_v3']]},
  {id:'envases_technical_merge_v3',type:'function',z:tabId,name:'Asignar ciclo sólo a IP verificada',func:`flow.set('envases_sql_busy_until',0);
const summary = msg.envasesSummary;
if (!summary || !Array.isArray(summary.maquinas)) return null;
const rows = Array.isArray(msg.payload) ? msg.payload : [];
const countsIp = {};
const countsShot = {};
for (const row of rows) {
    countsIp[row.source_ip] = (countsIp[row.source_ip] || 0) + 1;
    countsShot[row.shot_idx] = (countsShot[row.shot_idx] || 0) + 1;
}
const reasons = [];
const number = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};
const text = (v) => v === null || v === undefined ? null : String(v);
for (const row of rows) {
    const reading = summary.maquinas.find(item => item.machine_ip === row.source_ip);
    const shot = number(row.Shot_Number);
    const stamp = row.shot_timestamp_iso;
    const cavity = number(row.Cavity);
    const ngmark = number(row.NGmark);
    if (!reading || countsIp[row.source_ip] !== 1 || countsShot[row.shot_idx] !== 1 ||
        row.source_machine_name !== row.source_model || reading.modelo !== row.source_model ||
        number(row.shot_idx) !== number(row.recipe_idx) ||
        !Number.isInteger(shot) || shot < 0 ||
        (cavity !== null && (!Number.isInteger(cavity) || cavity < 0)) ||
        (ngmark !== null && (!Number.isInteger(ngmark) || ngmark < 0)) ||
        typeof stamp !== 'string' || !Number.isFinite(Date.parse(stamp)) ||
        Date.parse(stamp) > Date.now() + 30000) {
        reasons.push({machine_ip:row.source_ip,reason:'VINCULO_O_CICLO_INVALIDO'});
        continue;
    }
    reading.ultimo_ciclo_tecnico = {
        machine_ip:row.source_ip, identity_source:'CMS_MACHINE_NAME',
        shot_number:shot, timestamp:stamp, mold_name:text(row.archivo_historico),
        cavity, ngmark, cycle_time:number(row.Cycle_Time),
        injection_time:number(row.Injection_Time), filling_time:number(row.Filling_Time),
        max_injection_pressure:number(row.Max_Injection_Pressure), max_injection_speed:number(row.Max_Injection_Speed),
        switch_over_position:number(row.Switch_Over_Position), max_switch_over_pressure:number(row.Max_Switch_Over_Pressure),
        cushion_position:number(row.Cushion_Position), plasticizing_time:number(row.Plasticizing_Time),
        plasticizing_position:number(row.Plasticizing_Position), average_screw_rpm:number(row.Average_Screw_RPM),
        max_screw_rpm:number(row.Max_Screw_RPM), average_back_pressure:number(row.Average_Back_Pressure),
        max_back_pressure:number(row.Max_Back_Pressure), clamp_close_time:number(row.Clamp_Close_Time),
        clamp_open_time:number(row.Clamp_open_time), clamp_open_position:number(row.Clamp_Open_Position),
        resin_weight:number(row.Resin_weight),
        barrel_temperatures:Array.from({length:7},(_,i)=>number(row['Barrel_Temperature_' + (i+1)])),
        mold_temperatures:Array.from({length:12},(_,i)=>number(row['Mold_Temperature_' + (i+1)])),
        hopper_temperature:number(row.Hopper_Temperature),
        recipe:{
            inj_velocity:text(row.Inj_Velocity), inj_pressure:text(row.Inj_Pressure), inj_position:text(row.Inj_Position),
            sov_time:number(row.SOV_Time), sov_position:number(row.SOV_Position),
            hld_pressure:text(row.Hld_Pressure), hld_time:text(row.Hld_Time), hld_vel:text(row.Hld_Vel),
            chg_position:text(row.Chg_Position), chg_speed:text(row.Chg_Speed),
            back_pressure:text(row.BackPressure), suckback_position:text(row.Suckback_Position),
            suckback_speed:text(row.Suckback_Speed), barrel_temperature:text(row.Barrel_Temperature),
            mold_temperature:text(row.Mold_Temperature), timer:text(row.Timer)
        }
    };
}
msg.payload = summary;
const attached = summary.maquinas.filter(item => item.ultimo_ciclo_tecnico).length;
node.status({fill:attached ? 'green' : 'yellow',shape:'dot',text:attached + '/5 ciclos con IP verificada'});
return [msg,{payload:{technical_attached:attached,rows:rows.length,rejected:reasons,
    note:attached ? 'Machine_Name unido de forma unica al catalogo' : 'PENDIENTE_IDENTIFICAR_MAQUINA: CMS aun no entrega Machine_Name util; no escribir disparos por IP'}}];`,outputs:2,noerr:0,x:1090,y:230,wires:[[id('envases-disal-prepare'),'envases_influx_shot_prepare_v1'],['envases_technical_debug_v3']]},
  {id:'envases_technical_debug_v3',type:'debug',z:tabId,name:'Diagnóstico de atribución por IP',active:true,tosidebar:true,console:false,tostatus:false,complete:'payload',targetType:'msg',x:1400,y:260,wires:[]},
  {id:'envases_technical_error_v3',type:'catch',z:tabId,name:'Woojin · error consulta de ciclos',scope:['envases_technical_mysql_v3'],uncaught:false,x:470,y:290,wires:[['envases_technical_fallback_v3']]},
  {id:'envases_technical_fallback_v3',type:'function',z:tabId,name:'Enviar estados sin ciclos si falla SQL',func:`flow.set('envases_sql_busy_until',0);
if (!msg.envasesSummary) return [null,{payload:{status:'TECHNICAL_SQL_ERROR',message:'No se pudo recuperar resumen'}}];
msg.payload = msg.envasesSummary;
return [msg,{payload:{status:'TECHNICAL_SQL_ERROR',message:String(msg.error && msg.error.message || 'Error SQL').slice(0,180),technical_attached:0}}];`,outputs:2,noerr:0,x:770,y:290,wires:[[id('envases-disal-prepare')],['envases_technical_debug_v3']]},
  {id:'envases_sql_error_v2',type:'catch',z:tabId,name:'Woojin · error SQL',scope:[id('w5_mysql')],uncaught:false,x:520,y:260,wires:[['envases_sql_reset_v2']]},
  {id:'envases_sql_reset_v2',type:'function',z:tabId,name:'Woojin · liberar consulta',func:`flow.set('envases_sql_busy_until',0);\nreturn {payload:{status:'SQL_ERROR',message:String(msg.error && msg.error.message || 'Error SQL').slice(0,180)}};`,outputs:1,noerr:0,x:790,y:260,wires:[[id('w5_debug_influx')]]},
  {id:'envases_shot_comment_v2',type:'comment',z:tabId,name:'PENDIENTE: identificar inyectora de disparos antiguos',info:'shot_data y shot_data_rec no contienen IP; los registros históricos observados tenían Machine_Name = -. Esta rama consulta un solo par y sólo lo muestra en Debug: no llega a LATEX ni a InfluxDB por máquina. Después de identificar y verificar cada inyectora, configurar CMS para guardar Machine_Name igual al apodo único de itgr_machine_list. No inferir IP por archivo, contador u hora.',x:370,y:610,wires:[]},
  {id:'envases_shot_manual_v2',type:'inject',z:tabId,name:'Consultar último ciclo SIN atribución',props:[{p:'payload'}],repeat:'',crontab:'',once:false,onceDelay:0.1,payload:'',payloadType:'date',x:160,y:670,wires:[['envases_shot_sql_v2']]},
  {id:'envases_shot_sql_v2',type:'function',z:tabId,name:'SQL ciclo y receta sin IP',func:`msg.topic = [
    'SELECT s.idx, s.Machine_Name, s.Additional_Info_1 AS archivo_historico,',
    "DATE_FORMAT(s.TimeStamp, '%Y-%m-%dT%H:%i:%s-03:00') AS shot_timestamp_iso,",
    's.Shot_Number, s.Cavity, s.NGmark, s.Cycle_Time, s.Injection_Time, s.Filling_Time,',
    's.Max_Injection_Pressure, s.Max_Injection_Speed, s.Switch_Over_Position,',
    's.Max_Switch_Over_Pressure, s.Cushion_Position, s.Plasticizing_Time, s.Plasticizing_Position,',
    's.Average_Screw_RPM, s.Max_Screw_RPM, s.Average_Back_Pressure, s.Max_Back_Pressure,',
    's.Clamp_Close_Time, s.Clamp_open_time, s.Clamp_Open_Position, s.Resin_weight,',
    's.Barrel_Temperature_1, s.Barrel_Temperature_2, s.Barrel_Temperature_3,',
    's.Barrel_Temperature_4, s.Barrel_Temperature_5, s.Barrel_Temperature_6, s.Barrel_Temperature_7,',
    's.Mold_Temperature_1, s.Mold_Temperature_2, s.Mold_Temperature_3, s.Mold_Temperature_4,',
    's.Mold_Temperature_5, s.Mold_Temperature_6, s.Mold_Temperature_7, s.Mold_Temperature_8,',
    's.Mold_Temperature_9, s.Mold_Temperature_10, s.Mold_Temperature_11, s.Mold_Temperature_12,',
    's.Hopper_Temperature,',
    'p.Inj_Velocity, p.Inj_Pressure, p.Inj_Position, p.SOV_Time, p.SOV_Position,',
    'p.Hld_Pressure, p.Hld_Time, p.Hld_Vel, p.Chg_Position, p.Chg_Speed, p.BackPressure,',
    'p.Suckback_Position, p.Suckback_Speed, p.Barrel_Temperature, p.Mold_Temperature, p.Timer',
    'FROM disal_cms.shot_data AS s',
    'LEFT JOIN disal_cms.shot_data_rec AS p ON p.rec_idx = s.idx',
    'AND p.TimeStamp = s.TimeStamp AND p.Shot_Number = s.Shot_Number',
    'ORDER BY s.idx DESC LIMIT 1'
].join('\\n');
msg.payload = [];
return msg;`,outputs:1,noerr:0,x:420,y:670,wires:[['envases_shot_mysql_v2']]},
  {id:'envases_shot_mysql_v2',type:'mysql',z:tabId,mydb:id('woojin_database'),name:'Woojin CMS · último ciclo',x:690,y:670,wires:[['envases_shot_normalize_v2']]},
  {id:'envases_shot_normalize_v2',type:'function',z:tabId,name:'Marcar ciclo SIN IP',func:`const row = Array.isArray(msg.payload) ? msg.payload[0] : null;\nreturn {payload:row ? {atribucion:'NO_VERIFICADA',advertencia:'NO asignar a ninguna inyectora ni mostrar como archivo actual',ciclo:row} : {atribucion:'NO_VERIFICADA',status:'SIN_CICLO'}};`,outputs:1,noerr:0,x:930,y:670,wires:[['envases_shot_debug_v2']]},
  {id:'envases_shot_debug_v2',type:'debug',z:tabId,name:'Último ciclo sin IP · sólo diagnóstico',active:true,tosidebar:true,console:false,tostatus:false,complete:'payload',targetType:'msg',x:1220,y:670,wires:[]}
);

// Las ramas Influx son optativas y llegan apagadas. No comparten mediciones
// con el historial curado que escribe la API; tampoco reciben secretos por Debug.
const influxConfig = `const enabled = String(env.get('DISAL_ENVASES_INFLUX_WRITE_ENABLED') || '').toLowerCase() === 'true';
const base = String(env.get('DISAL_ENVASES_INFLUX_URL') || '').replace(/\\/$/, '');
const org = String(env.get('DISAL_ENVASES_INFLUX_ORG') || '');
const bucket = String(env.get('DISAL_ENVASES_INFLUX_BUCKET') || '');
const token = String(env.get('DISAL_ENVASES_INFLUX_TOKEN') || '');
if (!enabled || !/^https?:\\/\\/[^/?#]+$/.test(base) || !org || !bucket || !token) {
    node.status({fill:'yellow',shape:'ring',text:'Influx desactivado o incompleto'});
    return [null,{payload:{status:'INFLUX_NO_CONFIGURADO'}}];
}
const url = base + '/api/v2/write?org=' + encodeURIComponent(org) + '&bucket=' + encodeURIComponent(bucket) + '&precision=ms';
const catalog = {'172.16.0.141':['INY01','DL650G5'],'172.16.0.146':['INY02','DL450G5'],'172.16.0.143':['INY03','TB280G5-1'],'172.16.0.144':['INY04','TB280G5-2'],'172.16.0.145':['INY05','TB200G5']};
const valid = (r) => r && catalog[r.machine_ip] && catalog[r.machine_ip][0] === r.equipment_code && catalog[r.machine_ip][1] === r.modelo;
const num = (v) => typeof v === 'number' && Number.isFinite(v) ? v : null;
const str = (v) => typeof v === 'string' ? '"' + v.replace(/\\\\/g,'\\\\\\\\').replace(/"/g,'\\\\"').replace(/\\n/g,' ') + '"' : null;
const stamp = (v) => { const t = Date.parse(v); return Number.isFinite(t) && t <= Date.now() + 30000 ? t : null; };
const machines = msg.payload && Array.isArray(msg.payload.maquinas) ? msg.payload.maquinas : [];
const lines = [];
`;
const influxSend = `if (!lines.length) return [null,{payload:{status:'SIN_PUNTOS',kind,reason:kind === 'SHOT' ? 'PENDIENTE_IDENTIFICAR_MAQUINA para disparos sin Machine_Name' : 'SIN_FILAS_CMS_FRESCAS'}}];
node.status({fill:'green',shape:'dot',text:kind + ': ' + lines.length + ' puntos'});
return [{url,method:'POST',headers:{Authorization:'Token ' + token,'Content-Type':'text/plain; charset=utf-8'},payload:lines.join('\\n'),influxKind:kind,influxPoints:lines.length},null];`;
const statusFields = ['operation_status_code','motor_status_code','heater_status_code','alarm_status_code','cycle_time_before','cycle_time_current','production_time_hour','production_time_min','total_quantity','current_quantity','avg_quantity_per_hour'];
const shotFields = ['shot_number','cavity','ngmark','cycle_time','injection_time','filling_time','max_injection_pressure','max_injection_speed','switch_over_position','max_switch_over_pressure','cushion_position','plasticizing_time','plasticizing_position','average_screw_rpm','max_screw_rpm','average_back_pressure','max_back_pressure','clamp_close_time','clamp_open_time','clamp_open_position','resin_weight','hopper_temperature'];
function influxNode(nodeId, name, func, x, y, wires) {
  return {id:nodeId,type:'function',z:tabId,name,d:true,func,outputs:2,noerr:0,x,y,wires};
}
function influxHttp(nodeId, name, x, y, resultId) {
  return {id:nodeId,type:'http request',z:tabId,name,d:true,method:'use',ret:'txt',paytoqs:'ignore',url:'',tls:'',persist:false,proxy:'',insecureHTTPParser:false,authType:'',senderr:false,headers:[],timeout:'4000',x,y,wires:[[resultId]]};
}
nodes.push(
  {id:'envases_influx_comment_v1',type:'comment',z:tabId,name:'InfluxDB optativo · disparos sin identidad quedan pendientes',info:'Configurar DISAL_ENVASES_INFLUX_WRITE_ENABLED=true, DISAL_ENVASES_INFLUX_URL, DISAL_ENVASES_INFLUX_ORG, DISAL_ENVASES_INFLUX_BUCKET y DISAL_ENVASES_INFLUX_TOKEN en el entorno de Node-RED. Habilitar cada rama tras prueba manual. Estados: IP validada y fila fresca. Disparos: sólo Machine_Name que coincide de forma única con Machine_Nickname e IP validada. Los históricos con Machine_Name=- siguen PENDIENTE_IDENTIFICAR_MAQUINA y no se escriben por máquina. Mediciones raw separadas del historial curado de la API. Este sondeo de último disparo no garantiza capturar todos los ciclos.',x:410,y:790,wires:[]},
  influxNode('envases_influx_status_prepare_v1','Influx · estados por IP validada',influxConfig + `const kind = 'STATUS';
for (const r of machines) {
    if (!valid(r) || r.cms_row_fresh !== true) continue;
    const t = stamp(r.cms_timestamp);
    if (t === null) continue;
    const fields = [];
    for (const key of ${JSON.stringify(statusFields)}) { const v = num(r[key]); if (v !== null) fields.push(key + '=' + v); }
    if (fields.length) lines.push('woojin_nodered_status,machine=' + r.equipment_code + ',source=NODE_RED_ENVASES ' + fields.join(',') + ' ' + t);
}
` + influxSend,400,830,[['envases_influx_status_http_v1'],['envases_influx_debug_v1']]),
  influxNode('envases_influx_shot_prepare_v1','Influx · sólo disparo atribuido',influxConfig + `const kind = 'SHOT';
for (const r of machines) {
    const s = r.ultimo_ciclo_tecnico;
    if (!valid(r) || !s || s.machine_ip !== r.machine_ip || s.identity_source !== 'CMS_MACHINE_NAME') continue;
    const t = stamp(s.timestamp);
    if (t === null || !Number.isInteger(s.shot_number) || s.shot_number < 0) continue;
    const fields = [];
    for (const key of ${JSON.stringify(shotFields)}) { const v = num(s[key]); if (v !== null) fields.push(key + '=' + v); }
    const mold = str(s.mold_name); if (mold !== null) fields.push('mold_name=' + mold);
    for (const key of ['inj_velocity','inj_pressure','inj_position','hld_pressure','hld_time','hld_vel','chg_position','chg_speed','back_pressure','suckback_position','suckback_speed','barrel_temperature','mold_temperature','timer']) {
        const value = str(s.recipe && s.recipe[key]); if (value !== null) fields.push('recipe_' + key + '=' + value);
    }
    for (const key of ['sov_time','sov_position']) {
        const value = num(s.recipe && s.recipe[key]); if (value !== null) fields.push('recipe_' + key + '=' + value);
    }
    for (const [key,values] of [['barrel_temp',s.barrel_temperatures],['mold_temp',s.mold_temperatures]]) {
        if (Array.isArray(values)) values.forEach((value,index) => { const v = num(value); if (v !== null) fields.push(key + '_' + (index+1) + '=' + v); });
    }
    lines.push('woojin_nodered_shot,machine=' + r.equipment_code + ',source=NODE_RED_ENVASES ' + fields.join(',') + ' ' + t);
}
` + influxSend,400,880,[['envases_influx_shot_http_v1'],['envases_influx_debug_v1']]),
  influxHttp('envases_influx_status_http_v1','InfluxDB 2 · escribir estados',700,830,'envases_influx_status_result_v1'),
  influxHttp('envases_influx_shot_http_v1','InfluxDB 2 · escribir disparos',700,880,'envases_influx_shot_result_v1'),
  ...['status','shot'].map((kind) => ({id:`envases_influx_${kind}_result_v1`,type:'function',z:tabId,name:`Influx · resultado ${kind} sin credenciales`,d:true,func:`const code = Number(msg.statusCode);\nreturn {payload:{kind:msg.influxKind,points:msg.influxPoints,statusCode:code,status:code === 204 ? 'ESCRITO' : 'INFLUX_ERROR'}};`,outputs:1,noerr:0,x:970,y:kind==='status'?830:880,wires:[['envases_influx_debug_v1']]})),
  {id:'envases_influx_catch_v1',type:'catch',z:tabId,name:'Influx · error HTTP',d:true,scope:['envases_influx_status_http_v1','envases_influx_shot_http_v1'],uncaught:false,x:700,y:930,wires:[['envases_influx_error_v1']]},
  {id:'envases_influx_error_v1',type:'function',z:tabId,name:'Influx · error sin secretos',d:true,func:`return {payload:{status:'INFLUX_HTTP_ERROR',kind:msg.influxKind || 'UNKNOWN'}};`,outputs:1,noerr:0,x:970,y:930,wires:[['envases_influx_debug_v1']]},
  {id:'envases_influx_debug_v1',type:'debug',z:tabId,name:'Influx · diagnóstico sin credenciales',d:true,active:true,tosidebar:true,console:false,tostatus:false,complete:'payload',targetType:'msg',x:1260,y:880,wires:[]}
);

const output = path.join(dir, 'envases-woojin-externo-completo.json');
fs.writeFileSync(output, `${JSON.stringify(nodes, null, 2)}\n`);
console.log(output);
