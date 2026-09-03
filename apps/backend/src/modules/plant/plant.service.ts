import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, QualityResult, TankState } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtUser } from '../../common/auth/jwt-user.interface';
import {
  CorrectLotDto,
  CorrectPackagingDto,
  DailyClosureDto,
  FinishPackagingDto,
  PackagingDto,
  QualityDecisionDto,
  ServiceDto,
  StartManufacturingDto,
  StageTargetsDto,
  VersionedActionDto,
  WeightBatchDto
} from './dto/plant.dto';
import { NotificationsService } from '../notifications/notifications.service';

type Telemetry = { grossKg: number; netKg?: number; measuredAt: string; receivedAt: string };

const LINES = ['Línea 1', 'Línea 20', 'Línea 3'];
const FORMATS = ['0,25 L', '0,50 L', '1 L', '4 L', '10 L'];
const ADJUSTMENT_REASONS = [
  'Nivel del tanque', 'Viscosidad', 'Cubritivo', 'Preservación', 'Brillo', 'Lavabilidad',
  'Color', 'Reemplazo de materia prima', 'Error operativo o de proceso', 'Desaereante',
  'Cambio de almacenamiento de producción'
];

const DEFAULT_TARGET_SECONDS: Partial<Record<TankState, number>> = {
  FABRICANDO: 8 * 60 * 60,
  LABORATORIO: 30 * 60,
  AJUSTE: 60 * 60,
  RECHAZADO: 60 * 60,
  APROBADO: 2 * 60 * 60,
  ENVASANDO: 6 * 60 * 60,
  FUERA_DE_SERVICIO: 8 * 60 * 60
};

const BUENOS_AIRES_OFFSET_MS = 3 * 60 * 60 * 1000;

@Injectable()
export class PlantService {
  private readonly weights = new Map<string, Telemetry>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService
  ) {}

  async getConfig(companyId: string) {
    return this.loadConfig(companyId);
  }

  async publicTanks() {
    const companyId = this.config.get<string>('SYSTEM_OWNER_COMPANY_ID') || 'seed_company_disal';
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, isActive: true },
      select: { id: true }
    });
    if (!company) throw new NotFoundException('La pantalla de planta no está configurada');

    const tanks = await this.tanks(company.id);
    return tanks.map((tank) => ({
      id: tank.id,
      number: tank.number,
      name: tank.name,
      capacityKg: tank.capacityKg,
      state: tank.state,
      serviceReason: tank.serviceReason,
      stateStartedAt: tank.stateStartedAt,
      stateElapsedSeconds: tank.stateElapsedSeconds,
      stateTargetSeconds: tank.stateTargetSeconds,
      stateAttention: tank.stateAttention,
      telemetry: {
        grossKg: tank.telemetry.grossKg,
        netKg: tank.telemetry.netKg,
        measuredAt: tank.telemetry.measuredAt,
        online: tank.telemetry.online
      },
      activeLot: tank.activeLot ? {
        id: tank.activeLot.id,
        manufacturingOrder: tank.activeLot.manufacturingOrder,
        materialCode: tank.activeLot.materialCode,
        description: tank.activeLot.description,
        specificWeight: tank.activeLot.specificWeight,
        packagingOrders: tank.activeLot.packagingOrders.map((order) => ({
          packagingOrder: order.packagingOrder,
          line: order.line,
          format: order.format,
          startedAt: order.startedAt
        }))
      } : null
    }));
  }

  async tanks(companyId: string) {
    const configuredTargets = await this.targetSeconds(companyId);
    const tanks = await this.prisma.tank.findMany({
      where: { companyId },
      include: {
        stateHistory: { where: { endedAt: null }, orderBy: { startedAt: 'desc' }, take: 1 },
        activeLot: {
          include: {
            packagingOrders: { where: { finishedAt: null }, orderBy: { startedAt: 'desc' }, take: 1 },
            qualityDecisions: { orderBy: { createdAt: 'desc' }, take: 1 }
          }
        }
      },
      orderBy: { number: 'asc' }
    });

    return tanks.map((tank) => {
      const reading = this.weights.get(`${companyId}:${tank.scaleKey}`);
      const age = reading ? Date.now() - new Date(reading.receivedAt).getTime() : Number.POSITIVE_INFINITY;
      const currentPeriod = tank.stateHistory[0];
      const stateElapsedSeconds = currentPeriod ? Math.max(0, Math.floor((Date.now() - currentPeriod.startedAt.getTime()) / 1000)) : null;
      const targetSeconds = currentPeriod?.targetSeconds ?? configuredTargets[tank.state] ?? null;
      return {
        ...tank,
        capacityKg: tank.capacityKg === null ? null : Number(tank.capacityKg),
        activeLot: tank.activeLot ? {
          ...tank.activeLot,
          specificWeight: tank.activeLot.specificWeight === null ? null : Number(tank.activeLot.specificWeight)
        } : null,
        stateStartedAt: currentPeriod?.startedAt ?? tank.updatedAt,
        stateElapsedSeconds,
        stateTargetSeconds: targetSeconds,
        stateAttention: targetSeconds && stateElapsedSeconds !== null
          ? stateElapsedSeconds >= targetSeconds ? 'CRITICAL' : stateElapsedSeconds >= targetSeconds * .8 ? 'WARNING' : 'OK'
          : 'OK',
        telemetry: reading ? { ...reading, online: age <= 10_000, ageMs: age } : { grossKg: null, netKg: null, measuredAt: null, receivedAt: null, online: false, ageMs: null }
      };
    });
  }

  ingestWeights(apiKey: string | undefined, companyId: string | undefined, dto: WeightBatchDto) {
    const expected = this.config.get<string>('NODE_RED_API_KEY');
    const targetCompany = companyId?.trim() || this.config.get<string>('SYSTEM_OWNER_COMPANY_ID') || 'seed_company_disal';
    if (!expected || apiKey !== expected) throw new UnauthorizedException('Clave de integración inválida');
    const now = new Date().toISOString();
    for (const reading of dto.readings) {
      const measuredAt = reading.measuredAt && !Number.isNaN(Date.parse(reading.measuredAt)) ? new Date(reading.measuredAt).toISOString() : now;
      this.weights.set(`${targetCompany}:${reading.scaleKey}`, {
        grossKg: reading.grossKg,
        netKg: reading.netKg,
        measuredAt,
        receivedAt: now
      });
    }
    return { accepted: dto.readings.length, receivedAt: now, persisted: false };
  }

  async start(companyId: string, tankId: string, user: JwtUser, dto: StartManufacturingDto) {
    return this.prisma.$transaction(async (tx) => {
      const tank = await this.findTank(tx, companyId, tankId);
      this.assertTank(tank, 'VACIO', dto.version);
      const lot = await tx.productionLot.create({ data: {
        companyId, tankId, manufacturingOrder: dto.manufacturingOrder,
        materialCode: dto.materialCode, description: dto.description.trim(), createdByUserId: user.sub,
        plannedQuantityKg: dto.plannedQuantityKg, priority: dto.priority ?? 'NORMAL', shift: dto.shift,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined
      }});
      await this.move(tx, tank, 'FABRICANDO', user, lot.id, `OF ${dto.manufacturingOrder}`);
      await tx.tank.update({ where: { id: tank.id }, data: { activeLotId: lot.id } });
      await this.audit(tx, companyId, user, tank.id, lot.id, 'CREATE', 'ProductionLot', lot.id, null, dto, null);
      return { ok: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async sendToLab(companyId: string, tankId: string, user: JwtUser, dto: VersionedActionDto) {
    return this.prisma.$transaction(async (tx) => {
      const tank = await this.findTank(tx, companyId, tankId);
      if (!['FABRICANDO', 'AJUSTE'].includes(tank.state)) throw new ConflictException(`La transición ${tank.state} → LABORATORIO no está permitida`);
      if (tank.version !== dto.version) throw new ConflictException('El tanque cambió. Actualizá la pantalla.');
      await this.move(tx, tank, 'LABORATORIO', user, tank.activeLotId, dto.reason);
      await this.notifications.notifyTankAction(tx, {
        companyId, actorUserId: user.sub, tankId: tank.id, targetSector: 'LABORATORIO',
        title: 'Tanque disponible para analizar',
        message: `${tank.name} ingresó a Laboratorio y espera el análisis de calidad.`
      });
      return { ok: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async quality(companyId: string, tankId: string, user: JwtUser, dto: QualityDecisionDto) {
    if (dto.result === 'APROBADO' && (!dto.specificWeight || dto.specificWeight <= 0)) {
      throw new BadRequestException('El peso específico es obligatorio para aprobar');
    }
    if (dto.result === 'AJUSTE' && !dto.reason) throw new BadRequestException('Seleccioná un motivo de ajuste');
    if (dto.result.startsWith('RECHAZADO') && !dto.reason) throw new BadRequestException('Indicá el motivo del rechazo');
    if (dto.result === 'RECHAZADO_RECUPERAR' && !dto.recoveryAction) throw new BadRequestException('Indicá el destino de recuperación');

    return this.prisma.$transaction(async (tx) => {
      const tank = await this.findTank(tx, companyId, tankId);
      this.assertTank(tank, 'LABORATORIO', dto.version);
      if (!tank.activeLotId) throw new ConflictException('El tanque no tiene un lote activo');
      const state: TankState = dto.result === 'APROBADO' ? 'APROBADO' : dto.result === 'AJUSTE' ? 'AJUSTE' : 'RECHAZADO';
      const decision = await tx.qualityDecision.create({ data: {
        companyId, lotId: tank.activeLotId, result: dto.result as QualityResult,
        employeeNumber: dto.employeeNumber, specificWeight: dto.specificWeight,
        reason: dto.reason, recoveryAction: dto.recoveryAction, userId: user.sub
      }});
      await tx.productionLot.update({ where: { id: tank.activeLotId }, data: { specificWeight: state === 'APROBADO' ? dto.specificWeight : null } });
      await this.move(tx, tank, state, user, tank.activeLotId, dto.reason ?? dto.result);
      if (state === 'APROBADO') {
        await this.notifications.notifyTankAction(tx, {
          companyId, actorUserId: user.sub, tankId: tank.id, targetSector: 'ENVASADO',
          title: 'Tanque aprobado para envasar',
          message: `${tank.name} fue aprobado por Laboratorio y está disponible para iniciar el envasado.`
        });
      } else {
        await this.notifications.notifyTankAction(tx, {
          companyId, actorUserId: user.sub, tankId: tank.id, targetSector: 'FABRICACION',
          title: state === 'AJUSTE' ? 'Tanque requiere ajuste' : 'Tanque rechazado por Laboratorio',
          message: `${tank.name} requiere intervención de Fabricación${dto.reason ? `: ${dto.reason}` : '.'}`
        });
      }
      await this.audit(tx, companyId, user, tank.id, tank.activeLotId, 'QUALITY_DECISION', 'QualityDecision', decision.id, null, dto, dto.reason);
      return { ok: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async startPackaging(companyId: string, tankId: string, user: JwtUser, dto: PackagingDto) {
    await this.validatePackaging(companyId, dto);
    return this.prisma.$transaction(async (tx) => {
      const tank = await this.findTank(tx, companyId, tankId);
      this.assertTank(tank, 'APROBADO', dto.version);
      if (!tank.activeLotId) throw new ConflictException('El tanque no tiene un lote activo');
      const order = await tx.packagingOrder.create({ data: {
        companyId, tankId, lotId: tank.activeLotId, packagingOrder: dto.packagingOrder,
        line: dto.line, format: dto.format, startedByUserId: user.sub
      }});
      await this.move(tx, tank, 'ENVASANDO', user, tank.activeLotId, `OE ${dto.packagingOrder}`);
      await this.audit(tx, companyId, user, tank.id, tank.activeLotId, 'CREATE', 'PackagingOrder', order.id, null, dto, null);
      return { ok: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async newPackagingOrder(companyId: string, tankId: string, user: JwtUser, dto: PackagingDto) {
    await this.validatePackaging(companyId, dto);
    return this.prisma.$transaction(async (tx) => {
      const tank = await this.findTank(tx, companyId, tankId);
      this.assertTank(tank, 'ENVASANDO', dto.version);
      if (!tank.activeLotId) throw new ConflictException('El tanque no tiene un lote activo');
      await this.closePackaging(tx, tank.id, user.sub);
      const order = await tx.packagingOrder.create({ data: {
        companyId, tankId, lotId: tank.activeLotId, packagingOrder: dto.packagingOrder,
        line: dto.line, format: dto.format, startedByUserId: user.sub
      }});
      const changed = await tx.tank.updateMany({ where: { id: tank.id, version: tank.version, state: tank.state }, data: { version: { increment: 1 } } });
      if (changed.count !== 1) throw new ConflictException('El tanque cambió. Actualizá la pantalla.');
      await this.audit(tx, companyId, user, tank.id, tank.activeLotId, 'NEW_ORDER', 'PackagingOrder', order.id, null, dto, dto.reason);
      return { ok: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async correctPackaging(companyId: string, tankId: string, user: JwtUser, dto: CorrectPackagingDto) {
    await this.validatePackaging(companyId, dto);
    return this.prisma.$transaction(async (tx) => {
      const tank = await this.findTank(tx, companyId, tankId);
      this.assertTank(tank, 'ENVASANDO', dto.version);
      const current = await tx.packagingOrder.findFirst({ where: { tankId, finishedAt: null }, orderBy: { startedAt: 'desc' } });
      if (!current) throw new ConflictException('No existe una OE abierta');
      const after = await tx.packagingOrder.update({ where: { id: current.id }, data: {
        packagingOrder: dto.packagingOrder, line: dto.line, format: dto.format
      }});
      const changed = await tx.tank.updateMany({ where: { id: tank.id, version: tank.version }, data: { version: { increment: 1 } } });
      if (changed.count !== 1) throw new ConflictException('El tanque cambió. Actualizá la pantalla.');
      await this.audit(tx, companyId, user, tank.id, tank.activeLotId, 'CORRECTION', 'PackagingOrder', current.id, current, after, dto.reason);
      return { ok: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async finishPackaging(companyId: string, tankId: string, user: JwtUser, dto: FinishPackagingDto) {
    return this.prisma.$transaction(async (tx) => {
      const tank = await this.findTank(tx, companyId, tankId);
      this.assertTank(tank, 'ENVASANDO', dto.version);
      await this.closePackaging(tx, tank.id, user.sub, dto);
      if (tank.activeLotId) await tx.productionLot.update({ where: { id: tank.activeLotId }, data: { finishedAt: new Date() } });
      await this.move(tx, tank, 'VACIO', user, tank.activeLotId, 'Fin de envasado');
      await tx.tank.update({ where: { id: tank.id }, data: { activeLotId: null } });
      await this.notifications.notifyTankAction(tx, {
        companyId, actorUserId: user.sub, tankId: tank.id, targetSector: 'FABRICACION',
        title: 'Tanque disponible para fabricar',
        message: `${tank.name} finalizó el envasado y quedó vacío para una nueva fabricación.`
      });
      return { ok: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async emptyRejected(companyId: string, tankId: string, user: JwtUser, dto: VersionedActionDto) {
    return this.prisma.$transaction(async (tx) => {
      const tank = await this.findTank(tx, companyId, tankId);
      this.assertTank(tank, 'RECHAZADO', dto.version);
      if (tank.activeLotId) await tx.productionLot.update({ where: { id: tank.activeLotId }, data: { finishedAt: new Date() } });
      await this.move(tx, tank, 'VACIO', user, tank.activeLotId, dto.reason ?? 'Vaciado de lote rechazado');
      await tx.tank.update({ where: { id: tank.id }, data: { activeLotId: null } });
      return { ok: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async serviceOut(companyId: string, tankId: string, user: JwtUser, dto: ServiceDto) {
    return this.prisma.$transaction(async (tx) => {
      const tank = await this.findTank(tx, companyId, tankId);
      this.assertTank(tank, 'VACIO', dto.version);
      await this.move(tx, tank, 'FUERA_DE_SERVICIO', user, null, dto.reason, { serviceReason: dto.reason, serviceNotes: dto.notes });
      return { ok: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async serviceIn(companyId: string, tankId: string, user: JwtUser, dto: VersionedActionDto) {
    return this.prisma.$transaction(async (tx) => {
      const tank = await this.findTank(tx, companyId, tankId);
      this.assertTank(tank, 'FUERA_DE_SERVICIO', dto.version);
      await this.move(tx, tank, 'VACIO', user, null, dto.reason ?? 'Equipo habilitado', { serviceReason: null, serviceNotes: null });
      return { ok: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async correctLot(companyId: string, tankId: string, user: JwtUser, dto: CorrectLotDto) {
    return this.prisma.$transaction(async (tx) => {
      const tank = await this.findTank(tx, companyId, tankId);
      if (tank.version !== dto.version || !tank.activeLotId) throw new ConflictException('El tanque cambió. Actualizá la pantalla.');
      const before = await tx.productionLot.findUniqueOrThrow({ where: { id: tank.activeLotId } });
      const after = await tx.productionLot.update({ where: { id: tank.activeLotId }, data: {
        manufacturingOrder: dto.manufacturingOrder,
        materialCode: dto.materialCode,
        description: dto.description?.trim()
      }});
      const changed = await tx.tank.updateMany({ where: { id: tank.id, version: tank.version }, data: { version: { increment: 1 } } });
      if (changed.count !== 1) throw new ConflictException('El tanque cambió. Actualizá la pantalla.');
      await this.audit(tx, companyId, user, tank.id, tank.activeLotId, 'CORRECTION', 'ProductionLot', tank.activeLotId, before, after, dto.reason);
      return { ok: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async history(companyId: string, tankId?: string, state?: string, from?: string, to?: string) {
    const fromDate = from ? this.plantDayBounds(from).start : undefined;
    const toDate = to ? this.plantDayBounds(to).end : undefined;
    const rows = await this.prisma.tankStateHistory.findMany({
      where: {
        companyId,
        tankId: tankId || undefined,
        state: state && Object.values(TankState).includes(state as TankState) ? state as TankState : undefined,
        startedAt: { lt: toDate },
        OR: fromDate ? [{ endedAt: null }, { endedAt: { gte: fromDate } }] : undefined
      },
      include: { tank: { select: { number: true, name: true } }, lot: true, user: { select: { fullName: true, username: true } } },
      orderBy: { startedAt: 'desc' }, take: 1000
    });
    const now = new Date();
    return rows.map((row) => ({
      ...row,
      durationSeconds: row.durationSeconds ?? Math.max(0, Math.floor(((row.endedAt ?? now).getTime() - row.startedAt.getTime()) / 1000))
    }));
  }

  async lotTimeline(companyId: string, lotId: string) {
    const lot = await this.prisma.productionLot.findFirst({
      where: { id: lotId, companyId },
      include: {
        tank: { select: { name: true, number: true } },
        stateHistory: { include: { user: { select: { fullName: true, username: true } } }, orderBy: { startedAt: 'asc' } },
        qualityDecisions: { include: { user: { select: { fullName: true } } }, orderBy: { createdAt: 'asc' } },
        packagingOrders: { include: { startedBy: { select: { fullName: true } }, finishedBy: { select: { fullName: true } } }, orderBy: { startedAt: 'asc' } }
      }
    });
    if (!lot) throw new NotFoundException('Orden de fabricación no encontrada');
    const now = new Date();
    return {
      ...lot,
      specificWeight: lot.specificWeight === null ? null : Number(lot.specificWeight),
      plannedQuantityKg: lot.plannedQuantityKg === null ? null : Number(lot.plannedQuantityKg),
      totalDurationSeconds: Math.max(0, Math.floor(((lot.finishedAt ?? now).getTime() - lot.startedAt.getTime()) / 1000)),
      stateHistory: lot.stateHistory.map((row) => ({
        ...row,
        weightKg: row.weightKg === null ? null : Number(row.weightKg),
        durationSeconds: row.durationSeconds ?? Math.max(0, Math.floor(((row.endedAt ?? now).getTime() - row.startedAt.getTime()) / 1000))
      })),
      packagingOrders: lot.packagingOrders.map((order) => ({
        ...order,
        producedKg: order.producedKg === null ? null : Number(order.producedKg),
        wasteKg: order.wasteKg === null ? null : Number(order.wasteKg)
      }))
    };
  }

  async dailyManagement(companyId: string, date: string) {
    const { start, end } = this.plantDayBounds(date);
    const now = new Date();
    const isLive = now >= start && now < end;
    const reportAt = isLive ? now : new Date(end.getTime() - 1);
    const [liveTanks, periods, completedLots, quality, packaging, closure] = await Promise.all([
      this.tanks(companyId),
      this.prisma.tankStateHistory.findMany({
        where: { companyId, startedAt: { lt: end }, OR: [{ endedAt: null }, { endedAt: { gte: start } }] },
        include: { tank: { select: { name: true, number: true } }, lot: { select: { id: true, manufacturingOrder: true, materialCode: true, description: true, priority: true, plannedQuantityKg: true } } },
        orderBy: { startedAt: 'asc' }
      }),
      this.prisma.productionLot.findMany({ where: { companyId, finishedAt: { gte: start, lt: end } }, select: { id: true, manufacturingOrder: true, materialCode: true, description: true, startedAt: true, finishedAt: true } }),
      this.prisma.qualityDecision.findMany({ where: { companyId, createdAt: { gte: start, lt: end } }, select: { result: true } }),
      this.prisma.packagingOrder.findMany({ where: { companyId, finishedAt: { gte: start, lt: end } }, select: { producedKg: true, wasteKg: true, producedUnits: true, durationSeconds: true } }),
      this.prisma.dailyPlantClosure.findUnique({ where: { companyId_date: { companyId, date: start } }, include: { createdBy: { select: { fullName: true } } } })
    ]);
    const durationByState: Record<string, number> = {};
    for (const period of periods) {
      const effectiveStart = Math.max(period.startedAt.getTime(), start.getTime());
      const effectiveEnd = Math.min((period.endedAt ?? new Date()).getTime(), end.getTime());
      durationByState[period.state] = (durationByState[period.state] ?? 0) + Math.max(0, Math.floor((effectiveEnd - effectiveStart) / 1000));
    }
    const tanks = isLive ? liveTanks : liveTanks.map((tank) => {
      const period = [...periods].reverse().find((candidate) =>
        candidate.tankId === tank.id
        && candidate.startedAt <= reportAt
        && (!candidate.endedAt || candidate.endedAt > reportAt)
      );
      const elapsed = period ? Math.max(0, Math.floor((reportAt.getTime() - period.startedAt.getTime()) / 1000)) : 0;
      const target = period?.targetSeconds ?? null;
      return {
        ...tank,
        state: period?.state ?? TankState.VACIO,
        activeLot: period?.lot ? { ...period.lot, plannedQuantityKg: period.lot.plannedQuantityKg === null ? null : Number(period.lot.plannedQuantityKg) } : null,
        stateStartedAt: period?.startedAt ?? start,
        stateElapsedSeconds: elapsed,
        stateTargetSeconds: target,
        stateAttention: target ? elapsed >= target ? 'CRITICAL' : elapsed >= target * .8 ? 'WARNING' : 'OK' : 'OK',
        telemetry: { grossKg: period?.weightKg === null || period?.weightKg === undefined ? null : Number(period.weightKg), netKg: null, measuredAt: null, receivedAt: null, online: true, ageMs: null }
      };
    });
    const totals = packaging.reduce((acc, order) => ({
      producedKg: acc.producedKg + Number(order.producedKg ?? 0),
      wasteKg: acc.wasteKg + Number(order.wasteKg ?? 0),
      producedUnits: acc.producedUnits + Number(order.producedUnits ?? 0)
    }), { producedKg: 0, wasteKg: 0, producedUnits: 0 });
    const currentByState = tanks.reduce<Record<string, number>>((acc, tank) => {
      acc[tank.state] = (acc[tank.state] ?? 0) + 1;
      return acc;
    }, {});
    return {
      date,
      generatedAt: new Date().toISOString(),
      isLive,
      snapshotAt: reportAt.toISOString(),
      currentByState,
      onlineScales: isLive ? tanks.filter((tank) => tank.telemetry.online).length : null,
      completedLots: completedLots.map((lot) => ({ ...lot, durationSeconds: Math.max(0, Math.floor(((lot.finishedAt?.getTime() ?? Date.now()) - lot.startedAt.getTime()) / 1000)) })),
      quality: quality.reduce<Record<string, number>>((acc, decision) => { acc[decision.result] = (acc[decision.result] ?? 0) + 1; return acc; }, {}),
      packaging: { ...totals, completedOrders: packaging.length },
      durationByState,
      tanks,
      attention: tanks.filter((tank) => tank.stateAttention !== 'OK' || (isLive && !tank.telemetry.online)),
      closure
    };
  }

  async closeDay(companyId: string, user: JwtUser, dto: DailyClosureDto) {
    const snapshot = await this.dailyManagement(companyId, dto.date);
    const { start } = this.plantDayBounds(dto.date);
    const existing = await this.prisma.dailyPlantClosure.findUnique({ where: { companyId_date: { companyId, date: start } } });
    if (existing) throw new ConflictException('La jornada ya fue cerrada y su fotografía no puede modificarse');
    const serializableSnapshot = JSON.parse(JSON.stringify({ ...snapshot, closure: null })) as Prisma.InputJsonValue;
    return this.prisma.dailyPlantClosure.create({
      data: { companyId, date: start, snapshot: serializableSnapshot, notes: dto.notes, createdByUserId: user.sub },
      include: { createdBy: { select: { fullName: true } } }
    });
  }

  closures(companyId: string) {
    return this.prisma.dailyPlantClosure.findMany({ where: { companyId }, include: { createdBy: { select: { fullName: true } } }, orderBy: { date: 'desc' }, take: 90 });
  }

  async updateTargets(companyId: string, dto: StageTargetsDto) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { settings: true } });
    if (!company) throw new NotFoundException('Empresa no encontrada');
    const settings = (company.settings ?? {}) as Record<string, unknown>;
    const plantStageTargetsMinutes = {
      FABRICANDO: dto.fabricando, LABORATORIO: dto.laboratorio, AJUSTE: dto.ajuste,
      RECHAZADO: dto.rechazado, APROBADO: dto.aprobado, ENVASANDO: dto.envasando,
      FUERA_DE_SERVICIO: dto.fueraDeServicio
    };
    await this.prisma.company.update({ where: { id: companyId }, data: { settings: { ...settings, plantStageTargetsMinutes } as Prisma.InputJsonValue } });
    return { stageTargetsMinutes: plantStageTargetsMinutes };
  }

  async managementExport(companyId: string, date: string, format: 'pdf' | 'xls') {
    const liveReport = await this.dailyManagement(companyId, date);
    const report = liveReport.closure?.snapshot
      ? { ...(liveReport.closure.snapshot as unknown as Omit<typeof liveReport, 'closure'>), isLive: false }
      : liveReport;
    if (format === 'xls') {
      const rows = report.tanks.map((tank) => [
        tank.name,
        tank.activeLot?.manufacturingOrder ?? '',
        tank.activeLot?.materialCode ?? '',
        tank.activeLot?.description ?? '',
        tank.state,
        tank.stateStartedAt ? new Date(tank.stateStartedAt).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) : '',
        tank.stateElapsedSeconds ?? 0,
        tank.telemetry.online ? 'En línea' : 'Sin señal'
      ]);
      const xmlRows = [['Tanque', 'OF', 'Material', 'Descripción', 'Estado', 'Desde', 'Duración (seg)', 'Balanza'], ...rows]
        .map((row) => `<Row>${row.map((cell) => `<Cell><Data ss:Type="${typeof cell === 'number' ? 'Number' : 'String'}">${this.escapeXml(String(cell))}</Data></Cell>`).join('')}</Row>`)
        .join('');
      const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Resumen diario"><Table>${xmlRows}</Table></Worksheet></Workbook>`;
      return { body: Buffer.from(`\ufeff${xml}`, 'utf8'), contentType: 'application/vnd.ms-excel; charset=utf-8', filename: `DISAL-resumen-${date}.xls` };
    }
    return { body: this.managementPdf(report, date), contentType: 'application/pdf', filename: `DISAL-resumen-${date}.pdf` };
  }

  auditHistory(companyId: string, tankId?: string) {
    return this.prisma.plantAuditLog.findMany({
      where: { companyId, tankId: tankId || undefined },
      include: { tank: { select: { number: true, name: true } }, user: { select: { fullName: true, username: true } } },
      orderBy: { createdAt: 'desc' }, take: 1000
    });
  }

  private async validatePackaging(companyId: string, dto: PackagingDto) {
    const config = await this.loadConfig(companyId);
    if (!config.lines.includes(dto.line)) throw new BadRequestException('Línea no configurada');
    if (!config.formats.includes(dto.format)) throw new BadRequestException('Formato no configurado');
  }

  private async loadConfig(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { settings: true } });
    const settings = (company?.settings ?? {}) as Record<string, unknown>;
    const configuredTargets = settings.plantStageTargetsMinutes as Record<string, unknown> | undefined;
    return {
      lines: Array.isArray(settings.packagingLines) ? settings.packagingLines.filter((v): v is string => typeof v === 'string') : LINES,
      formats: Array.isArray(settings.packagingFormats) ? settings.packagingFormats.filter((v): v is string => typeof v === 'string') : FORMATS,
      adjustmentReasons: Array.isArray(settings.adjustmentReasons) ? settings.adjustmentReasons.filter((v): v is string => typeof v === 'string') : ADJUSTMENT_REASONS,
      stageTargetsMinutes: Object.fromEntries(Object.entries(DEFAULT_TARGET_SECONDS).map(([state, seconds]) => [state, Number(configuredTargets?.[state]) || Math.round(seconds / 60)]))
    };
  }

  private async transition(companyId: string, tankId: string, user: JwtUser, dto: VersionedActionDto, from: TankState[], to: TankState, description?: string) {
    return this.prisma.$transaction(async (tx) => {
      const tank = await this.findTank(tx, companyId, tankId);
      if (!from.includes(tank.state)) throw new ConflictException(`La transición ${tank.state} → ${to} no está permitida`);
      if (tank.version !== dto.version) throw new ConflictException('El tanque cambió. Actualizá la pantalla.');
      await this.move(tx, tank, to, user, tank.activeLotId, description);
      return { ok: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private findTank(tx: Prisma.TransactionClient, companyId: string, id: string) {
    return tx.tank.findFirst({ where: { id, companyId } }).then((tank) => {
      if (!tank) throw new NotFoundException('Tanque no encontrado');
      return tank;
    });
  }

  private assertTank(tank: { state: TankState; version: number }, state: TankState, version: number) {
    if (tank.version !== version) throw new ConflictException('El tanque cambió. Actualizá la pantalla.');
    if (tank.state !== state) throw new ConflictException(`La acción requiere estado ${state}; el tanque está ${tank.state}`);
  }

  private async move(
    tx: Prisma.TransactionClient,
    tank: { id: string; companyId: string; state: TankState; version: number; scaleKey?: string },
    state: TankState,
    user: JwtUser,
    lotId: string | null,
    description?: string,
    extra: Prisma.TankUpdateManyMutationInput = {}
  ) {
    const changed = await tx.tank.updateMany({
      where: { id: tank.id, state: tank.state, version: tank.version },
      data: { state, version: { increment: 1 }, ...extra }
    });
    if (changed.count !== 1) throw new ConflictException('El tanque cambió. Actualizá la pantalla.');
    const changedAt = new Date();
    const openPeriod = await tx.tankStateHistory.findFirst({ where: { tankId: tank.id, endedAt: null }, orderBy: { startedAt: 'desc' } });
    if (openPeriod) {
      await tx.tankStateHistory.update({ where: { id: openPeriod.id }, data: {
        endedAt: changedAt,
        durationSeconds: Math.max(0, Math.floor((changedAt.getTime() - openPeriod.startedAt.getTime()) / 1000))
      }});
    }
    const weight = tank.scaleKey ? this.weights.get(`${tank.companyId}:${tank.scaleKey}`)?.grossKg : undefined;
    const configuredTargets = await this.targetSeconds(tank.companyId, tx);
    await tx.tankStateHistory.create({ data: {
      companyId: tank.companyId, tankId: tank.id, lotId, state, description, userId: user.sub,
      weightKg: weight, targetSeconds: configuredTargets[state]
    } });
    await this.audit(tx, tank.companyId, user, tank.id, lotId, 'STATUS_CHANGE', 'Tank', tank.id, { state: tank.state }, { state }, description);
  }

  private async closePackaging(
    tx: Prisma.TransactionClient,
    tankId: string,
    userId: string,
    metrics?: { producedKg?: number; wasteKg?: number; producedUnits?: number }
  ) {
    const current = await tx.packagingOrder.findFirst({ where: { tankId, finishedAt: null }, orderBy: { startedAt: 'desc' } });
    if (!current) throw new ConflictException('No existe una OE abierta');
    const finishedAt = new Date();
    await tx.packagingOrder.update({ where: { id: current.id }, data: {
      finishedAt, finishedByUserId: userId,
      durationSeconds: Math.max(0, Math.floor((finishedAt.getTime() - current.startedAt.getTime()) / 1000)),
      producedKg: metrics?.producedKg,
      wasteKg: metrics?.wasteKg,
      producedUnits: metrics?.producedUnits
    }});
  }

  private audit(
    tx: Prisma.TransactionClient, companyId: string, user: JwtUser, tankId: string | null,
    lotId: string | null, action: string, entityType: string, entityId: string,
    before: unknown, after: unknown, reason: string | null | undefined
  ) {
    return tx.plantAuditLog.create({ data: {
      companyId, userId: user.sub, tankId, lotId, action, entityType, entityId, reason,
      before: before === null ? Prisma.JsonNull : before as Prisma.InputJsonValue,
      after: after === null ? Prisma.JsonNull : after as Prisma.InputJsonValue
    }});
  }

  private plantDayBounds(date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException('Fecha inválida');
    const localMidnightAsUtc = Date.parse(`${date}T00:00:00.000Z`);
    if (Number.isNaN(localMidnightAsUtc)) throw new BadRequestException('Fecha inválida');
    const start = new Date(localMidnightAsUtc + BUENOS_AIRES_OFFSET_MS);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start, end };
  }

  private async targetSeconds(companyId: string, tx: Prisma.TransactionClient | PrismaService = this.prisma) {
    const company = await tx.company.findUnique({ where: { id: companyId }, select: { settings: true } });
    const settings = (company?.settings ?? {}) as Record<string, unknown>;
    const configured = settings.plantStageTargetsMinutes as Record<string, unknown> | undefined;
    return Object.fromEntries(Object.entries(DEFAULT_TARGET_SECONDS).map(([state, fallback]) => {
      const minutes = Number(configured?.[state]);
      return [state, Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : fallback];
    })) as Partial<Record<TankState, number>>;
  }

  private escapeXml(value: string) {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  }

  private managementPdf(report: {
    generatedAt: string;
    isLive?: boolean;
    snapshotAt?: string;
    onlineScales: number | null;
    completedLots: unknown[];
    packaging: { producedKg: number; wasteKg: number; producedUnits: number; completedOrders: number };
    quality: Record<string, number>;
    tanks: Array<{
      name: string; state: string; stateElapsedSeconds: number | null;
      activeLot: null | { manufacturingOrder: string; materialCode: string; description: string };
      telemetry: { grossKg: number | null; online: boolean };
    }>;
    attention: unknown[];
  }, date: string) {
    const commands: string[] = [];
    const clean = (value: string, max = 160) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '').slice(0, max).replace(/([\\()])/g, '\\$1');
    const fill = (x: number, y: number, width: number, height: number, color: string) => commands.push(`${color} rg ${x} ${y} ${width} ${height} re f`);
    const stroke = (x: number, y: number, width: number, height: number, color: string) => commands.push(`${color} RG 0.7 w ${x} ${y} ${width} ${height} re S`);
    const text = (value: string, x: number, y: number, size = 9, bold = false, color = '0.18 0.23 0.28') => {
      commands.push(`BT ${color} rg /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td (${clean(value)}) Tj ET`);
    };
    const minutes = (seconds: number | null) => {
      const total = Math.max(0, Math.round((seconds ?? 0) / 60));
      return total >= 60 ? `${Math.floor(total / 60)} h ${total % 60} min` : `${total} min`;
    };
    const localDate = new Date(`${date}T12:00:00-03:00`).toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' });
    const generated = new Date(report.generatedAt).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

    fill(0, 0, 842, 595, '0.965 0.975 0.982');
    fill(0, 520, 842, 75, '0.035 0.086 0.125');
    fill(0, 516, 842, 4, '0.020 0.620 0.850');
    text('DISAL', 36, 559, 23, true, '1 1 1');
    text('PLANTA DE LATEX', 37, 543, 8, true, '0.36 0.80 0.97');
    text('RESUMEN DIARIO DE PRODUCCION', 220, 560, 18, true, '1 1 1');
    text(localDate.toUpperCase(), 220, 541, 10, false, '0.75 0.83 0.89');
    text(report.isLive ? 'ESTADO EN VIVO' : 'CIERRE DEL DIA SELECCIONADO', 665, 552, 8, true, report.isLive ? '0.25 0.84 0.48' : '0.98 0.72 0.20');

    const incidents = (report.quality.AJUSTE ?? 0) + (report.quality.RECHAZADO_RECUPERAR ?? 0) + (report.quality.RECHAZADO_DESTRUIR ?? 0);
    const cards = [
      ['LOTES FINALIZADOS', String(report.completedLots.length), '0.020 0.620 0.850'],
      ['KG ENVASADOS', Math.round(report.packaging.producedKg).toLocaleString('es-AR'), '0.18 0.62 0.30'],
      ['MERMA', `${Math.round(report.packaging.wasteKg).toLocaleString('es-AR')} kg`, '0.92 0.54 0.14'],
      ['AJUSTES / RECHAZOS', String(incidents), incidents ? '0.82 0.20 0.22' : '0.18 0.62 0.30']
    ];
    cards.forEach(([label, value, color], index) => {
      const x = 36 + index * 196;
      fill(x, 444, 180, 56, '1 1 1'); stroke(x, 444, 180, 56, '0.82 0.86 0.89'); fill(x, 444, 5, 56, color);
      text(label, x + 16, 480, 7, true, '0.39 0.47 0.54'); text(value, x + 16, 455, 18, true, '0.08 0.14 0.19');
    });

    fill(36, 407, 770, 25, '0.08 0.16 0.22');
    const columns = [42, 102, 176, 258, 436, 532, 626, 724];
    ['TANQUE', 'OF', 'MATERIAL', 'PRODUCTO', 'ESTADO', 'DESDE', 'DURACION', 'PESO'].forEach((header, index) => text(header, columns[index], 416, 7, true, '0.72 0.88 0.96'));
    report.tanks.slice(0, 9).forEach((tank, index) => {
      const y = 378 - index * 33;
      fill(36, y - 9, 770, 32, index % 2 ? '0.945 0.960 0.970' : '1 1 1');
      text(tank.name, columns[0], y, 9, true);
      text(tank.activeLot?.manufacturingOrder ?? '-', columns[1], y, 8, true);
      text(tank.activeLot?.materialCode ?? '-', columns[2], y, 8);
      text(tank.activeLot?.description ?? 'Sin OF activa', columns[3], y, 8, false, '0.18 0.23 0.28');
      text(tank.state.replaceAll('_', ' '), columns[4], y, 7, true, tank.state === 'RECHAZADO' ? '0.78 0.13 0.16' : '0.06 0.43 0.63');
      text(report.snapshotAt ? new Date(tank.stateElapsedSeconds === null ? report.snapshotAt : new Date(report.snapshotAt).getTime() - tank.stateElapsedSeconds * 1000).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' }) : '-', columns[5], y, 8);
      text(minutes(tank.stateElapsedSeconds), columns[6], y, 8);
      text(tank.telemetry.grossKg === null ? '-' : `${Math.round(tank.telemetry.grossKg).toLocaleString('es-AR')} kg`, columns[7], y, 8, true);
    });

    fill(36, 54, 770, 28, report.attention.length ? '0.995 0.925 0.925' : '0.910 0.975 0.930');
    text(report.attention.length ? `${report.attention.length} situaciones requieren seguimiento.` : 'Sin situaciones criticas para el periodo seleccionado.', 48, 64, 9, true, report.attention.length ? '0.70 0.13 0.16' : '0.12 0.49 0.25');
    text(`Generado: ${generated}  |  Fuente: Sistema de produccion DISAL  |  Documento para reunion diaria`, 36, 27, 7, false, '0.43 0.49 0.54');
    text('Pagina 1 de 1', 749, 27, 7, false, '0.43 0.49 0.54');

    const stream = commands.join('\n');
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
    ];
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
    const xref = Buffer.byteLength(pdf);
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\n`;
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(pdf, 'ascii');
  }
}
