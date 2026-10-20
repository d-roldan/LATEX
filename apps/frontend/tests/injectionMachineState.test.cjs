const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(
  path.join(__dirname, '../src/features/plant/injectionMachineState.ts'),
  'utf8'
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS }
}).outputText;
const moduleTarget = { exports: {} };
new Function('module', 'exports', compiled)(moduleTarget, moduleTarget.exports);
const { injectionMachineState } = moduleTarget.exports;

test('AUTO vigente se muestra Produciendo', () => {
  assert.deepEqual(injectionMachineState(true, ' auto '), {
    label: 'Produciendo',
    cardClass: 'is-producing'
  });
});

test('MANUAL, PARO y STOP vigentes se muestran Detenida', () => {
  for (const mode of ['MANUAL', 'PARO', 'STOP']) {
    assert.deepEqual(injectionMachineState(true, mode), {
      label: 'Detenida',
      cardClass: 'is-stopped'
    });
  }
});

test('sin lectura reciente o con modo desconocido no afirma producción', () => {
  assert.equal(injectionMachineState(false, 'AUTO').label, 'Sin datos recientes');
  assert.equal(injectionMachineState(true, 'SEMI AUTO').label, 'Estado no informado');
});
