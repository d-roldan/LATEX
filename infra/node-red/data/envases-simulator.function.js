// Fuente del Function node local. Regenerar los JSON con build-envases-flow.cjs.
if (String(env.get('DISAL_ENABLE_ENVASES_SIMULATOR')).toLowerCase() !== 'true') {
  node.status({ fill: 'grey', shape: 'ring', text: 'simulador deshabilitado' });
  return null;
}
const key = env.get('ENVASES_SIM_NODE_RED_KEY');
if (!key) {
  node.status({ fill: 'red', shape: 'ring', text: 'falta clave local' });
  return null;
}
const profiles = [
  { code: 'INY05', ip: '172.16.0.141', model: 'DL650G5', cycle: 26, count: 11429, total: 65110, hours: 20, mold: 'ENV-650-A', cavity: 8, mode: 'AUTO', running: true, heater: true, alarm: 0 },
  { code: 'INY04', ip: '172.16.0.146', model: 'DL450G5', cycle: 21, count: 8372, total: 52180, hours: 16, mold: 'ENV-450-B', cavity: 6, mode: 'AUTO', running: true, heater: true, alarm: 0 },
  { code: 'INY03', ip: '172.16.0.143', model: 'TB280G5-1', cycle: 24, count: 4328, total: 18320, hours: 9, mold: 'ENV-280-C', cavity: 4, mode: 'MANUAL', running: false, heater: true, alarm: 0 },
  { code: 'INY02', ip: '172.16.0.144', model: 'TB280G5-2', cycle: 21, count: 13270, total: 74410, hours: 23, mold: 'ENV-280-D', cavity: 4, mode: 'AUTO', running: true, heater: true, alarm: 0 },
  { code: 'INY01', ip: '172.16.0.145', model: 'TB200G5', cycle: 18, count: 6670, total: 29940, hours: 12, mold: 'ENV-200-E', cavity: 2, mode: 'PARO', running: false, heater: false, alarm: 204 }
];
const now = Date.now();
const round = (value, digits = 1) => Number(value.toFixed(digits));
const cycleValue = (p, shot) => round(p.cycle + Math.sin(shot * 0.73 + p.cavity) * 0.35);
const technical = (p, shot, stamp, duration) => {
  const wave = Math.sin(shot * 0.37 + p.cavity);
  return {
    shot_number: shot, timestamp: new Date(stamp).toISOString(), machine_ip: p.ip,
    identity_source: 'SIMULATED', cycle_time: duration,
    mold_name: p.mold, cavity: p.cavity, ngmark: 0,
    injection_time: round(duration * 0.16 + wave * 0.1), filling_time: round(duration * 0.09 + wave * 0.05),
    max_injection_pressure: round(78 + p.cavity * 2 + wave * 3), max_injection_speed: round(38 + p.cavity + wave * 2),
    switch_over_position: round(22 + p.cavity + wave), max_switch_over_pressure: round(71 + p.cavity * 2 + wave * 2),
    cushion_position: round(4.2 + wave * 0.2), plasticizing_time: round(duration * 0.42 + wave * 0.2),
    plasticizing_position: round(48 + p.cavity + wave), average_screw_rpm: round(105 + p.cavity * 2 + wave * 3),
    max_screw_rpm: round(128 + p.cavity * 2 + wave * 4), average_back_pressure: round(8 + wave * 0.5),
    max_back_pressure: round(10 + wave * 0.5), clamp_close_time: round(duration * 0.11 + wave * 0.05),
    clamp_open_time: round(duration * 0.10 + wave * 0.05), clamp_open_position: round(155 + p.cavity * 3 + wave),
    resin_weight: round(p.cavity * 12 + wave * 0.6),
    barrel_temperatures: Array.from({ length: 7 }, (_, zone) => round(192 + zone * 3 + wave * 0.6)),
    mold_temperatures: Array.from({ length: 12 }, (_, zone) => round(38 + (zone % 4) * 1.4 + wave * 0.3)),
    hopper_temperature: round(34 + wave * 0.3),
    recipe: {
      inj_velocity: `${round(84 + wave)}/${round(91 + wave)}/${round(95 + wave)}`,
      inj_pressure: `${round(101 + wave)}/${round(105 + wave)}/${round(108 + wave)}`,
      inj_position: `${round(84 + wave)}/${round(43 + wave)}/${round(22 + wave)}`,
      sov_time: round(duration * 0.12 + wave * 0.02, 2),
      sov_position: round(22 + p.cavity + wave),
      hld_pressure: `${round(68 + wave)}/${round(61 + wave)}`,
      hld_time: '1.5/2.0', hld_vel: '28/22',
      chg_position: `${round(52 + p.cavity + wave)}/${round(84 + p.cavity + wave)}`,
      chg_speed: '75/65', back_pressure: '8/10',
      suckback_position: '4/7', suckback_speed: '24/20',
      barrel_temperature: [...Array.from({ length: 7 }, (_, zone) => 192 + zone * 3), 34].join('/'),
      mold_temperature: Array.from({ length: 12 }, (_, zone) => round(38 + (zone % 4) * 1.4)).join('/'),
      timer: `${round(duration * 0.16, 2)}/${round(duration * 0.42, 2)}`
    }
  };
};
const states = flow.get('envases_sim_state_v2') || {};
for (const p of profiles) {
  if (!states[p.code]) {
    const initialShot = p.count;
    states[p.code] = {
      mode: p.mode, running: p.running, heater: p.heater, alarm: p.alarm, connected: true,
      current: p.count, total: p.total, productionMs: p.hours * 3600000,
      shot: initialShot, lastTick: now, elapsedMs: p.running ? p.cycle * 500 : 0,
      currentCycle: cycleValue(p, initialShot + 1), previousCycle: cycleValue(p, initialShot),
      lastIncrementAt: p.running ? now - p.cycle * 500 : null,
      lastTechnical: technical(p, initialShot, now - p.cycle * 1000, cycleValue(p, initialShot))
    };
  }
}
switch (msg.topic) {
  case 'START_ALL':
    for (const p of profiles) Object.assign(states[p.code], { mode: 'AUTO', running: true, heater: true, alarm: 0, connected: true, lastTick: now });
    break;
  case 'STOP_1': Object.assign(states.INY01, { mode: 'PARO', running: false, lastTick: now }); break;
  case 'RESUME_1': Object.assign(states.INY01, { mode: 'AUTO', running: true, alarm: 0, lastTick: now }); break;
  case 'ALARM_3': Object.assign(states.INY03, { mode: 'PARO', running: false, alarm: 303, lastTick: now }); break;
  case 'CLEAR_ALARM_3': Object.assign(states.INY03, { mode: 'MANUAL', running: false, alarm: 0, lastTick: now }); break;
  case 'LOSE_4': states.INY04.connected = false; break;
  case 'RECOVER_4': Object.assign(states.INY04, { connected: true, lastTick: now }); break;
  case 'RESET_5':
    states.INY05.pendingReset = -states.INY05.current;
    states.INY05.current = 0;
    states.INY05.lastIncrementAt = null;
    break;
  case 'RESTORE_NORMAL':
    for (const p of profiles) Object.assign(states[p.code], { mode: p.mode, running: p.running, heater: p.heater, alarm: p.alarm, connected: true, lastTick: now, pendingReset: 0 });
    break;
}
const maquinas = [];
for (const p of profiles) {
  const s = states[p.code];
  const elapsed = Math.max(0, Math.min(10000, now - s.lastTick));
  s.lastTick = now;
  let delta = s.pendingReset || 0;
  s.pendingReset = 0;
  if (s.connected && s.running && s.mode === 'AUTO' && s.alarm === 0) {
    s.elapsedMs += elapsed;
    s.productionMs += elapsed;
    while (s.elapsedMs >= s.currentCycle * 1000) {
      s.elapsedMs -= s.currentCycle * 1000;
      s.current += 1;
      s.total += 1;
      s.shot += 1;
      delta += 1;
      s.lastIncrementAt = now;
      s.previousCycle = s.currentCycle;
      s.lastTechnical = technical(p, s.shot, now, s.previousCycle);
      s.currentCycle = cycleValue(p, s.shot + 1);
    }
  }
  if (!s.connected) continue;
  const recent = s.lastIncrementAt !== null && now - s.lastIncrementAt <= 60000;
  maquinas.push({
    machine_ip: p.ip, equipment_code: p.code, modelo: p.model, machine_name_cms: `INYECTORA ${Number(p.code.slice(3))}`,
    simulated: true, cms_timestamp: new Date(now).toISOString(), cms_age_seconds: 0, cms_row_fresh: true,
    adquisicion_industrial_fresca: 'SIMULADA', operation_status_code: s.mode === 'AUTO' ? 1 : s.mode === 'MANUAL' ? 2 : 0,
    operation_status_text: s.mode, motor_status_code: s.running ? 1 : 0, motor_status_text: s.running ? 'RUN' : 'STOP',
    heater_status_code: s.heater ? 1 : 0, heater_status_text: s.heater ? 'ON' : 'OFF', alarm_status_code: s.alarm,
    cycle_time_current: s.currentCycle, cycle_time_before: s.previousCycle,
    production_time_hour: Math.floor(s.productionMs / 3600000), production_time_min: Math.floor((s.productionMs % 3600000) / 60000),
    current_quantity: s.current, total_quantity: s.total,
    avg_quantity_per_hour: s.running && s.mode === 'AUTO' && s.alarm === 0 ? round(3600 / s.currentCycle) : 0,
    delta_contador_observado: delta,
    tipo_cambio_contador: delta < 0 ? 'REINICIO_O_RETROCESO_CONTADOR' : delta > 0 ? 'INCREMENTO_DETECTADO' : 'SIN_CAMBIO',
    actividad_inferida: recent && s.running ? 'INCREMENTO_RECIENTE' : 'SIN_INCREMENTO_RECIENTE',
    ultimo_incremento_detectado: s.lastIncrementAt === null ? null : new Date(s.lastIncrementAt).toISOString(),
    ultimo_ciclo_tecnico: s.lastTechnical
  });
}
flow.set('envases_sim_state_v2', states);
msg.method = 'POST';
msg.url = 'http://disal-nginx/api/plants/ENVASES/telemetry/injection-machines';
msg.headers = { 'content-type': 'application/json', 'x-node-red-key': key };
msg.expectedCount = maquinas.length;
msg.payload = {
  source: 'NODE_RED_ENVASES_SIM', mode: 'SIMULATION', simulated: true, schemaVersion: 1,
  fecha_recepcion_nodered: new Date(now).toISOString(), cantidad_filas_sql: 0,
  cantidad_maquinas_frescas_cms: maquinas.length, aviso: 'SIMULACION_LOCAL', maquinas
};
node.status({ fill: 'blue', shape: 'dot', text: `${maquinas.length}/5 inyectoras simuladas` });
return msg;
