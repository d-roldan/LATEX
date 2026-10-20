import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  InjectionMachineBatchDto,
  InjectionMachineReadingDto,
  InjectionTechnicalCycleDto
} from './dto/injection-machine.dto';
import { PlantIntegrationAuthService } from './plant-integration-auth.service';
import { InjectionHistoryMetric, InjectionHistoryService } from './injection-history.service';
import { InjectionCmsHistoryService } from './injection-cms-history.service';
import {
  INJECTION_PLANT_CODE,
  INJECTION_SIM_SOURCE,
  INJECTION_SOURCE,
  injectionMachines,
  injectionThresholds
} from './injection-machines.config';

type CachedMachine = {
  reading: InjectionMachineReadingDto;
  receivedAt: string;
  nodeRedAt: string;
  sqlDurationMs: number | null;
};
type BatchDiagnostics = {
  sqlRows: number | null;
  freshCmsReported: number | null;
  sqlDurationMs: number | null;
  notice: string | null;
  nodeRedAt: string;
};

@Injectable()
export class InjectionMachinesService {
  private readonly latest = new Map<string, CachedMachine>();
  private readonly technical = new Map<string, InjectionTechnicalCycleDto>();
  private readonly lastBatchAt = new Map<string, string>();
  private readonly lastBatch = new Map<string, BatchDiagnostics>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationAuth: PlantIntegrationAuthService,
    private readonly config: ConfigService,
    @Optional() private readonly history?: InjectionHistoryService,
    @Optional() private readonly cmsHistory?: InjectionCmsHistoryService
  ) {}

  async receive(plantCode: string, key: string | undefined, dto: InjectionMachineBatchDto) {
    this.assertCode(plantCode);
    const simulated = dto.source === INJECTION_SIM_SOURCE;
    if (simulated && !this.simulationEnabled())
      throw new ForbiddenException('Simulador ENVASES deshabilitado');
    if (simulated !== (dto.mode === 'SIMULATION') || simulated !== (dto.simulated === true))
      throw new BadRequestException('Origen y modo de telemetría incompatibles');
    if (dto.maquinas.some((reading) => (reading.simulated === true) !== simulated))
      throw new BadRequestException('Lectura con origen incompatible');
    const integration = await this.integrationAuth.authenticate(plantCode, dto.source, key);
    const now = new Date();
    const nodeRedAt = Date.parse(dto.fecha_recepcion_nodered);
    if (nodeRedAt > now.getTime() + 30_000 || nodeRedAt < now.getTime() - 120_000)
      throw new BadRequestException('Fecha de recepción Node-RED fuera de rango');
    const ips = dto.maquinas.map((machine) => machine.machine_ip);
    if (new Set(ips).size !== ips.length) throw new BadRequestException('IP repetida en el lote');
    const results = dto.maquinas.map((reading) => {
      const machine = injectionMachines.find((item) => item.ip === reading.machine_ip);
      if (!machine || !machine.visible)
        return {
          machineIp: reading.machine_ip,
          status: 'REJECTED',
          message: 'Máquina desconocida'
        };
      if (reading.modelo && reading.modelo !== machine.model)
        return {
          machineIp: reading.machine_ip,
          code: machine.code,
          status: 'REJECTED',
          message: 'Modelo no coincide con el catálogo'
        };
      if (reading.equipment_code && reading.equipment_code !== machine.code)
        return {
          machineIp: reading.machine_ip,
          code: machine.code,
          status: 'REJECTED',
          message: 'Código de equipo incorrecto'
        };
      const stamp = Date.parse(reading.cms_timestamp);
      if (stamp > now.getTime() + 30_000)
        return {
          machineIp: reading.machine_ip,
          code: machine.code,
          status: 'REJECTED',
          message: 'Timestamp CMS futuro'
        };
      if (
        reading.ultimo_ciclo_tecnico &&
        Date.parse(reading.ultimo_ciclo_tecnico.timestamp) > now.getTime() + 30_000
      )
        return {
          machineIp: reading.machine_ip,
          code: machine.code,
          status: 'REJECTED',
          message: 'Timestamp de ciclo futuro'
        };
      const cacheKey = `${integration.plantId}:${dto.source}:${machine.code}`;
      const previous = this.latest.get(cacheKey);
      const shot = reading.ultimo_ciclo_tecnico;
      const previousShot = this.technical.get(cacheKey);
      const attributableShot =
        shot &&
        shot.machine_ip === reading.machine_ip &&
        (simulated
          ? shot.identity_source === 'SIMULATED'
          : shot.identity_source === 'CMS_MACHINE_NAME' ||
            shot.identity_source === 'NODE_RED_MACHINE_CONTEXT');
      let technical = shot ? 'UNATTRIBUTED' : 'ABSENT';
      if (attributableShot) technical = 'UNCHANGED';
      if (
        attributableShot &&
        (!previousShot ||
          (shot.shot_number > previousShot.shot_number &&
            Date.parse(shot.timestamp) >= Date.parse(previousShot.timestamp)))
      ) {
        this.technical.set(cacheKey, shot);
        technical = 'UPDATED';
      }
      if (previous && stamp <= Date.parse(previous.reading.cms_timestamp))
        return {
          machineIp: reading.machine_ip,
          code: machine.code,
          status: 'IGNORED_OLDER',
          technical
        };
      const currentReading = { ...reading };
      delete currentReading.ultimo_ciclo_tecnico;
      this.latest.set(cacheKey, {
        reading: currentReading,
        receivedAt: now.toISOString(),
        nodeRedAt: dto.fecha_recepcion_nodered,
        sqlDurationMs: dto.duracion_consulta_ms ?? null
      });
      return {
        machineIp: reading.machine_ip,
        code: machine.code,
        status: 'ACCEPTED',
        technical
      };
    });
    const stored = await Promise.all(
      results.map((result, index) => {
        if (
          !this.history ||
          result.status === 'REJECTED' ||
          (result.status !== 'ACCEPTED' && result.technical !== 'UPDATED')
        )
          return Promise.resolve(false);
        const reading = dto.maquinas[index];
        const shot = result.technical === 'UPDATED' ? (reading.ultimo_ciclo_tecnico ?? null) : null;
        return this.history.record(
          result.code!,
          dto.source,
          reading,
          shot,
          result.status === 'ACCEPTED'
        );
      })
    );
    const batchKey = `${integration.plantId}:${dto.source}`;
    this.lastBatchAt.set(batchKey, now.toISOString());
    this.lastBatch.set(batchKey, {
      sqlRows: dto.cantidad_filas_sql ?? null,
      freshCmsReported: dto.cantidad_maquinas_frescas_cms ?? null,
      sqlDurationMs: dto.duracion_consulta_ms ?? null,
      notice: dto.aviso ?? null,
      nodeRedAt: dto.fecha_recepcion_nodered
    });
    return {
      accepted: results.filter((result) => result.status === 'ACCEPTED').length,
      rejected: results.filter((result) => result.status === 'REJECTED').length,
      ignored: results.filter((result) => result.status === 'IGNORED_OLDER').length,
      receivedAt: now.toISOString(),
      persisted:
        results.some((result) => result.status === 'ACCEPTED' || result.technical === 'UPDATED') &&
        results.every(
          (result, index) =>
            (result.status !== 'ACCEPTED' && result.technical !== 'UPDATED') || stored[index]
        ),
      results
    };
  }

  async privateSnapshot(companyId: string, userId: string, plantCode: string) {
    this.assertCode(plantCode);
    const plant = await this.prisma.plant.findFirst({
      where: {
        companyId,
        code: INJECTION_PLANT_CODE,
        isActive: true,
        userAccesses: { some: { userId } }
      }
    });
    if (!plant) throw new NotFoundException('Planta no encontrada o no autorizada');
    return this.snapshot(plant.id);
  }

  async publicSnapshot(plantCode: string) {
    this.assertCode(plantCode);
    const companyId = this.config.get<string>('SYSTEM_OWNER_COMPANY_ID') || 'seed_company_disal';
    const plant = await this.prisma.plant.findFirst({
      where: { companyId, code: INJECTION_PLANT_CODE, isActive: true, company: { isActive: true } }
    });
    if (!plant) throw new NotFoundException('Planta no encontrada');
    return this.snapshot(plant.id);
  }

  async privateHistory(
    companyId: string,
    userId: string,
    plantCode: string,
    code: string,
    source: string,
    metric: string,
    hoursText: string,
    zoneText: string
  ) {
    this.assertCode(plantCode);
    const machine = injectionMachines.find((item) => item.code === code && item.visible);
    const hours = Number(hoursText);
    const zone = Number(zoneText);
    if (
      !machine ||
      ![INJECTION_SOURCE, INJECTION_SIM_SOURCE].includes(source) ||
      !['cycle', 'quantity', 'temperature', 'state'].includes(metric) ||
      ![1, 6, 24, 72, 168].includes(hours) ||
      !Number.isInteger(zone) ||
      zone < 1 ||
      zone > 20
    )
      throw new BadRequestException('Consulta histórica inválida');
    if (source === INJECTION_SIM_SOURCE && !this.simulationEnabled())
      throw new BadRequestException('Simulación no habilitada');
    const plant = await this.prisma.plant.findFirst({
      where: {
        companyId,
        code: INJECTION_PLANT_CODE,
        isActive: true,
        userAccesses: { some: { userId } }
      }
    });
    if (!plant) throw new NotFoundException('Planta no encontrada o no autorizada');
    return this.history
      ? this.history.read(code, source, metric as InjectionHistoryMetric, hours, zone)
      : { status: 'CONFIGURATION_PENDING', message: 'Historial no configurado.', points: [] };
  }

  async privateCmsShots(
    companyId: string,
    userId: string,
    plantCode: string,
    code: string,
    beforeText?: string
  ) {
    this.assertCode(plantCode);
    const machine = injectionMachines.find((item) => item.code === code && item.visible);
    const before = beforeText === undefined ? undefined : Number(beforeText);
    if (!machine || (before !== undefined && (!Number.isSafeInteger(before) || before < 1)))
      throw new BadRequestException('Consulta de disparos inválida');
    const plant = await this.prisma.plant.findFirst({
      where: {
        companyId,
        code: INJECTION_PLANT_CODE,
        isActive: true,
        userAccesses: { some: { userId } }
      }
    });
    if (!plant) throw new NotFoundException('Planta no encontrada o no autorizada');
    const cached = this.latest.get(`${plant.id}:${INJECTION_SOURCE}:${machine.code}`);
    const file = cached?.reading.current_file_name?.trim();
    const observedAt = cached?.receivedAt ?? null;
    if (!file || !observedAt || Date.now() - Date.parse(observedAt) > 120_000)
      return {
        status: 'NO_CURRENT_FILE',
        file: file ?? null,
        fileObservedAt: observedAt,
        rows: [],
        nextCursor: null
      };
    const result = this.cmsHistory
      ? await this.cmsHistory.readByFile(file, before)
      : { status: 'CONFIGURATION_PENDING', file, rows: [], nextCursor: null };
    return { ...result, fileObservedAt: observedAt };
  }

  private snapshot(plantId: string) {
    const now = Date.now();
    const simulated =
      this.simulationEnabled() && this.lastBatchAt.has(`${plantId}:${INJECTION_SIM_SOURCE}`);
    const source = simulated ? INJECTION_SIM_SOURCE : INJECTION_SOURCE;
    const batchKey = `${plantId}:${source}`;
    const lastBatchAt = this.lastBatchAt.get(batchKey) ?? null;
    return {
      plantCode: INJECTION_PLANT_CODE,
      source,
      mode: simulated ? 'SIMULATION' : 'LIVE',
      simulated,
      schemaVersion: 1,
      generatedAt: new Date(now).toISOString(),
      lastBatchAt,
      batch: this.lastBatch.get(batchKey) ?? null,
      thresholds: injectionThresholds,
      communication:
        lastBatchAt && now - Date.parse(lastBatchAt) <= injectionThresholds.nodeRedFreshMs
          ? 'RECENT'
          : 'NO_RECENT_DATA',
      machines: injectionMachines
        .filter((item) => item.visible)
        .sort((a, b) => a.order - b.order)
        .map((machine) => {
          const cacheKey = `${plantId}:${source}:${machine.code}`;
          const cached = this.latest.get(cacheKey);
          const cmsTime = cached ? Date.parse(cached.reading.cms_timestamp) : null;
          const cmsAgeMs = cmsTime === null ? null : Math.max(0, now - cmsTime);
          const receiverAgeMs = cached ? Math.max(0, now - Date.parse(cached.receivedAt)) : null;
          return {
            ...machine,
            reading: cached?.reading ?? null,
            ultimo_ciclo_tecnico: this.technical.get(cacheKey) ?? null,
            receivedAt: cached?.receivedAt ?? null,
            nodeRedAt: cached?.nodeRedAt ?? null,
            sqlDurationMs: cached?.sqlDurationMs ?? null,
            cmsAgeSeconds: cmsAgeMs === null ? null : Math.floor(cmsAgeMs / 1000),
            cmsFresh:
              cmsAgeMs !== null &&
              cmsAgeMs <= injectionThresholds.cmsFreshMs &&
              cmsTime !== null &&
              cmsTime <= now + 2_000 &&
              cached?.reading.cms_row_fresh !== false,
            communicationFresh:
              receiverAgeMs !== null && receiverAgeMs <= injectionThresholds.nodeRedFreshMs,
            counterRecent: cached?.reading.ultimo_incremento_detectado
              ? now - Date.parse(cached.reading.ultimo_incremento_detectado) <=
                  injectionThresholds.counterRecentMs &&
                now >= Date.parse(cached.reading.ultimo_incremento_detectado)
              : false
          };
        })
    };
  }

  private assertCode(code: string) {
    if (code.toUpperCase() !== INJECTION_PLANT_CODE)
      throw new NotFoundException('Planta no encontrada');
  }

  private simulationEnabled() {
    return this.config.get<string>('DISAL_ENABLE_ENVASES_SIMULATOR') === 'true';
  }
}
