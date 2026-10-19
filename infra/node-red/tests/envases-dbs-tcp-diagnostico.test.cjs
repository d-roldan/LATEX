const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const flow = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'examples', 'envases-dbs-tcp-diagnostico.json'), 'utf8'));
const byId = new Map(flow.map((node) => [node.id, node]));
assert.equal(byId.size, flow.length, 'Los IDs deben ser únicos');
assert.equal(flow.find((node) => node.type === 'tab').disabled, true);

for (const node of flow) {
  if (node.type !== 'tab') assert.equal(node.z, 'envases_dbs_tcp_probe_tab_v1');
  for (const output of node.wires || []) {
    for (const target of output) assert.ok(byId.has(target), `Cable sin destino: ${target}`);
  }
  if (node.type === 'inject') {
    assert.equal(node.once, false);
    assert.equal(node.repeat, '');
  }
}

assert.equal(flow.filter((node) => node.type === 'tcp request').length, 1);
assert.equal(flow.filter((node) => ['tcp out', 'http request', 'mysql', 'influxdb out'].includes(node.type)).length, 0);

const memory = new Map();
const flowContext = {
  get(key) { return memory.get(key); },
  set(key, value) { memory.set(key, value); },
};

function run(id, msg) {
  const code = byId.get(id).func;
  return new Function('msg', 'flow', code)(msg, flowContext);
}

const [open, openDiagnostic] = run('envases_dbs_tcp_prepare_v1', { payload: Date.now() });
assert.equal(open.host, '10.1.0.105');
assert.equal(open.port, 5000);
assert.equal(Object.hasOwn(open, 'payload'), false, 'La apertura no debe transmitir bytes');
assert.equal(openDiagnostic.payload.envio_bytes, 0);

assert.equal(run('envases_dbs_tcp_status_format_v1', { status: {} }), null);
const connected = run('envases_dbs_tcp_status_format_v1', { status: { fill: 'green', shape: 'dot', text: '1 connection' } });
assert.equal(connected.payload.evento, 'ESTADO_TCP');
assert.equal(flowContext.get('envases_dbs_tcp_probe_conectado'), true);

const [close, closeDiagnostic] = run('envases_dbs_tcp_reset_v1', { payload: Date.now() });
assert.equal(close.reset, true);
assert.equal(Object.hasOwn(close, 'payload'), false, 'El cierre no debe transmitir bytes');
assert.equal(closeDiagnostic.payload.envio_bytes, 0);

run('envases_dbs_tcp_status_format_v1', { status: { fill: 'grey', shape: 'ring', text: 'common.status.disconnected' } });
assert.equal(flowContext.get('envases_dbs_tcp_probe_conectado'), false);
const [secondClose, alreadyClosed] = run('envases_dbs_tcp_reset_v1', { payload: Date.now() });
assert.equal(secondClose, null, 'No se debe reiniciar un socket ya desconectado');
assert.equal(alreadyClosed.payload.evento, 'YA_DESCONECTADO');

const received = run('envases_dbs_tcp_received_v1', { payload: Buffer.alloc(1000, 65) });
assert.equal(received.payload.bytes, 1000);
assert.equal(received.payload.utf8.length, 300);
assert.equal(received.payload.hex.length, 128);
assert.equal(received.payload.truncado, true);

console.log('Flujo TCP DBS: estructura, apertura/cierre sin payload y vista acotada OK');
