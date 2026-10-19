const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const flow = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../examples/envases-dbs-api-solo-lectura.json'))
);
const prepare = flow.find((node) => node.id === 'envases_dbs_api_prepare_v1');
const decode = flow.find((node) => node.id === 'envases_dbs_api_decode_v1');
const postPrepare = flow.find((node) => node.id === 'envases_dbs_api_post_prepare_v1');
const httpCheck = flow.find((node) => node.id === 'envases_dbs_api_http_check_v1');
const state = new Map();

function run(source, msg, at = Date.now()) {
  const context = {
    msg,
    Buffer,
    Date: class extends Date {
      static now() {
        return at;
      }
    },
    flow: { get: (key) => state.get(key), set: (key, value) => state.set(key, value) }
  };
  return vm.runInNewContext(`(function(){${source}})()`, context);
}

function response(ip, kind) {
  const count = { 0: 86, 8: 5, 2: 62 }[kind];
  const fields = Array(count).fill('0');
  fields[0] = { 0: '~', 8: '%', 2: '@' }[kind];
  fields[1] = ip;
  if (kind === '0') {
    fields[9] = '1'; fields[10] = '1'; fields[11] = '1';
    fields[12] = '25.0'; fields[13] = '26.0'; fields[14] = '4';
    fields[15] = '31'; fields[16] = '100'; fields[17] = '42';
    fields[18] = '12'; fields[25] = '0';
    fields[23] = '10litros_jca.db';
    for (let index = 35; index < 43; index += 1) fields[index] = String(200 + index - 35);
  }
  if (kind === '8') fields[4] = '2';
  if (kind === '2') fields[15] = '210/211/212/213/214/215/216/217';
  return `${fields.join(',')}*`;
}

test('prepara sólo cinco solicitudes 0, una por IP, y cinco nodos TCP independientes', () => {
  state.clear();
  const [requests, diagnostics] = run(prepare.func, {}, 1000);
  assert.equal(requests.length, 5);
  assert.equal(new Set(requests.map((request) => request.machine_ip)).size, 5);
  assert.ok(requests.every((request) => request.payload.toString() === `0,${request.machine_ip}`));
  assert.equal(diagnostics[0].payload.evento, 'DBS_RONDA_INICIADA');
  assert.equal(flow.filter((node) => node.type === 'tcp request').length, 5);
  assert.ok(flow.filter((node) => node.type === 'tcp request').every((node) => node.splitc === '*'));
});

test('el JSON se importa deshabilitado y todas las conexiones internas existen', () => {
  assert.equal(flow.find((node) => node.type === 'tab').disabled, true);
  const ids = new Set(flow.map((node) => node.id));
  for (const node of flow) for (const output of node.wires || []) {
    for (const target of output) assert.ok(ids.has(target), `${node.id} → ${target}`);
  }
});

test('cada máquina consulta 0 → 8 → 2 y recién entonces prepara el POST', () => {
  state.clear();
  const msg = run(prepare.func, {}, 1000)[0][0];
  const ip = msg.machine_ip;
  msg.payload = response(ip, '0');
  let result = run(decode.func, msg, 1100);
  assert.equal(result[0].payload.toString(), `8,${ip}`);
  assert.equal(result[2].payload.evento, 'DBS_RESPUESTA_VALIDADA');
  msg.payload = response(ip, '8');
  result = run(decode.func, msg, 1200);
  assert.equal(result[0].payload.toString(), `2,${ip}`);
  msg.payload = response(ip, '2');
  result = run(decode.func, msg, 1300);
  assert.equal(result[0], null);
  const reading = result[1].payload.maquinas[0];
  assert.equal(reading.equipment_code, 'INY01');
  assert.equal(reading.current_quantity, 42);
  assert.equal(reading.defective_quantity, 2);
  assert.equal(reading.current_file_name, '10litros_jca.db');
  assert.equal(reading.dbs_temperature_zones[0].current, 200);
  assert.equal(reading.dbs_temperature_zones[0].setting, 210);
  assert.equal(result[2].payload.evento, 'DBS_LOTE_PREPARADO');
});

test('conserva vacío el archivo no informado y rechaza nombres inválidos', () => {
  state.clear();
  const msg = run(prepare.func, {}, 1000)[0][0];
  const fields = response(msg.machine_ip, '0').slice(0, -1).split(',');
  fields[23] = '';
  msg.payload = `${fields.join(',')}*`;
  let result = run(decode.func, msg, 1100);
  assert.equal(result[0].payload.toString(), `8,${msg.machine_ip}`);
  msg.payload = response(msg.machine_ip, '8');
  result = run(decode.func, msg, 1200);
  msg.payload = response(msg.machine_ip, '2');
  result = run(decode.func, msg, 1300);
  assert.equal(result[1].payload.maquinas[0].current_file_name, null);
  state.clear();
  const invalid = run(prepare.func, {}, 2000)[0][0];
  fields[23] = 'x'.repeat(101);
  invalid.payload = `${fields.join(',')}*`;
  result = run(decode.func, invalid, 2100);
  assert.equal(result[0], null);
  assert.equal(result[2].payload.reason, 'Nombre de archivo inválido');
});

test('rechaza una IP distinta y no continúa la secuencia', () => {
  state.clear();
  const msg = run(prepare.func, {}, 1000)[0][1];
  msg.payload = response('172.16.0.141', '0');
  const result = run(decode.func, msg, 1100);
  assert.equal(result[0], null);
  assert.equal(result[2].payload.evento, 'DBS_RESPUESTA_RECHAZADA');
});

test('informa falta de respuesta y reintenta sin mezclar rondas', () => {
  state.clear();
  const first = run(prepare.func, {}, 1000)[0][0];
  assert.equal(run(prepare.func, {}, 9000)[0].length, 0);
  const [requests, diagnostics] = run(prepare.func, {}, 17000);
  assert.equal(requests.length, 5);
  assert.ok(diagnostics.some((msg) => msg.payload.evento === 'DBS_SIN_RESPUESTA'));
  first.payload = response(first.machine_ip, '0');
  assert.equal(run(decode.func, first, 17100)[2].payload.reason, 'Respuesta fuera de la ronda activa');
});

test('publica en la base /api configurada sin duplicar el prefijo', () => {
  const msg = { payload: { source: 'NODE_RED_ENVASES' } };
  const env = {
    get: (key) => (key === 'DISAL_API_BASE_URL' ? 'http://api.local/api' : 'x'.repeat(32))
  };
  const result = vm.runInNewContext(`(function(){${postPrepare.func}})()`, {
    msg, env, node: { warn() {} }
  });
  assert.equal(result.url, 'http://api.local/api/plants/ENVASES/telemetry/injection-machines');
});

test('ofrece la lectura decodificada sólo al activar su Debug y muestra el motivo del 400', () => {
  const readingDebug = flow.find((node) => node.id === 'envases_dbs_api_reading_debug_v1');
  assert.equal(readingDebug.active, false);
  assert.ok(postPrepare.wires[0].includes(readingDebug.id));
  const result = run(httpCheck.func, {
    statusCode: 400,
    machine_ip: '172.16.0.144',
    payload: { error: 'Bad Request', message: ['property telemetry_origin should not exist', 'property dbs_temperature_zones should not exist'] }
  });
  assert.equal(result.payload.evento, 'ERROR_API');
  assert.equal(result.payload.total_errores, 2);
  assert.equal(result.payload.validacion[0], 'property telemetry_origin should not exist');
});
