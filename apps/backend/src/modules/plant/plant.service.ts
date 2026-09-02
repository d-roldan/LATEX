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
  PackagingDto,
  QualityDecisionDto,
  ServiceDto,
  StartManufacturingDto,
  VersionedActionDto,
  WeightBatchDto
} from './dto/plant.dto';

type Telemetry = { grossKg: number; netKg?: number; measuredAt: string; receivedAt: string };

const LINES = ['Línea 1', 'Línea 20', 'Línea 3'];
const FORMATS = ['0,25 L', '0,50 L', '1 L', '4 L', '10 L'];
const ADJUSTMENT_REASONS = [
  'Nivel del tanque', 'Viscosidad', 'Cubritivo', 'Preservación', 'Brillo', 'Lavabilidad',
  'Color', 'Reemplazo de materia prima', 'Error operativo o de proceso', 'Desaereante',
  'Cambio de almacenamiento de producción'
];

@Injectable()
export class PlantService {
  private readonly weights = new Map<string, Telemetry>();

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async getConfig(companyId: string) {
    return this.loadConfig(companyId);
  }

  async tanks(companyId: string) {
    const tanks = await this.prisma.tank.findMany({
      where: { companyId },
      include: {
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
      return {
        ...tank,
        capacityKg: tank.capacityKg === null ? null : Number(tank.capacityKg),
        activeLot: tank.activeLot ? {
          ...tank.activeLot,
          specificWeight: tank.activeLot.specificWeight === null ? null : Number(tank.activeLot.specificWeight)
        } : null,
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
        materialCode: dto.materialCode, description: dto.description.trim(), createdByUserId: user.sub
      }});
      await this.move(tx, tank, 'FABRICANDO', user, lot.id, `OF ${dto.manufacturingOrder}`);
      await tx.tank.update({ where: { id: tank.id }, data: { activeLotId: lot.id } });
      await this.audit(tx, companyId, user, tank.id, lot.id, 'CREATE', 'ProductionLot', lot.id, null, dto, null);
      return { ok: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async sendToLab(companyId: string, tankId: string, user: JwtUser, dto: VersionedActionDto) {
    return this.transition(companyId, tankId, user, dto, ['FABRICANDO', 'AJUSTE'], 'LABORATORIO', dto.reason);
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

  async finishPackaging(companyId: string, tankId: string, user: JwtUser, dto: VersionedActionDto) {
    return this.prisma.$transaction(async (tx) => {
      const tank = await this.findTank(tx, companyId, tankId);
      this.assertTank(tank, 'ENVASANDO', dto.version);
      await this.closePackaging(tx, tank.id, user.sub);
      if (tank.activeLotId) await tx.productionLot.update({ where: { id: tank.activeLotId }, data: { finishedAt: new Date() } });
      await this.move(tx, tank, 'VACIO', user, tank.activeLotId, 'Fin de envasado');
      await tx.tank.update({ where: { id: tank.id }, data: { activeLotId: null } });
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

  history(companyId: string, tankId?: string, state?: string, from?: string, to?: string) {
    return this.prisma.tankStateHistory.findMany({
      where: {
        companyId,
        tankId: tankId || undefined,
        state: state && Object.values(TankState).includes(state as TankState) ? state as TankState : undefined,
        startedAt: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined }
      },
      include: { tank: { select: { number: true, name: true } }, lot: true, user: { select: { fullName: true, username: true } } },
      orderBy: { startedAt: 'desc' }, take: 1000
    });
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
    return {
      lines: Array.isArray(settings.packagingLines) ? settings.packagingLines.filter((v): v is string => typeof v === 'string') : LINES,
      formats: Array.isArray(settings.packagingFormats) ? settings.packagingFormats.filter((v): v is string => typeof v === 'string') : FORMATS,
      adjustmentReasons: Array.isArray(settings.adjustmentReasons) ? settings.adjustmentReasons.filter((v): v is string => typeof v === 'string') : ADJUSTMENT_REASONS
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
    tank: { id: string; companyId: string; state: TankState; version: number },
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
    await tx.tankStateHistory.updateMany({ where: { tankId: tank.id, endedAt: null }, data: { endedAt: new Date() } });
    await tx.tankStateHistory.create({ data: { companyId: tank.companyId, tankId: tank.id, lotId, state, description, userId: user.sub } });
    await this.audit(tx, tank.companyId, user, tank.id, lotId, 'STATUS_CHANGE', 'Tank', tank.id, { state: tank.state }, { state }, description);
  }

  private async closePackaging(tx: Prisma.TransactionClient, tankId: string, userId: string) {
    const current = await tx.packagingOrder.findFirst({ where: { tankId, finishedAt: null }, orderBy: { startedAt: 'desc' } });
    if (!current) throw new ConflictException('No existe una OE abierta');
    const finishedAt = new Date();
    await tx.packagingOrder.update({ where: { id: current.id }, data: {
      finishedAt, finishedByUserId: userId,
      durationSeconds: Math.max(0, Math.floor((finishedAt.getTime() - current.startedAt.getTime()) / 1000))
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
}
