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

  it.each([
    ['LATEX_VIEJO', 'LV01', 'LATEX_VIEJO', 'PESOS_LATEX_VIEJO', 'PESO_LV01'],
    ['TERPLAST', 'TERP01', 'TERPLAST', 'PESOS_TERPLAST', 'PESO_TERP01'],
    ['SLURRY', 'SLURRY01', 'SLURRY', 'PESOS_SLURRY', 'PESO_SLURRY01'],
    ['ENDUIDO', 'END01', 'ENDUIDO', 'PESOS_ENDUIDO', 'PESO_END01']
  ])(
    'usa el perfil de InfluxDB específico de %s',
    async (plantCode, scaleKey, bucket, measurement, field) => {
      const prefix = `INFLUXDB_${plantCode}`;
      const values: Record<string, string> = {
        INFLUXDB_URL: 'http://influx:8086',
        INFLUXDB_TOKEN: 'secret-token',
        INFLUXDB_ORG: 'disal',
        [`${prefix}_BUCKET`]: bucket,
        [`${prefix}_MEASUREMENT`]: measurement,
        [`${prefix}_FIELD`]: 'PESO_{scaleKey}'
      };
      const config = {
        get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback)
      } as never;
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        text: jest
          .fn()
          .mockResolvedValue(',result,table,_time,_value\n,_result,0,2026-09-17T10:00:00Z,750.5')
      } as never);
      const service = new InfluxHistoryService(config);

      await service.readWeightSeries(
        scaleKey,
        new Date('2026-09-17T10:00:00.000Z'),
        new Date('2026-09-17T11:00:00.000Z'),
        { plantCode }
      );

      const query = String(fetchSpy.mock.calls[0][1]?.body);
      expect(query).toContain(`from(bucket: "${bucket}")`);
      expect(query).toContain(`r._measurement == "${measurement}"`);
      expect(query).toContain(`r._field == "${field}"`);
    }
  );

  it('resuelve la medición de Látex Viejo desde el número de tanque', async () => {
    const values: Record<string, string> = {
      INFLUXDB_URL: 'http://influx:8086',
      INFLUXDB_TOKEN: 'secret-token',
      INFLUXDB_ORG: 'disal',
      INFLUXDB_LATEX_VIEJO_BUCKET: 'LATEX_BLANCO',
      INFLUXDB_LATEX_VIEJO_MEASUREMENT: 'TK{tankNumber}',
      INFLUXDB_LATEX_VIEJO_FIELD: 'value'
    };
    const config = {
      get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback)
    } as never;
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: jest
        .fn()
        .mockResolvedValue(',result,table,_time,_value\n,_result,0,2026-09-17T10:00:00Z,750.5')
    } as never);
    const service = new InfluxHistoryService(config);

    await service.readWeightSeries(
      'LV03',
      new Date('2026-09-17T10:00:00.000Z'),
      new Date('2026-09-17T11:00:00.000Z'),
      { plantCode: 'LATEX_VIEJO', tankNumber: 3 }
    );

    const query = String(fetchSpy.mock.calls[0][1]?.body);
    expect(query).toContain('from(bucket: "LATEX_BLANCO")');
    expect(query).toContain('r._measurement == "TK3"');
    expect(query).toContain('r._field == "value"');
  });

  it('consulta Sintéticos por bucket, measurement del tanque y field value', async () => {
    const values: Record<string, string> = {
      INFLUXDB_URL: 'http://influx:8086',
      INFLUXDB_TOKEN: 'secret-token',
      INFLUXDB_ORG: 'disal',
      INFLUXDB_SINTETICOS_BUCKET: 'SINTETICO',
      INFLUXDB_SINTETICOS_MEASUREMENT: 'TK N° {tankNumberPadded}',
      INFLUXDB_SINTETICOS_FIELD: 'value'
    };
    const config = {
      get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback)
    } as never;
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: jest
        .fn()
        .mockResolvedValue(',result,table,_time,_value\n,_result,0,2026-09-17T10:00:00Z,750.5')
    } as never);
    const service = new InfluxHistoryService(config);

    const result = await service.readWeightSeries(
      'SIN01',
      new Date('2026-09-17T10:00:00.000Z'),
      new Date('2026-09-17T11:00:00.000Z'),
      { plantCode: 'SINTETICOS', tankNumber: 1 }
    );

    expect(result.status).toBe('AVAILABLE');
    const query = String(fetchSpy.mock.calls[0][1]?.body);
    expect(query).toContain('from(bucket: "SINTETICO")');
    expect(query).toContain('r._measurement == "TK N° 01"');
    expect(query).toContain('r._field == "value"');
    expect(query).not.toContain('r["scaleKey"]');
  });
});
