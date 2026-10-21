const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dataDir = path.join(__dirname, '../data');
const nodes = JSON.parse(fs.readFileSync(path.join(dataDir, 'flows.json'), 'utf8'));
const simulator = nodes.find((node) => node.id === 'envases-local-build');
assert.ok(simulator, 'Debe existir el simulador local');
assert.equal(simulator.func, fs.readFileSync(path.join(dataDir, 'envases-simulator.function.js'), 'utf8'));
const controls = nodes.filter((item) => item.z === 'envases-local-simulator' && item.type === 'inject');
assert.equal(controls.length, 10);

let now = Date.parse('2026-10-16T18:46:28.000Z');
const state = new Map();
class Clock extends Date { static now() { return now; } }
const simulate = vm.runInNewContext(`(function(msg, env, flow, node) { ${simulator.func} })`, { Date: Clock, Math, Number, String, Array, Object });
const flow = { get: (key) => state.get(key), set: (key, value) => state.set(key, value) };
const node = { status: () => {} };
const enabled = { get: (key) => key === 'DISAL_ENABLE_ENVASES_SIMULATOR' ? 'true' : key === 'ENVASES_SIM_NODE_RED_KEY' ? 'clave-local-de-prueba' : undefined };
const tick = (topic, ms = 0) => { now += ms; return simulate({ topic }, enabled, flow, node).payload; };
const byCode = (batch, code) => batch.maquinas.find((reading) => reading.equipment_code === code);

const first = tick('');
assert.equal(first.source, 'NODE_RED_ENVASES_SIM');
assert.equal(first.mode, 'SIMULATION');
assert.equal(first.simulated, true);
assert.equal(first.maquinas.length, 5);
assert.deepEqual(Array.from(first.maquinas, (reading) => reading.operation_status_text), ['AUTO', 'AUTO', 'MANUAL', 'AUTO', 'PARO']);
assert.deepEqual(Array.from(first.maquinas, (reading) => reading.cycle_time_current).map(Math.round), [26, 21, 24, 21, 18]);
assert.equal(byCode(first, 'INY01').alarm_status_code, 204);
assert.equal(byCode(first, 'INY05').ultimo_ciclo_tecnico.barrel_temperatures.length, 7);
assert.equal(byCode(first, 'INY05').ultimo_ciclo_tecnico.mold_temperatures.length, 12);
assert.equal(byCode(first, 'INY05').ultimo_ciclo_tecnico.machine_ip, '172.16.0.141');
assert.equal(byCode(first, 'INY05').ultimo_ciclo_tecnico.identity_source, 'SIMULATED');
assert.equal(byCode(first, 'INY05').ultimo_ciclo_tecnico.recipe.inj_velocity.split('/').length, 3);
assert.equal(byCode(first, 'INY05').ultimo_ciclo_tecnico.recipe.barrel_temperature.split('/').length, 8);
assert.equal(byCode(first, 'INY05').ultimo_ciclo_tecnico.recipe.mold_temperature.split('/').length, 12);

let latest = first;
for (let index = 0; index < 16; index += 1) latest = tick('', 2000);
for (const code of ['INY05', 'INY04', 'INY02']) {
  const before = byCode(first, code);
  const after = byCode(latest, code);
  assert.ok(after.current_quantity > before.current_quantity);
  assert.equal(after.total_quantity - before.total_quantity, after.current_quantity - before.current_quantity);
  assert.ok(after.ultimo_ciclo_tecnico.shot_number > before.ultimo_ciclo_tecnico.shot_number);
}
for (const code of ['INY03', 'INY01']) {
  assert.equal(byCode(latest, code).current_quantity, byCode(first, code).current_quantity);
  assert.equal(byCode(latest, code).ultimo_ciclo_tecnico.timestamp, byCode(first, code).ultimo_ciclo_tecnico.timestamp);
}
const beforeStop = byCode(latest, 'INY01');
tick('STOP_1');
latest = tick('', 30000);
assert.equal(byCode(latest, 'INY01').current_quantity, beforeStop.current_quantity);
assert.equal(byCode(latest, 'INY01').ultimo_ciclo_tecnico.timestamp, beforeStop.ultimo_ciclo_tecnico.timestamp);
assert.equal(byCode(tick('RESUME_1'), 'INY01').operation_status_text, 'AUTO');
assert.equal(byCode(tick('ALARM_3'), 'INY03').alarm_status_code, 303);
assert.equal(byCode(tick('CLEAR_ALARM_3'), 'INY03').operation_status_text, 'MANUAL');
latest = tick('LOSE_4');
assert.equal(latest.maquinas.length, 4);
assert.equal(byCode(latest, 'INY04'), undefined);
assert.equal(tick('RECOVER_4').maquinas.length, 5);
const totalBeforeReset = byCode(latest, 'INY05').total_quantity;
latest = tick('RESET_5');
assert.equal(byCode(latest, 'INY05').current_quantity, 0);
assert.ok(byCode(latest, 'INY05').delta_contador_observado < 0);
assert.equal(byCode(latest, 'INY05').total_quantity, totalBeforeReset);
assert.ok(tick('START_ALL').maquinas.every((reading) => reading.operation_status_text === 'AUTO'));
latest = tick('RESTORE_NORMAL');
assert.deepEqual(Array.from(latest.maquinas, (reading) => reading.operation_status_text), ['AUTO', 'AUTO', 'MANUAL', 'AUTO', 'PARO']);
assert.equal(simulate({}, { get: () => 'false' }, flow, node), null);
console.log('Simulador ENVASES: ciclos, controles, pérdida de señal, contador y aislamiento coherentes.');
