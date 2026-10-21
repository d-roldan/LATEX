import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectionMachinesService } from './injection-machines.service';
import { InjectionMachineBatchDto } from './dto/injection-machine.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { createHash } from 'crypto';
import { PlantIntegrationAuthService } from './plant-integration-auth.service';

const reading = (ip: string, timestamp: string, quantity: number | null = 10) => ({
  machine_ip: ip,
  cms_timestamp: timestamp,
  current_quantity: quantity,
  modelo: ip === '172.16.0.141' ? 'DL650G5' : 'DL450G5',
  operation_status_code: 77,
  operation_status_text: 'DESCONOCIDO',
  adquisicion_industrial_fresca: 'NO_VERIFICADA',
  tipo_cambio_contador: 'INCREMENTO_DETECTADO',
  delta_contador_observado: 1,
  ultimo_incremento_detectado: timestamp
});
const batch = (machines: InjectionMachineBatchDto['maquinas']): InjectionMachineBatchDto => ({
  source: 'NODE_RED_ENVASES',
  schemaVersion: 1,
  fecha_recepcion_nodered: new Date().toISOString(),
  maquinas: machines
});

describe('InjectionMachinesService', () => {
  const prisma = { plant: { findFirst: jest.fn() } } as any;
  const auth = { authenticate: jest.fn() } as any;
  const config = { get: jest.fn().mockReturnValue('empresa') } as any;
  let service: InjectionMachinesService;

  beforeEach(() => {
    jest.clearAllMocks();
    auth.authenticate.mockResolvedValue({ plantId: 'envases-1' });
    prisma.plant.findFirst.mockResolvedValue({ id: 'envases-1' });
    service = new InjectionMachinesService(prisma, auth, config);
  });

  it('consulta disparos sólo del archivo actual tras verificar acceso a ENVASES', async () => {
    const cmsHistory = {
      readByFile: jest.fn().mockResolvedValue({
        status: 'AVAILABLE',
        file: 'cuerpo_4l_iml_JCA.db',
        rows: [{ idx: 42 }],
        nextCursor: null
      })
    } as any;
    service = new InjectionMachinesService(prisma, auth, config, undefined, cmsHistory);
    await service.receive(
      'ENVASES',
      'key',
      batch([
        {
          ...reading('172.16.0.146', new Date().toISOString()),
          current_file_name: 'cuerpo_4l_iml_JCA.db'
        }
      ])
    );
    const result = await service.privateCmsShots('empresa', 'usuario', 'ENVASES', 'INY04');
    expect(result).toMatchObject({ status: 'AVAILABLE', file: 'cuerpo_4l_iml_JCA.db' });
    expect(cmsHistory.readByFile).toHaveBeenCalledWith('cuerpo_4l_iml_JCA.db', undefined);

    prisma.plant.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.privateCmsShots('empresa', 'sin-acceso', 'ENVASES', 'INY04')
    ).rejects.toThrow(NotFoundException);
    expect(cmsHistory.readByFile).toHaveBeenCalledTimes(1);
  });

  it('ordena cinco equipos y conserva ausencia de datos al reiniciar', async () => {
    const snapshot = await service.publicSnapshot('ENVASES');
    expect(snapshot.machines.map((machine) => machine.code)).toEqual([
      'INY01',
      'INY02',
      'INY03',
      'INY04',
      'INY05'
    ]);
    expect(snapshot.machines.map((machine) => machine.ip)).toEqual([
      '172.16.0.145',
      '172.16.0.144',
      '172.16.0.143',
      '172.16.0.146',
      '172.16.0.141'
    ]);
    expect(snapshot.machines.map((machine) => [machine.name, machine.model])).toEqual([
      ['INYECTORA 1', 'TB200G5'],
      ['INYECTORA 2', 'TB280G5-2'],
      ['INYECTORA 3', 'TB280G5-1'],
      ['INYECTORA 4', 'DL450G5'],
      ['INYECTORA 5', 'DL650G5']
    ]);
    expect(snapshot.machines.every((machine) => machine.reading === null)).toBe(true);
    expect(snapshot.communication).toBe('NO_RECENT_DATA');
  });

  it('exige asignación de ENVASES y parámetros válidos para consultar historia', async () => {
    prisma.plant.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.privateHistory(
        'empresa',
        'usuario',
        'ENVASES',
        'INY01',
        'NODE_RED_ENVASES',
        'cycle',
        '24',
        '1'
      )
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.privateHistory(
        'empresa',
        'usuario',
        'ENVASES',
        'INY01',
        'NODE_RED_ENVASES',
        'temperature',
        '24',
        '21'
      )
    ).rejects.toThrow('Consulta histórica inválida');
    await expect(
      service.privateHistory(
        'empresa',
        'usuario',
        'ENVASES',
        'INY01',
        'NODE_RED_ENVASES',
        'cycle',
        '24',
        '1'
      )
    ).resolves.toMatchObject({ status: 'CONFIGURATION_PENDING' });
    await expect(
      service.privateHistory(
        'empresa',
        'usuario',
        'ENVASES',
        'INY01',
        'NODE_RED_ENVASES',
        'state',
        '24',
        '1'
      )
    ).resolves.toMatchObject({ status: 'CONFIGURATION_PENDING' });
  });

  it('acepta lote parcial, ignora duplicados y preserva valores nulos y códigos desconocidos', async () => {
    const t = new Date(Date.now() - 1000).toISOString();
    const first = await service.receive(
      'ENVASES',
      'key',
      batch([reading('172.16.0.146', t), reading('172.16.0.141', t, null)])
    );
    expect(first.accepted).toBe(2);
    const duplicate = await service.receive(
      'ENVASES',
      'key',
      batch([reading('172.16.0.141', t, 99)])
    );
    expect(duplicate.ignored).toBe(1);
    const snapshot = await service.publicSnapshot('ENVASES');
    expect(snapshot.machines[4].reading?.current_quantity).toBeNull();
    expect(snapshot.machines[4].reading?.operation_status_code).toBe(77);
    expect(snapshot.machines[3].reading?.current_quantity).toBe(10);
    expect(snapshot.machines[2].reading).toBeNull();
  });

  it('rechaza IP desconocida y modelo incorrecto por máquina sin perder las válidas', async () => {
    const t = new Date(Date.now() - 1000).toISOString();
    const wrong = reading('172.16.0.141', t);
    wrong.modelo = 'OTRO';
    const result = await service.receive(
      'ENVASES',
      'key',
      batch([reading('172.16.0.146', t), reading('10.0.0.99', t), wrong])
    );
    expect(result).toMatchObject({ accepted: 1, rejected: 2 });
  });

  it('acepta los códigos físicos de Node-RED y rechaza el código anterior', async () => {
    const timestamp = new Date().toISOString();
    const machines = [
      ['172.16.0.145', 'INY01', 'TB200G5'],
      ['172.16.0.144', 'INY02', 'TB280G5-2'],
      ['172.16.0.143', 'INY03', 'TB280G5-1'],
      ['172.16.0.146', 'INY04', 'DL450G5'],
      ['172.16.0.141', 'INY05', 'DL650G5']
    ].map(([machine_ip, equipment_code, modelo]) => ({
      machine_ip,
      equipment_code,
      modelo,
      cms_timestamp: timestamp
    }));
    const accepted = await service.receive('ENVASES', 'key', batch(machines));
    expect(accepted).toMatchObject({ accepted: 5, rejected: 0 });
    const snapshot = await service.publicSnapshot('ENVASES');
    expect(snapshot.machines.map((machine) => machine.reading?.equipment_code)).toEqual([
      'INY01',
      'INY02',
      'INY03',
      'INY04',
      'INY05'
    ]);
    const oldCode = await service.receive('ENVASES', 'key', {
      ...batch([{ ...machines[0], equipment_code: 'INY05' }]),
      fecha_recepcion_nodered: new Date().toISOString()
    });
    expect(oldCode.results[0]).toMatchObject({
      status: 'REJECTED',
      message: 'Código de equipo incorrecto'
    });
  });

  it('aísla el simulador y conserva el último ciclo técnico al recibir un disparo repetido', async () => {
    config.get.mockImplementation((name: string) =>
      name === 'DISAL_ENABLE_ENVASES_SIMULATOR' ? 'true' : 'empresa'
    );
    const t = new Date(Date.now() - 1000).toISOString();
    const simulated = {
      ...reading('172.16.0.141', t, 100),
      simulated: true,
      ultimo_ciclo_tecnico: {
        shot_number: 42,
        timestamp: t,
        machine_ip: '172.16.0.141',
        identity_source: 'SIMULATED' as const,
        cycle_time: 26,
        barrel_temperatures: [190, 191, 192, 193, 194, 195, 196],
        recipe: { inj_velocity: '95/95/95', sov_time: 3.1 }
      }
    };
    const simBatch = {
      ...batch([simulated]),
      source: 'NODE_RED_ENVASES_SIM',
      mode: 'SIMULATION',
      simulated: true
    } as InjectionMachineBatchDto;
    await service.receive('ENVASES', 'sim-key', simBatch);
    expect(auth.authenticate).toHaveBeenCalledWith('ENVASES', 'NODE_RED_ENVASES_SIM', 'sim-key');
    let snapshot = await service.publicSnapshot('ENVASES');
    expect(snapshot.source).toBe('NODE_RED_ENVASES_SIM');
    expect(snapshot.machines[4].ultimo_ciclo_tecnico?.shot_number).toBe(42);
    expect(snapshot.machines[4].ultimo_ciclo_tecnico?.recipe?.inj_velocity).toBe('95/95/95');
    const next = new Date().toISOString();
    await service.receive('ENVASES', 'sim-key', {
      ...simBatch,
      fecha_recepcion_nodered: next,
      maquinas: [
        {
          ...simulated,
          cms_timestamp: next,
          current_quantity: 0,
          delta_contador_observado: -100,
          tipo_cambio_contador: 'REINICIO_O_RETROCESO_CONTADOR',
          ultimo_ciclo_tecnico: { ...simulated.ultimo_ciclo_tecnico, cycle_time: 99 }
        }
      ]
    });
    snapshot = await service.publicSnapshot('ENVASES');
    expect(snapshot.machines[4].reading?.current_quantity).toBe(0);
    expect(snapshot.machines[4].ultimo_ciclo_tecnico?.cycle_time).toBe(26);
    config.get.mockReturnValue('empresa');
    snapshot = await service.publicSnapshot('ENVASES');
    expect(snapshot.source).toBe('NODE_RED_ENVASES');
    expect(snapshot.machines[4].reading).toBeNull();
    await expect(service.receive('ENVASES', 'sim-key', simBatch)).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it('no concede acceso cambiando la URL y exige la clave de integración', async () => {
    prisma.plant.findFirst.mockResolvedValue(null);
    await expect(service.privateSnapshot('empresa', 'usuario', 'ENVASES')).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(prisma.plant.findFirst).toHaveBeenCalledWith({
      where: {
        companyId: 'empresa',
        code: 'ENVASES',
        isActive: true,
        userAccesses: { some: { userId: 'usuario' } }
      }
    });
    auth.authenticate.mockRejectedValue(new UnauthorizedException());
    await expect(
      service.receive(
        'ENVASES',
        undefined,
        batch([reading('172.16.0.141', new Date().toISOString())])
      )
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('conserva el estado actual y no atribuye un disparo real sin identidad de máquina', async () => {
    const t = new Date(Date.now() - 1000).toISOString();
    const base = reading('172.16.0.141', t, 99);
    const unlinked = await service.receive(
      'ENVASES',
      'key',
      batch([
        {
          ...base,
          ultimo_ciclo_tecnico: {
            shot_number: 917888,
            timestamp: t,
            mold_name: 'cuerpo_4l_iml_JCA.db',
            recipe: { inj_velocity: '95.0/95.0/95.0' }
          }
        }
      ])
    );
    let snapshot = await service.publicSnapshot('ENVASES');
    expect(unlinked.results[0]).toMatchObject({ technical: 'UNATTRIBUTED' });
    expect(snapshot.machines[4].reading?.current_quantity).toBe(99);
    expect(snapshot.machines[4].reading?.ultimo_ciclo_tecnico).toBeUndefined();
    expect(snapshot.machines[4].ultimo_ciclo_tecnico).toBeNull();

    const linked = await service.receive(
      'ENVASES',
      'key',
      batch([
        {
          ...base,
          cms_timestamp: t,
          ultimo_ciclo_tecnico: {
            shot_number: 917888,
            timestamp: t,
            machine_ip: '172.16.0.141',
            identity_source: 'NODE_RED_MACHINE_CONTEXT',
            mold_name: 'cuerpo_4l_iml_JCA.db',
            recipe: { inj_velocity: '95.0/95.0/95.0' }
          }
        }
      ])
    );
    snapshot = await service.publicSnapshot('ENVASES');
    expect(linked.results[0]).toMatchObject({ status: 'IGNORED_OLDER', technical: 'UPDATED' });
    expect(snapshot.machines[4].ultimo_ciclo_tecnico?.recipe?.inj_velocity).toBe('95.0/95.0/95.0');
  });

  it('asigna un ciclo CMS sólo a la IP indicada por el nombre verificado', async () => {
    const t = new Date(Date.now() - 1000).toISOString();
    const result = await service.receive(
      'ENVASES',
      'key',
      batch([
        {
          ...reading('172.16.0.141', t),
          ultimo_ciclo_tecnico: {
            machine_ip: '172.16.0.141',
            identity_source: 'CMS_MACHINE_NAME',
            shot_number: 917889,
            timestamp: t,
            mold_name: 'cuerpo_4l_iml_JCA.db',
            recipe: { inj_velocity: '80/90', sov_time: 2.4 }
          }
        },
        {
          ...reading('172.16.0.146', t),
          ultimo_ciclo_tecnico: {
            machine_ip: '172.16.0.141',
            identity_source: 'CMS_MACHINE_NAME',
            shot_number: 917889,
            timestamp: t
          }
        }
      ])
    );
    expect(result.results[0]).toMatchObject({ technical: 'UPDATED' });
    expect(result.results[1]).toMatchObject({ technical: 'UNATTRIBUTED' });
    const snapshot = await service.publicSnapshot('ENVASES');
    expect(snapshot.machines[4].ultimo_ciclo_tecnico?.recipe?.inj_velocity).toBe('80/90');
    expect(snapshot.machines[3].ultimo_ciclo_tecnico).toBeNull();
  });

  it('marca datos obsoletos sin alterar el último contador', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-16T18:00:00.000Z'));
    try {
      const old = new Date(Date.now() - 9000).toISOString();
      await service.receive('ENVASES', 'key', batch([reading('172.16.0.141', old, 123)]));
      jest.setSystemTime(new Date(Date.now() + 31_000));
      const snapshot = await service.publicSnapshot('ENVASES');
      expect(snapshot.communication).toBe('NO_RECENT_DATA');
      expect(snapshot.machines[4]).toMatchObject({ cmsFresh: false, communicationFresh: false });
      expect(snapshot.machines[4].reading?.current_quantity).toBe(123);
    } finally {
      jest.useRealTimers();
    }
  });

  it('preserva un reinicio observado del contador sin reinterpretarlo', async () => {
    const t = new Date(Date.now() - 1000).toISOString();
    const reset = {
      ...reading('172.16.0.141', t, 3),
      delta_contador_observado: -200,
      tipo_cambio_contador: 'REINICIO_O_RETROCESO_CONTADOR'
    };
    await service.receive('ENVASES', 'key', batch([reset]));
    const snapshot = await service.publicSnapshot('ENVASES');
    expect(snapshot.machines[4].reading).toMatchObject({
      current_quantity: 3,
      delta_contador_observado: -200,
      tipo_cambio_contador: 'REINICIO_O_RETROCESO_CONTADOR'
    });
  });

  it('no presenta como vigente un timestamp CMS adelantado', async () => {
    const future = new Date(Date.now() + 20_000).toISOString();
    await service.receive('ENVASES', 'key', batch([reading('172.16.0.141', future)]));
    const snapshot = await service.publicSnapshot('ENVASES');
    expect(snapshot.machines[4].cmsFresh).toBe(false);
  });

  it('autentica exclusivamente la fuente y clave registradas para ENVASES', async () => {
    const key = 'clave-de-prueba-no-productiva-123456789';
    const keyHash = createHash('sha256').update(key).digest('hex');
    const integrationPrisma = {
      plantIntegration: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'integration-1',
            plantId: 'envases-1',
            companyId: 'empresa',
            source: 'NODE_RED_ENVASES',
            keyHash,
            plant: { code: 'ENVASES' }
          }
        ])
      }
    } as any;
    const integrationAuth = new PlantIntegrationAuthService(integrationPrisma);
    await expect(
      integrationAuth.authenticate('ENVASES', 'NODE_RED_ENVASES', 'incorrecta')
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      integrationAuth.authenticate('ENVASES', 'NODE_RED_ENVASES', key)
    ).resolves.toMatchObject({ plantId: 'envases-1' });
    expect(integrationPrisma.plantIntegration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          source: 'NODE_RED_ENVASES',
          isActive: true,
          plant: { code: 'ENVASES', isActive: true }
        }
      })
    );
  });

  it('valida tipos y rangos del contrato anidado', async () => {
    const dto = plainToInstance(InjectionMachineBatchDto, {
      ...batch([reading('172.16.0.141', new Date().toISOString())]),
      maquinas: [{ ...reading('172.16.0.141', new Date().toISOString()), current_quantity: -1 }]
    });
    expect(await validate(dto)).not.toEqual([]);
    const invalidRecipe = plainToInstance(InjectionMachineBatchDto, {
      ...batch([reading('172.16.0.141', new Date().toISOString())]),
      maquinas: [
        {
          ...reading('172.16.0.141', new Date().toISOString()),
          ultimo_ciclo_tecnico: {
            shot_number: 1,
            timestamp: new Date().toISOString(),
            machine_ip: '172.16.0.141',
            identity_source: 'CMS_MACHINE_NAME',
            recipe: { inj_velocity: 'x'.repeat(129) }
          }
        }
      ]
    });
    expect(await validate(invalidRecipe)).not.toEqual([]);
  });

  it('acepta una descripción de alarma opcional y la devuelve con el código de la máquina', async () => {
    const t = new Date(Date.now() - 1000).toISOString();
    const alarmReading = {
      ...reading('172.16.0.141', t),
      alarm_status_code: 204,
      alarm_status_text: 'Texto informado por la fuente'
    };
    const dto = plainToInstance(InjectionMachineBatchDto, batch([alarmReading]));
    expect(await validate(dto)).toEqual([]);
    await service.receive('ENVASES', 'key', dto);
    const snapshot = await service.publicSnapshot('ENVASES');
    expect(snapshot.machines[4].reading).toMatchObject({
      alarm_status_code: 204,
      alarm_status_text: 'Texto informado por la fuente'
    });
    const invalid = plainToInstance(InjectionMachineBatchDto, {
      ...batch([alarmReading]),
      maquinas: [{ ...alarmReading, alarm_status_text: 'x'.repeat(201) }]
    });
    expect(await validate(invalid)).not.toEqual([]);
  });
});
