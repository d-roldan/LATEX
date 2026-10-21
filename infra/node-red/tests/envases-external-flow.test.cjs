const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '../examples/envases-woojin-externo-completo.json');
const nodes = JSON.parse(fs.readFileSync(file, 'utf8'));
const byId = new Map(nodes.map((item) => [item.id, item]));
const id = (base) => `${base}_externo_v2`;

assert.equal(byId.get('envases_woojin_live_v2').disabled, true);
assert.equal(byId.get(id('w5_auto_5s')).d, true);
assert.equal(nodes.filter((item) => item.type === 'mysql').length, 3);
assert.equal(nodes.filter((item) => item.type === 'http request').length, 3);
assert.equal(nodes.some((item) => item.type === 'influxdb out'), false);
for (const branch of ['status','shot']) {
  assert.equal(byId.get(`envases_influx_${branch}_prepare_v1`).d, true);
  assert.equal(byId.get(`envases_influx_${branch}_http_v1`).d, true);
}
for (const item of nodes) {
  for (const output of item.wires || []) {
    for (const target of output) assert.ok(byId.has(target), `Cable sin nodo: ${target}`);
  }
}
assert.equal(byId.get(id('woojin_database')).user, undefined);
assert.equal(byId.get(id('woojin_database')).password, undefined);
const guide = fs.readFileSync(path.join(__dirname, '../../../docs/FLUJO_NODERED_EXTERNO_ENVASES.md'), 'utf8');
const embedded = guide.match(/## JSON listo para Import → Clipboard[\s\S]*?```json\s*([\s\S]*?)\s*```/);
assert.ok(embedded, 'La guía debe contener el JSON completo');
assert.deepEqual(JSON.parse(embedded[1]), nodes);

function run(base, msg, store = {}, local = {}, envValues = {}) {
  const item = byId.get(base);
  const flow = { get: (key) => store[key], set: (key, value) => (store[key] = value) };
  const context = { get: (key) => local[key], set: (key, value) => (local[key] = value) };
  const node = { status: () => {} };
  const env = {
    get: (key) => Object.hasOwn(envValues,key) ? envValues[key] :
      key === 'DISAL_API_BASE_URL'
        ? 'http://localhost:8081/api/'
        : key === 'DISAL_ENVASES_INTEGRATION_KEY'
          ? 'clave-de-prueba'
          : undefined
  };
  return new Function('msg', 'flow', 'context', 'node', 'env', item.func)(
    msg,
    flow,
    context,
    node,
    env
  );
}

const state = {};
const local = {};
const currentSql = run(id('w5_sql'), { payload: 'SELECT * FROM secreto' }, state).topic;
assert.match(currentSql, /FROM disal_cms\.real_data AS r/);
assert.match(currentSql, /JOIN disal_cms\.itgr_machine_list/);
assert.match(currentSql, /DATE_FORMAT\(r\.Time_Stamp/);
assert.doesNotMatch(currentSql, /secreto/);
assert.equal(run(id('w5_sql'), {}, state), null);

const stamp = '2026-10-17T10:00:00-03:00';
const row = {
  Machine_IP: '172.16.0.141',
  Machine_Name: '-',
  Modelo: 'DL650G5',
  cms_timestamp_iso: stamp,
  cms_age_seconds: 2,
  Operation_Status: 1,
  Motor_Status: 1,
  Heater_Status: 1,
  Alarm_Status: 0,
  Cycle_Time_Current: '26.3',
  Cycle_Time_Before: '26.1',
  Production_Time_Hour: 10,
  Production_Time_Min: 4,
  Current_Quantity: 100,
  Total_Quantity: 1000,
  Avg_Quantity_Per_Hour: 120
};
let result = run(id('w5_normalize'), { payload: [row], woojin_inicio_ms: Date.now() - 5 }, state, local);
assert.equal(result[0].payload.maquinas.length, 1);
assert.equal(result[0].payload.maquinas[0].modelo, 'DL650G5');
assert.equal(result[0].payload.maquinas[0].cms_timestamp, stamp);
assert.equal(result[0].payload.maquinas[0].current_quantity, 100);
assert.equal(result[0].payload.maquinas[0].ultimo_ciclo_tecnico, undefined);
assert.ok(state.envases_sql_busy_until > Date.now());

const technicalSqlMessage = run('envases_technical_sql_v3', { payload: result[0].payload }, state);
assert.match(technicalSqlMessage.topic, /FROM disal_cms\.itgr_machine_list AS m/);
assert.match(technicalSqlMessage.topic, /s2\.Machine_Name = m\.Machine_Nickname/);
assert.match(technicalSqlMessage.topic, /p\.rec_idx = s\.idx/);
const withoutNames = run('envases_technical_merge_v3', { ...technicalSqlMessage, payload: [] }, state);
assert.equal(withoutNames[1].payload.technical_attached, 0);
assert.equal(state.envases_sql_busy_until, 0);

const stale = run(id('w5_normalize'), { payload: [{ ...row, cms_age_seconds: 30000 }] }, state, local);
assert.equal(stale[0].payload.maquinas[0].cms_row_fresh, false);
assert.equal(stale[0].payload.maquinas.length, 1);
assert.equal(stale[0].payload.estado_origen, 'REAL_DATA_DESACTUALIZADA');
assert.match(stale[0].payload.aviso, /NO el estado actual/);
assert.deepEqual(stale[0].payload.filas_desactualizadas.map(item => item.machine_ip), ['172.16.0.141']);
for (const [code,expected] of [[0,'PARO'],[1,'AUTO'],[2,'SEMI AUTO'],[3,'MANUAL'],[4,'MANUAL']]) {
  const reading = run(id('w5_normalize'), {payload:[{...row,Operation_Status:code}]}, {}, {});
  assert.equal(reading[0].payload.maquinas[0].operation_status_text,expected);
}

const duplicate = run(id('w5_normalize'), { payload: [row, row] }, state, local);
assert.equal(duplicate[0].payload.maquinas.length, 1);
assert.equal(duplicate[2].payload.problemas[0].tipo, 'IP_DESCONOCIDA_O_REPETIDA');

const five = [
  ['172.16.0.141', 'DL650G5', 'INY05'],
  ['172.16.0.146', 'DL450G5', 'INY04'],
  ['172.16.0.143', 'TB280G5-1', 'INY03'],
  ['172.16.0.144', 'TB280G5-2', 'INY02'],
  ['172.16.0.145', 'TB200G5', 'INY01']
];
const all = run(
  id('w5_normalize'),
  { payload: five.map(([Machine_IP, Modelo]) => ({ ...row, Machine_IP, Modelo })) },
  state,
  local
);
assert.deepEqual(
  all[0].payload.maquinas.map(({ machine_ip, modelo, equipment_code }) => [
    machine_ip,
    modelo,
    equipment_code
  ]),
  five
);

result = run(
  id('w5_normalize'),
  { payload: [{ ...row, cms_timestamp_iso: '2026-10-17T10:00:05-03:00', Current_Quantity: 105 }] },
  state,
  local
);
assert.equal(result[0].payload.maquinas[0].delta_contador_observado, 5);
assert.equal(result[1][0].payload.evento, 'INCREMENTO_DETECTADO');

const technicalRow = {
  source_ip: '172.16.0.141',
  source_model: 'DL650G5',
  source_machine_name: 'DL650G5',
  shot_idx: 145266,
  recipe_idx: 145266,
  shot_timestamp_iso: '2026-10-17T10:00:05-03:00',
  Shot_Number: 917889,
  archivo_historico: 'cuerpo_4l_iml_JCA.db',
  Cavity: 4,
  NGmark: 0,
  Cycle_Time: 26.1,
  Inj_Velocity: '80/90',
  SOV_Time: 2.4,
  Barrel_Temperature_1: 190,
  Mold_Temperature_1: 38
};
const technicalInput = run('envases_technical_sql_v3', { payload: result[0].payload }, state);
const merged = run('envases_technical_merge_v3', { ...technicalInput, payload: [technicalRow] }, state);
assert.equal(merged[1].payload.technical_attached, 1);
assert.equal(merged[0].payload.maquinas[0].ultimo_ciclo_tecnico.machine_ip, '172.16.0.141');
assert.equal(merged[0].payload.maquinas[0].ultimo_ciclo_tecnico.identity_source, 'CMS_MACHINE_NAME');
assert.equal(merged[0].payload.maquinas[0].ultimo_ciclo_tecnico.recipe.inj_velocity, '80/90');
assert.equal(merged[0].payload.maquinas[0].ultimo_ciclo_tecnico.barrel_temperatures.length, 7);
const influxEnv = {
  DISAL_ENVASES_INFLUX_WRITE_ENABLED:'true',
  DISAL_ENVASES_INFLUX_URL:'http://influx:8086',
  DISAL_ENVASES_INFLUX_ORG:'disal',
  DISAL_ENVASES_INFLUX_BUCKET:'envases',
  DISAL_ENVASES_INFLUX_TOKEN:'token-de-prueba'
};
const influxStatus = run('envases_influx_status_prepare_v1', {payload:result[0].payload}, {}, {}, influxEnv);
assert.match(influxStatus[0].url,/\/api\/v2\/write\?org=disal&bucket=envases&precision=ms/);
assert.match(influxStatus[0].payload,/woojin_nodered_status,machine=INY05,source=NODE_RED_ENVASES /);
assert.match(influxStatus[0].payload,/current_quantity=105/);
assert.equal(influxStatus[0].headers.Authorization,'Token token-de-prueba');
const unidentified = structuredClone(result[0].payload);
for (const machine of unidentified.maquinas) delete machine.ultimo_ciclo_tecnico;
const noShot = run('envases_influx_shot_prepare_v1', {payload:unidentified}, {}, {}, influxEnv);
assert.equal(noShot[0],null);
assert.match(noShot[1].payload.reason,/PENDIENTE_IDENTIFICAR_MAQUINA/);
const influxShot = run('envases_influx_shot_prepare_v1', {payload:merged[0].payload}, {}, {}, influxEnv);
assert.match(influxShot[0].payload,/woojin_nodered_shot,machine=INY05,source=NODE_RED_ENVASES /);
assert.match(influxShot[0].payload,/shot_number=/);
assert.equal(JSON.stringify(influxShot[1]).includes('token-de-prueba'),false);
const influxResult = run('envases_influx_shot_result_v1',{...influxShot[0],statusCode:204,payload:''});
assert.equal(influxResult.payload.status,'ESCRITO');
assert.equal(JSON.stringify(influxResult).includes('token-de-prueba'),false);
const noConfig = run('envases_influx_status_prepare_v1',{payload:result[0].payload});
assert.equal(noConfig[0],null);
assert.equal(noConfig[1].payload.status,'INFLUX_NO_CONFIGURADO');
const staleInflux = structuredClone(result[0].payload);
staleInflux.maquinas[0].cms_row_fresh = false;
assert.equal(run('envases_influx_status_prepare_v1',{payload:staleInflux},{},{},influxEnv)[0],null);
const prepared = run(id('envases-disal-prepare'), merged[0], state);
assert.equal(prepared[0].url, 'http://localhost:8081/api/plants/ENVASES/telemetry/injection-machines');
assert.equal(prepared[0].payload.source, 'NODE_RED_ENVASES');
assert.equal(prepared[0].payload.maquinas.length, 1);
assert.deepEqual(Object.keys(prepared[0].payload).sort(), [
  'source','schemaVersion','fecha_recepcion_nodered','cantidad_filas_sql',
  'cantidad_maquinas_frescas_cms','duracion_consulta_ms','aviso','maquinas'
].sort());
assert.equal('estado_origen' in prepared[0].payload,false);
assert.equal('filas_desactualizadas' in prepared[0].payload,false);
assert.equal(prepared[0].headers['x-node-red-key'], 'clave-de-prueba');
const httpResult = run(
  id('envases-disal-result'),
  { ...prepared[0], statusCode: 201, payload: { accepted: 1, rejected: 0, ignored: 0 } },
  state
);
assert.equal(httpResult[1].payload.accepted, 1);
assert.equal(state.envases_http_busy_until, 0);
assert.equal(JSON.stringify(httpResult[1]).includes('clave-de-prueba'), false);
const validationResult = run(id('envases-disal-result'), {
  ...prepared[0], statusCode:400,
  payload:{message:['property estado_origen should not exist','detalle privado']}
}, state);
assert.deepEqual(validationResult[1].payload.validation,['property estado_origen should not exist']);
assert.equal(JSON.stringify(validationResult[1]).includes('detalle privado'),false);

const freshSummary = structuredClone(result[0].payload);
for (const machine of freshSummary.maquinas) delete machine.ultimo_ciclo_tecnico;
const badInput = run('envases_technical_sql_v3', { payload: freshSummary }, state);
const bad = run(
  'envases_technical_merge_v3',
  { ...badInput, payload: [{ ...technicalRow, source_machine_name: '-' }] },
  state
);
assert.equal(bad[1].payload.technical_attached, 0);
assert.equal(bad[0].payload.maquinas[0].ultimo_ciclo_tecnico, undefined);

const duplicatedSummary = structuredClone(all[0].payload);
const duplicatedInput = run('envases_technical_sql_v3', { payload: duplicatedSummary }, state);
const duplicated = run(
  'envases_technical_merge_v3',
  { ...duplicatedInput, payload: [technicalRow, { ...technicalRow, source_ip: '172.16.0.146', source_model: 'DL450G5', source_machine_name: 'DL450G5' }] },
  state
);
assert.equal(duplicated[1].payload.technical_attached, 0);

const failedSummary = structuredClone(all[0].payload);
const fallback = run(
  'envases_technical_fallback_v3',
  { envasesSummary: failedSummary, error: { message: 'SQL offline' } },
  state
);
assert.equal(fallback[0].payload.maquinas.length, 5);
assert.equal(fallback[1].payload.status, 'TECHNICAL_SQL_ERROR');

const shotSql = run('envases_shot_sql_v2', {}).topic;
assert.match(shotSql, /FROM disal_cms\.shot_data AS s/);
assert.match(shotSql, /JOIN disal_cms\.shot_data_rec AS p/);
assert.match(shotSql, /ORDER BY s\.idx DESC LIMIT 1/);
assert.equal(byId.get('envases_shot_mysql_v2').wires[0][0], 'envases_shot_normalize_v2');
assert.equal(byId.get('envases_shot_normalize_v2').wires[0][0], 'envases_shot_debug_v2');
assert.equal(
  run('envases_shot_normalize_v2', { payload: [{ Machine_Name: '-', archivo_historico: 'x.db' }] })
    .payload.atribucion,
  'NO_VERIFICADA'
);

console.log('Flujo externo: estructura, SQL fijo, lectura, contador, API y diagnóstico OK');
