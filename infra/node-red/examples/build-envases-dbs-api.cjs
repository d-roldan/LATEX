// Genera un flujo independiente. La pestaña importada permanece deshabilitada.
const fs = require('node:fs');
const path = require('node:path');

const machines = [
  ['INY01', 'DL650G5', '172.16.0.141'],
  ['INY02', 'DL450G5', '172.16.0.146'],
  ['INY03', 'TB280G5-1', '172.16.0.143'],
  ['INY04', 'TB280G5-2', '172.16.0.144'],
  ['INY05', 'TB200G5', '172.16.0.145']
];
const tab = 'envases_dbs_api_tab_v1';
const id = (name) => `envases_dbs_api_${name}_v1`;
const nodes = [{
  id: tab, type: 'tab', label: 'ENVASES · DBS API (solo lectura)', disabled: true,
  info: 'Solicitudes exactas observadas en DBA: 0,<IP>, 8,<IP>, 2,<IP>. Confirmar proceso DBS y conectividad antes de habilitar. Desactivar el flujo SQL anterior para evitar dos publicadores de NODE_RED_ENVASES.'
}];
function add(name, type, label, x, y, props = {}, wires = []) {
  nodes.push({id: id(name), type, z: tab, name: label, x, y, ...props, wires: wires.map((row) => row.map(id))});
}
add('comment','comment','LEER: DBS confirmado en 10.1.0.105:5000; activar manualmente',370,60,
  {info:'La pestaña se importa deshabilitada. La API pública de ApiDisal no se usa: el envío requiere X-Node-Red-Key. Solo salen los tipos de lectura 0, 8 y 2. Ningún comando D/SET/control está presente. Antes de habilitar, desactivar el publicador SQL previo y configurar DISAL_API_BASE_URL y DISAL_ENVASES_INTEGRATION_KEY en el entorno Node-RED.'});
add('tick','inject','Consultar cinco máquinas cada 8 s',170,150,
  {props:[{p:'payload'}],repeat:'8',crontab:'',once:false,onceDelay:0.1,payload:'',payloadType:'date'},[['prepare']]);
add('prepare','function','Iniciar una consulta por máquina',420,150,{
  func:`const machines = ${JSON.stringify(machines)};
const host = '10.1.0.105';
const requests = [];
const notices = [];
const round = Date.now();
for (const [code, model, ip] of machines) {
  const busy = flow.get('dbs_busy_' + ip);
  if (busy && round - busy.started < 15000) continue;
  if (busy) notices.push({payload:{evento:'DBS_SIN_RESPUESTA',ip,tipo:busy.kind,espera_ms:round-busy.started}});
  flow.set('dbs_busy_' + ip,{round,started:round,kind:'0'});
  requests.push({host, port: 5000, machine_ip: ip, equipment_code: code, modelo: model, kind:'0', round, payload: Buffer.from('0,' + ip, 'ascii')});
}
notices.push({payload:{evento:'DBS_RONDA_INICIADA',consultas:requests.length,round}});
return [requests,notices];`, outputs:2, noerr:0},[['route'],['debug']]);
add('route','switch','Una conexión por máquina',670,150,
  {property:'machine_ip',propertyType:'msg',rules:machines.map(([, , ip])=>({t:'eq',v:ip,vt:'str'})),checkall:'true',repair:false,outputs:5},
  machines.map(([code])=>[`tcp_${code}`]));
for (const [index,[code]] of machines.entries()) {
  add(`tcp_${code}`,'tcp request',`${code} · DBS TCP 5000`,920,140+70*index,
    {server:'',port:'',out:'char',ret:'string',splitc:'*',newline:'',trim:false,tls:''},[['decode']]);
}
add('next_delay','delay','Separar consultas de la misma IP',480,310,
  {pauseType:'delay',timeout:'0.1',timeoutUnits:'seconds',rate:'1',nbRateUnits:'1',rateUnits:'second',randomFirst:'1',randomLast:'5',randomUnits:'seconds',drop:false,allowrate:false},[['route']]);
add('decode','function','Decodificar y vincular por IP',1170,150,{
  func:`const known = ${JSON.stringify(Object.fromEntries(machines.map(([code,model,ip])=>[ip,{code,model}])))};
const ip = msg.machine_ip;
const kind = msg.kind;
const identity = known[ip];
const raw = String(msg.payload ?? '');
const error = (reason) => {
  if (identity && flow.get('dbs_busy_' + ip)?.round === msg.round) flow.set('dbs_busy_' + ip,null);
  return [null,null,{payload:{evento:'DBS_RESPUESTA_RECHAZADA',ip,kind,reason}}];
};
if (!identity || flow.get('dbs_busy_' + ip)?.round !== msg.round) return error('Respuesta fuera de la ronda activa');
if (!identity || !['0','8','2'].includes(kind) || raw.length > 8192 || !raw.endsWith('*')) return error('Identidad, tipo o terminador inválido');
const fields = raw.slice(0,-1).split(',');
const marker = {0:'~',8:'%',2:'@'}[kind];
const length = {0:86,8:5,2:62}[kind];
if (fields.length !== length || fields[0] !== marker || fields[1] !== ip) return error('Firma, longitud o IP de respuesta inesperada');
const int = (v) => /^-?\\d+$/.test(v) ? Number(v) : null;
const number = (v) => /^-?\\d+(?:\\.\\d+)?$/.test(v) ? Number(v) : null;
const valid = (v) => v === null || Number.isFinite(v);
let value;
if (kind === '0') {
  value = {motor:int(fields[9]),heater:int(fields[10]),mode:int(fields[11]),cycle:number(fields[12]),before:number(fields[13]),hours:int(fields[14]),minutes:int(fields[15]),target:int(fields[16]),current:int(fields[17]),hourly:number(fields[18]),alarm:int(fields[25]),temps:fields.slice(35,43).map(number)};
  if ([value.motor,value.heater,value.mode,value.cycle,value.before,value.hours,value.minutes,value.target,value.current,value.hourly,value.alarm,...value.temps].some(v=>!valid(v))) return error('Número inválido');
} else if (kind === '8') {
  value = {defective:int(fields[4])};
  if (!valid(value.defective)) return error('Cantidad defectuosa inválida');
} else {
  const settings = fields[15].split('/').map(number);
  if (settings.length !== 8 || settings.some(v=>!valid(v))) return error('Ocho consignas requeridas');
  value = {settings};
}
const now = Date.now();
const key = 'dbs_' + ip;
const previousRound = flow.get(key);
const saved = previousRound && previousRound.round === msg.round ? previousRound : {round:msg.round};
saved[kind] = {at:now,value};
flow.set(key,saved);
if (kind === '8' && !saved['0']) return error('Falta la respuesta 0 de esta ronda');
if (kind === '2' && !['0','8'].every(k=>saved[k] && now-saved[k].at < 8000)) return error('Ronda incompleta u obsoleta');
if (kind !== '2') {
  const next = kind === '0' ? '8' : '2';
  flow.set('dbs_busy_' + ip,{round:msg.round,started:now,kind:next});
  msg.kind = next;
  msg.payload = Buffer.from(next + ',' + ip,'ascii');
  return [msg,null,{payload:{evento:'DBS_RESPUESTA_VALIDADA',ip,tipo:kind,campos:fields.length}}];
}
const status = saved['0'].value;
const defects = saved['8'].value;
const settings = saved['2'].value.settings;
const zones = ['EXT_NOZZLE','NOZZLE','HEATER_1','HEATER_2','HEATER_3','HEATER_4','OIL','HOPPER'];
const timestamp = new Date(now).toISOString();
const modeText = {1:'AUTO',2:'SEMI AUTO',3:'MANUAL',4:'MANUAL'}[status.mode] || 'STOP';
const reading = {machine_ip:ip,equipment_code:identity.code,modelo:identity.model,telemetry_origin:'DBS_API',cms_timestamp:timestamp,cms_row_fresh:true,adquisicion_industrial_fresca:'NO_VERIFICADA',operation_status_code:status.mode,operation_status_text:modeText,motor_status_code:status.motor,motor_status_text:status.motor>0?'RUN':'STOP',heater_status_code:status.heater,heater_status_text:status.heater>0?'RUN':'STOP',alarm_status_code:status.alarm,cycle_time_current:status.cycle,cycle_time_before:status.before,production_time_hour:status.hours,production_time_min:status.minutes,target_quantity:status.target,current_quantity:status.current,avg_quantity_per_hour:status.hourly,defective_quantity:defects.defective,dbs_temperature_zones:zones.map((zone,i)=>({zone,current:status.temps[i],setting:settings[i]}))};
if (reading.current_quantity !== null && (reading.current_quantity < 0 || reading.current_quantity > 1000000000)) return error('Contador fuera de rango');
const previous = flow.get('dbs_counter_' + ip);
if (previous && Number.isInteger(previous.value) && Number.isInteger(reading.current_quantity)) {
  const delta = reading.current_quantity - previous.value;
  reading.delta_contador_observado = delta;
  reading.tipo_cambio_contador = delta < 0 ? 'REINICIO_O_CAMBIO' : delta > 0 ? 'INCREMENTO' : 'SIN_CAMBIO';
  reading.ultimo_incremento_detectado = delta > 0 ? timestamp : previous.lastIncrement || null;
  reading.actividad_inferida = delta > 0 ? 'PRODUCCION_INFERIDA' : 'SIN_INCREMENTO_OBSERVADO';
}
flow.set('dbs_counter_' + ip, {value:reading.current_quantity,lastIncrement:reading.ultimo_incremento_detectado || previous?.lastIncrement || null});
flow.set('dbs_busy_' + ip,null);
msg.payload = {source:'NODE_RED_ENVASES',schemaVersion:1,fecha_recepcion_nodered:timestamp,maquinas:[reading]};
delete msg.host; delete msg.port;
return [null,msg,{payload:{evento:'DBS_LOTE_PREPARADO',ip,modelo:identity.model,round:msg.round}}];`, outputs:3, noerr:0},[['next_delay'],['post_prepare'],['debug']]);
add('post_prepare','function','Clave y URL de ApiDisal',1430,130,{
  func:`const base = env.get('DISAL_API_BASE_URL');
const key = env.get('DISAL_ENVASES_INTEGRATION_KEY');
if (!base || !/^https?:\\/\\//.test(base) || !key || key.length < 32) { node.warn('Faltan URL o clave de integración ENVASES'); return null; }
msg.url = base.replace(/\\/$/,'') + '/plants/ENVASES/telemetry/injection-machines';
msg.method = 'POST';
msg.headers = {'Content-Type':'application/json','X-Node-Red-Key':key};
return msg;`,outputs:1,noerr:0},[['http','reading_debug']]);
add('reading_debug','debug','Lectura decodificada · activar para ver datos',1650,250,
  {active:false,tosidebar:true,console:false,tostatus:false,complete:'payload',targetType:'msg'},[]);
add('http','http request','POST ApiDisal ENVASES',1650,130,
  {method:'use',ret:'obj',paytoqs:'ignore',url:'',tls:'',persist:false,proxy:'',insecureHTTPParser:false,authType:'',senderr:false},[['http_check']]);
add('http_check','function','Verificar aceptación y persistencia',1850,130,{
  func:`let body = msg.payload || {};
if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
if (msg.statusCode !== 200 && msg.statusCode !== 201) {
  const messages = Array.isArray(body.message) ? body.message : typeof body.message === 'string' ? [body.message] : [];
  return {payload:{evento:'ERROR_API',status:msg.statusCode,ip:msg.machine_ip,
    motivo:typeof body.error === 'string' ? body.error.slice(0,80) : null,
    validacion:messages.slice(0,8).map(value=>String(value).slice(0,180)),
    total_errores:messages.length}};
}
if (body.accepted !== 1 || body.rejected || !body.persisted) return {payload:{evento:'API_RECEPCION_PARCIAL',ip:msg.machine_ip,accepted:body.accepted,rejected:body.rejected,persisted:body.persisted}};
return {payload:{evento:'API_ACEPTADA',ip:msg.machine_ip,persisted:true}};`,outputs:1,noerr:0},[['debug']]);
add('catch','catch','Errores TCP y HTTP',920,540,{scope:[...machines.map(([code])=>id(`tcp_${code}`)),id('http')],uncaught:false},[['catch_format']]);
add('catch_format','function','Error resumido',1190,540,{
  func:`if (msg.machine_ip && flow.get('dbs_busy_' + msg.machine_ip)?.round === msg.round) flow.set('dbs_busy_' + msg.machine_ip,null);
return {payload:{evento:'ERROR_ENVASES_DBS',ip:msg.machine_ip||null,tipo:msg.kind||null,error:String(msg.error?.message||'Error de conexión').slice(0,160)}};`,outputs:1,noerr:0},[['debug']]);
add('debug','debug','Errores y avisos, sin payload industrial',1480,270,
  {active:true,tosidebar:true,console:false,tostatus:false,complete:'payload',targetType:'msg'},[]);
const file = path.join(__dirname,'envases-dbs-api-solo-lectura.json');
fs.writeFileSync(file, JSON.stringify(nodes,null,2) + '\n');
console.log(file);
