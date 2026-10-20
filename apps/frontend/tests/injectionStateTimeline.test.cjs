const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(
  path.join(__dirname, '../src/features/plant/injectionStateTimeline.ts'),
  'utf8'
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS }
}).outputText;
const moduleTarget = { exports: {} };
new Function('module', 'exports', compiled)(moduleTarget, moduleTarget.exports);
const { injectionStateTimeline } = moduleTarget.exports;

test('alterna verde y rojo y deja gris un corte de comunicación', () => {
  const now = Date.parse('2026-10-19T13:00:00Z');
  const points = [
    { timestamp: '2026-10-19T12:00:00Z', value: 1 },
    { timestamp: '2026-10-19T12:00:30Z', value: 1 },
    { timestamp: '2026-10-19T12:01:00Z', value: 0 },
    { timestamp: '2026-10-19T12:10:00Z', value: 1 }
  ];
  const segments = injectionStateTimeline(points, 1, now);
  assert.deepEqual(
    segments.map(({ state }) => state),
    ['producing', 'stopped', 'unknown', 'producing', 'unknown']
  );
  assert.equal(segments[1].end, Date.parse('2026-10-19T12:02:30Z'));
});

test('un modo inválido no se dibuja como producción', () => {
  const now = Date.parse('2026-10-19T13:00:00Z');
  assert.deepEqual(
    injectionStateTimeline([{ timestamp: '2026-10-19T12:30:00Z', value: 2 }], 1, now),
    [{ start: now - 3_600_000, end: now, state: 'unknown' }]
  );
});
