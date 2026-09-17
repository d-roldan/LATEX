import { InfluxHistoryService } from './influx-history.service';

describe('InfluxHistoryService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('informa configuración pendiente sin consultar la red', async () => {
    const service = new InfluxHistoryService({ get: jest.fn() } as never);
    const fetchSpy = jest.spyOn(global, 'fetch');

    const result = await service.readWeightSeries(
      'TK101',
      new Date('2026-09-17T10:00:00.000Z'),
      new Date('2026-09-17T11:00:00.000Z')
    );

    expect(result.status).toBe('CONFIGURATION_PENDING');
    expect(result.points).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('consulta, reduce y convierte la serie de peso de InfluxDB', async () => {
    const values: Record<string, string> = {
      INFLUXDB_URL: 'http://influx:8086/',
      INFLUXDB_TOKEN: 'secret-token',
      INFLUXDB_ORG: 'disal',
      INFLUXDB_BUCKET: 'planta',
      INFLUXDB_WEIGHT_MEASUREMENT: 'pesos',
      INFLUXDB_TANK_TAG: 'tanque',
      INFLUXDB_WEIGHT_FIELD: 'bruto'
    };
    const config = {
      get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback)
    } as never;
    const csv = [
      '#datatype,string,long,dateTime:RFC3339,double',
      ',result,table,_time,_value',
      ',_result,0,2026-09-17T10:00:00Z,1000.5',
      ',_result,0,2026-09-17T10:01:00Z,1012.25'
    ].join('\n');
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(csv)
    } as never);
    const service = new InfluxHistoryService(config);

    const result = await service.readWeightSeries(
      'TK101',
      new Date('2026-09-17T10:00:00.000Z'),
      new Date('2026-09-17T11:00:00.000Z')
    );

    expect(result).toMatchObject({
      status: 'AVAILABLE',
      lastTimestamp: '2026-09-17T10:01:00.000Z',
      points: [
        { timestamp: '2026-09-17T10:00:00.000Z', grossKg: 1000.5 },
        { timestamp: '2026-09-17T10:01:00.000Z', grossKg: 1012.25 }
      ]
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://influx:8086/api/v2/query?org=disal',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Token secret-token' })
      })
    );
    expect(String(fetchSpy.mock.calls[0][1]?.body)).toContain('r["tanque"] == "TK101"');
  });

  it('resuelve el tanque desde el nombre del field cuando no existe un tag', async () => {
    const values: Record<string, string> = {
      INFLUXDB_URL: 'http://influx:8086',
      INFLUXDB_TOKEN: 'secret-token',
      INFLUXDB_ORG_ID: 'a1ad9773507fd2a6',
      INFLUXDB_BUCKET: 'LATEX',
      INFLUXDB_WEIGHT_MEASUREMENT: 'PESOS_TANQUES_LATEX',
      INFLUXDB_TANK_TAG: '',
      INFLUXDB_WEIGHT_FIELD: 'PESO_{scaleKey}'
    };
    const config = {
      get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback)
    } as never;
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: jest
        .fn()
        .mockResolvedValue(',result,table,_time,_value\n,_result,0,2026-09-17T10:00:00Z,1000.5')
    } as never);
    const service = new InfluxHistoryService(config);

    await service.readWeightSeries(
      'TK101',
      new Date('2026-09-17T10:00:00.000Z'),
      new Date('2026-09-17T11:00:00.000Z')
    );

    const query = String(fetchSpy.mock.calls[0][1]?.body);
    expect(query).toContain('r._field == "PESO_TK101"');
    expect(query).not.toContain('r["scaleKey"]');
    expect(fetchSpy.mock.calls[0][0]).toBe(
      'http://influx:8086/api/v2/query?orgID=a1ad9773507fd2a6'
    );
  });
});
