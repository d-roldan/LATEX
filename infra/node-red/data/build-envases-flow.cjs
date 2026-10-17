// Genera el flujo importable y sustituye únicamente la pestaña ENVASES local.
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const source = fs.readFileSync(path.join(root, 'envases-simulator.function.js'), 'utf8');
const tab = 'envases-local-simulator';
const inject = (id, name, topic, y) => ({
  id, type: 'inject', z: tab, name, props: [{ p: 'topic', vt: 'str' }],
  repeat: '', crontab: '', once: false, onceDelay: 0.1, topic, payloadType: 'date',
  x: 190, y, wires: [['envases-local-build']]
});
const nodes = [
  { id: tab, type: 'tab', label: 'ENVASES Woojin · simulador LOCAL', disabled: false, info: 'Sin acceso a CMS ni equipos industriales.' },
  { ...inject('envases-local-inject', 'Tick cada 2 segundos (editable)', '', 80), repeat: '2', once: true },
  inject('envases-start-all', 'INICIAR TODAS', 'START_ALL', 140),
  inject('envases-stop-1', 'DETENER INYECTORA 1', 'STOP_1', 180),
  inject('envases-resume-1', 'REANUDAR INYECTORA 1', 'RESUME_1', 220),
  inject('envases-alarm-3', 'GENERAR ALARMA INYECTORA 3', 'ALARM_3', 260),
  inject('envases-clear-alarm-3', 'LIMPIAR ALARMA INYECTORA 3', 'CLEAR_ALARM_3', 300),
  inject('envases-lose-4', 'PÉRDIDA COMUNICACIÓN INYECTORA 4', 'LOSE_4', 340),
  inject('envases-recover-4', 'RECUPERAR COMUNICACIÓN INYECTORA 4', 'RECOVER_4', 380),
  inject('envases-reset-5', 'REINICIO CONTADOR INYECTORA 5', 'RESET_5', 420),
  inject('envases-restore', 'RESTAURAR ESCENARIO NORMAL', 'RESTORE_NORMAL', 460),
  { id: 'envases-local-build', type: 'function', z: tab, name: 'Simular cinco Woojin', func: source, outputs: 1, timeout: 0, noerr: 0, initialize: '', finalize: '', libs: [], x: 480, y: 200, wires: [['envases-local-http']] },
  { id: 'envases-local-http', type: 'http request', z: tab, name: 'POST API LATEX local', method: 'use', ret: 'obj', paytoqs: 'ignore', url: '', tls: '', persist: false, proxy: '', insecureHTTPParser: false, authType: '', senderr: true, timeout: '4000', headers: [], x: 730, y: 200, wires: [['envases-local-check']] },
  { id: 'envases-local-check', type: 'function', z: tab, name: 'Verificar recepción', func: "const body = msg.payload || {}; const ok = msg.statusCode >= 200 && msg.statusCode < 300 && body.accepted === msg.expectedCount && body.rejected === 0; node.status({ fill: ok ? 'green' : 'red', shape: ok ? 'dot' : 'ring', text: ok ? `${body.accepted}/5 aceptadas` : `envío fallido (${msg.statusCode || 'red'})` }); if (!ok) node.warn('Simulación ENVASES: lote no aceptado'); return null;", outputs: 1, timeout: 0, noerr: 0, initialize: '', finalize: '', libs: [], x: 950, y: 200, wires: [[]] },
  { id: 'envases-local-catch', type: 'catch', z: tab, name: 'Error de envío local', scope: ['envases-local-http'], uncaught: false, x: 720, y: 270, wires: [['envases-local-debug']] },
  { id: 'envases-local-debug', type: 'debug', z: tab, name: 'Errores HTTP ENVASES', active: true, tosidebar: true, console: false, tostatus: false, complete: 'error.message', targetType: 'msg', statusVal: '', statusType: 'auto', x: 970, y: 270, wires: [] },
  { id: 'envases-local-note', type: 'comment', z: tab, name: 'SOLO DEMO LOCAL · sin CMS, PLC ni equipos físicos · clave desde entorno', info: '', x: 330, y: 30, wires: [] }
];
const examplePath = path.join(root, 'examples', 'envases-woojin-simulator.json');
fs.mkdirSync(path.dirname(examplePath), { recursive: true });
fs.writeFileSync(examplePath, `${JSON.stringify(nodes, null, 2)}\n`);
const flowsPath = path.join(root, 'flows.json');
const existing = JSON.parse(fs.readFileSync(flowsPath, 'utf8'));
const retained = existing.filter((node) => node.id !== tab && node.z !== tab);
fs.writeFileSync(flowsPath, `${JSON.stringify([...retained, ...nodes], null, 2)}\n`);
console.log(`Generados ${nodes.length} nodos de ENVASES; conservados ${retained.length} nodos ajenos.`);
