import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createHash } from 'crypto';
import { AddressInfo } from 'net';
import { PrismaService } from '../../prisma/prisma.service';
import { PlantPublicScopedController } from './plant.controller';
import { PlantService } from './plant.service';
import { InjectionMachinesService } from './injection-machines.service';
import { PlantIntegrationAuthService } from './plant-integration-auth.service';

describe('ENVASES HTTP', () => {
  let app: INestApplication;
  let base: string;
  const key = 'clave-de-prueba-envases-123456789012345';

  beforeAll(async () => {
    const prisma = {
      plantIntegration: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'integration-1',
            companyId: 'empresa',
            plantId: 'plant-1',
            source: 'NODE_RED_ENVASES',
            keyHash: createHash('sha256').update(key).digest('hex'),
            plant: { code: 'ENVASES' }
          }
        ])
      },
      plant: { findFirst: jest.fn().mockResolvedValue({ id: 'plant-1' }) }
    };
    const module = await Test.createTestingModule({
      controllers: [PlantPublicScopedController],
      providers: [
        { provide: PlantService, useValue: {} },
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: () => 'empresa' } },
        PlantIntegrationAuthService,
        InjectionMachinesService
      ]
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
    );
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await app?.close();
  });

  const payload = () => ({
    source: 'NODE_RED_ENVASES',
    schemaVersion: 1,
    fecha_recepcion_nodered: new Date().toISOString(),
    maquinas: [
      {
        machine_ip: '172.16.0.141',
        modelo: 'DL650G5',
        cms_timestamp: new Date().toISOString(),
        current_quantity: 12
      }
    ]
  });

  it('rechaza una clave ausente y tipos inválidos', async () => {
    const url = `${base}/api/plants/ENVASES/telemetry/injection-machines`;
    expect(
      (
        await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload())
        })
      ).status
    ).toBe(401);
    expect(
      (
        await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-node-red-key': key },
          body: JSON.stringify({
            ...payload(),
            maquinas: [{ ...payload().maquinas[0], current_quantity: 'inventado' }]
          })
        })
      ).status
    ).toBe(400);
  });

  it('recibe un lote y lo expone ordenado en la consulta TV', async () => {
    const response = await fetch(`${base}/api/plants/ENVASES/telemetry/injection-machines`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-node-red-key': key },
      body: JSON.stringify(payload())
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ accepted: 1, persisted: false });
    const snapshot = await fetch(`${base}/api/plants/ENVASES/tv/injection-machines`);
    expect(snapshot.status).toBe(200);
    const data = await snapshot.json();
    expect(data.machines.map((machine: { code: string }) => machine.code)).toEqual([
      'INY01',
      'INY02',
      'INY03',
      'INY04',
      'INY05'
    ]);
    expect(data.machines[0].reading.current_quantity).toBe(12);
    expect(data.machines[1].reading).toBeNull();
  });

  it('rechaza simulación deshabilitada y valida el último ciclo técnico opcional', async () => {
    const url = `${base}/api/plants/ENVASES/telemetry/injection-machines`;
    const simulated = {
      ...payload(),
      source: 'NODE_RED_ENVASES_SIM',
      mode: 'SIMULATION',
      simulated: true,
      maquinas: [{ ...payload().maquinas[0], simulated: true }]
    };
    const rejected = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-node-red-key': key },
      body: JSON.stringify(simulated)
    });
    expect(rejected.status).toBe(403);
    const timestamp = new Date(Date.now() + 1000).toISOString();
    const technical = {
      ...payload(),
      fecha_recepcion_nodered: new Date().toISOString(),
      maquinas: [
        {
          ...payload().maquinas[0],
          cms_timestamp: timestamp,
          ultimo_ciclo_tecnico: {
            shot_number: 99,
            timestamp,
            cycle_time: 26,
            barrel_temperatures: [null, 191, 192, 193, 194, 195, 196],
            mold_temperatures: Array(12).fill(null)
          }
        }
      ]
    };
    const accepted = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-node-red-key': key },
      body: JSON.stringify(technical)
    });
    expect(accepted.status).toBe(201);
    expect((await accepted.json()).accepted).toBe(1);
    const snapshot = await (await fetch(`${base}/api/plants/ENVASES/tv/injection-machines`)).json();
    expect(snapshot.machines[0].ultimo_ciclo_tecnico).toMatchObject({
      shot_number: 99,
      barrel_temperatures: [null, 191, 192, 193, 194, 195, 196]
    });
  });
});
