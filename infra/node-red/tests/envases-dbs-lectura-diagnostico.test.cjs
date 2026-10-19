const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const nodes = JSON.parse(fs.readFileSync(path.join(__dirname, '../examples/envases-dbs-lectura-diagnostico.json')));
const byId = (suffix) => nodes.find((node) => node.id === `envases_dbs_read_probe_${suffix}_v1`);
const state = new Map();

function run(suffix, msg, at = 1000) {
  return vm.runInNewContext(`(function(){${byId(suffix).func}})()`, {
    msg,
    Buffer,
    Date: class extends Date { static now() { return at; } },
    flow: { get: (key) => state.get(key), set: (key, value) => state.set(key, value) }
  });
}

test('la pestaña manual está deshabilitada y sólo transmite la lectura confirmada', () => {
  state.clear();
  assert.equal(byId('tab').disabled, true);
  const inject = byId('inject');
  assert.equal(inject.repeat, '');
  const tcp = byId('tcp');
  assert.equal(tcp.server, '10.1.0.105');
  assert.equal(tcp.port, '5000');
  assert.equal(tcp.out, 'sit');
  const [request, timer, event] = run('prepare', {}, 1000);
  assert.equal(request.payload.toString(), '0,172.16.0.144');
  assert.equal(event.payload.bytes_solicitud, request.payload.length);
  assert.equal(timer.probe_run, request.probe_run);
  assert.equal(nodes.filter((node) => node.type === 'tcp request').length, 1);
  assert.equal(nodes.filter((node) => node.type === 'http request').length, 0);
  const ids = new Set(nodes.map((node) => node.id));
  for (const node of nodes) for (const row of node.wires || []) {
    for (const target of row) assert.ok(ids.has(target), `${node.id} → ${target}`);
  }
});

test('reúne bloques sin publicar valores y valida firma, IP y longitud', () => {
  state.clear();
  const [request, timer] = run('prepare', {}, 1000);
  const fields = Array(86).fill('0');
  fields[0] = '~';
  fields[1] = '172.16.0.144';
  const raw = `${fields.join(',')}*`;
  const first = run('inspect', { probe_run: request.probe_run, payload: Buffer.from(raw.slice(0, 20)) });
  assert.equal(first.payload.evento, 'DBS_BLOQUE_RECIBIDO');
  const second = run('inspect', { probe_run: request.probe_run, payload: Buffer.from(raw.slice(20)) });
  assert.equal(second.payload.evento, 'DBS_RESPUESTA_COMPLETA');
  assert.equal(second.payload.valida_tipo_0, true);
  assert.equal(second.payload.campos, 86);
  assert.equal(second.payload.bloques, 2);
  assert.equal(second.payload.bytes_acumulados, Buffer.byteLength(raw));
  assert.equal(JSON.stringify(second).includes('0,0,0'), false);
  run('status_format', { status: { fill: 'green', shape: 'dot', text: '1 connection' } });
  const [close, summary] = run('finish', timer);
  assert.equal(close.reset, true);
  assert.equal(Object.hasOwn(close, 'payload'), false);
  assert.equal(summary.payload.evento, 'DBS_PRUEBA_FINALIZADA');
});

test('sin bytes a los ocho segundos informa el resultado y cierra el socket', () => {
  state.clear();
  const [, timer] = run('prepare', {}, 1000);
  run('status_format', { status: { fill: 'green', shape: 'dot', text: '1 connection' } });
  const [close, summary] = run('finish', timer, 9000);
  assert.equal(close.reset, true);
  assert.equal(summary.payload.evento, 'DBS_SIN_BYTES_8S');
  assert.equal(summary.payload.bytes, 0);
});

test('si DBS ya cerró la conexión, evita resetear un socket nulo', () => {
  state.clear();
  const [, timer] = run('prepare', {}, 1000);
  run('status_format', { status: { fill: 'green', shape: 'dot', text: '1 connection' } });
  run('status_format', { status: { fill: 'grey', shape: 'ring', text: 'common.status.disconnected' } });
  const [close, summary] = run('finish', timer, 9000);
  assert.equal(close, null);
  assert.equal(summary.payload.evento, 'DBS_SIN_BYTES_8S');
  assert.equal(summary.payload.conexion_ya_cerrada, true);
});
