import { ConfigService } from '@nestjs/config';
import { InjectionHistoryService } from './injection-history.service';

describe('InjectionHistoryService', () => {
  const settings: Record<string, string> = {
    INFLUXDB_URL: 'http://influx:8086',
    INFLUXDB_TOKEN: 'test-token',
    INFLUXDB_ORG: 'disal',
    INFLUXDB_ENVASES_BUCKET: 'envases-test'
  };
  const config = { get: (key: string) => settings[key] } as ConfigService;
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('no escribe ni consulta si falta el bucket dedicado', async () => {
    const history = new InjectionHistoryService({
      get: () => undefined
    } as unknown as ConfigService);
    global.fetch = jest.fn();
    expect(
      await history.record(
        'INY01',
        'NODE_RED_ENVASES',
        {
          machine_ip: '172.16.0.141',
          cms_timestamp: new Date().toISOString(),
          current_quantity: 8
        },
        null
      )
    ).toBe(false);
    expect((await history.read('INY01', 'NODE_RED_ENVASES', 'cycle', 24)).status).toBe(
      'CONFIGURATION_PENDING'
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('escribe estado y temperaturas del disparo atribuido con tags de equipo y origen', async () => {
    const history = new InjectionHistoryService(config);
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    const recorded = await history.record(
      'INY02',
      'NODE_RED_ENVASES_SIM',
      {
        machine_ip: '172.16.0.146',
        cms_timestamp: '2026-10-18T02:00:00.000Z',
        current_quantity: 14,
        cycle_time_current: 21,
        cms_row_fresh: true
      },
      {
        shot_number: 321,
        timestamp: '2026-10-18T02:00:01.000Z',
        cycle_time: 21.2,
        barrel_temperatures: [0, 250.1, 250.1, 245.1, 245.1, 240, 44.6],
        hopper_temperature: 53.4,
        recipe: { barrel_temperature: '200/250/250/245/245/240/45/55' }
      }
    );
    expect(recorded).toBe(true);
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('bucket=envases-test');
    expect(options.body).toContain('woojin_status,machine=INY02,source=NODE_RED_ENVASES_SIM');
    expect(options.body).toContain('woojin_shot,machine=INY02,source=NODE_RED_ENVASES_SIM');
    expect(options.body).toContain('barrel_2_target=250');
    expect(options.body).toContain('barrel_2_measured=250.1');
    expect(options.body).toContain('hopper_target=55');
  });

  it('no registra lecturas declaradas obsoletas', async () => {
    const history = new InjectionHistoryService(config);
    global.fetch = jest.fn();
    expect(
      await history.record(
        'INY01',
        'NODE_RED_ENVASES',
        {
          machine_ip: '172.16.0.141',
          cms_timestamp: '2026-10-18T02:00:00.000Z',
          cms_row_fresh: false
        },
        null
      )
    ).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('registra pares de temperatura DBS sólo para una lectura aceptada y fresca', async () => {
    const history = new InjectionHistoryService(config);
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    const reading = {
      machine_ip: '172.16.0.141',
      telemetry_origin: 'DBS_API' as const,
      cms_timestamp: '2026-10-19T12:00:00.000Z',
      cms_row_fresh: true,
      current_quantity: 42,
      dbs_temperature_zones: [{ zone: 'EXT_NOZZLE', current: 249.5, setting: 250 }]
    };
    expect(await history.record('INY01', 'NODE_RED_ENVASES', reading, null)).toBe(true);
    const body = (global.fetch as jest.Mock).mock.calls[0][1].body;
    expect(body).toContain('woojin_dbs_temperature,machine=INY01,source=NODE_RED_ENVASES');
    expect(body).toContain('ext_nozzle_current=249.5');
    expect(body).toContain('ext_nozzle_setting=250');
    expect(await history.record('INY01', 'NODE_RED_ENVASES', reading, null, false)).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('registra un disparo nuevo aunque real_data repita su timestamp', async () => {
    const history = new InjectionHistoryService(config);
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    expect(
      await history.record(
        'INY01',
        'NODE_RED_ENVASES',
        { machine_ip: '172.16.0.141', cms_timestamp: '2026-10-18T02:00:00.000Z' },
        { shot_number: 322, timestamp: '2026-10-18T02:00:02.000Z', cycle_time: 24 },
        false
      )
    ).toBe(true);
    const body = (global.fetch as jest.Mock).mock.calls[0][1].body;
    expect(body).toContain('woojin_shot,machine=INY01');
    expect(body).not.toContain('woojin_status');
  });

  it('lee y une ajuste y medición de la misma marca de tiempo', async () => {
    const history = new InjectionHistoryService(config);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        '#datatype,string,long,dateTime:RFC3339,string,double\n,result,table,_time,_field,_value\n,,0,2026-10-18T02:00:01Z,barrel_2_target,250\n,,0,2026-10-18T02:00:01Z,barrel_2_measured,250.1\n'
    });
    const result = await history.read('INY02', 'NODE_RED_ENVASES', 'temperature', 24, 2);
    expect(result.status).toBe('AVAILABLE');
    expect(result.points).toEqual([
      { timestamp: '2026-10-18T02:00:01Z', target: 250, measured: 250.1 }
    ]);
    expect((global.fetch as jest.Mock).mock.calls[0][1].body).toContain('r.machine == "INY02"');
  });
});
