import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, QualityResult, TankState } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtUser } from '../../common/auth/jwt-user.interface';
import {
  AGITATION_ADJUSTMENT_REASON,
  CorrectLotDto,
  CorrectPackagingDto,
  CorrectQualityAdjustmentDto,
  CreatePackagingPlanningCardDto,
  CreatePlanningCardDto,
  DailyClosureDto,
  FinishPackagingDto,
  MovePlanningCardDto,
  MovePackagingPlanningCardDto,
  PACKAGING_PLANNING_FILTERS,
  PackagingSpeedBatchDto,
  PackagingDto,
  QualityDecisionDto,
  ReceiveLaboratorySampleDto,
  RollbackTankStateDto,
  ServiceDto,
  StartManufacturingDto,
  StageTargetsDto,
  UpdatePlanningCardDto,
  UpdatePackagingPlanningCardDto,
  VersionedActionDto,
  WeightBatchDto
} from './dto/plant.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { createHash, timingSafeEqual } from 'crypto';
import { InfluxHistoryService } from './influx-history.service';

type Telemetry = { grossKg: number; netKg?: number; measuredAt: string; receivedAt: string };
type PackagingSpeed = { containersPerMinute: number; measuredAt: string; receivedAt: string };

// Margen para emisores Node-RED con un pulso de lectura cada 10 segundos.
const WEIGHT_SIGNAL_TIMEOUT_MS = 60_000;

const LINES = ['A', 'B'];
const FORMATS = ['1 L', '4 L', '10 L', '20 L'];
const DISPENSERS = ['A', 'B'];
const FILTERS = ['1', '2', '3'];
const SYNTHETICS_LINES = ['Linea 1', 'Linea 20', 'Linea 3'];
const SYNTHETICS_FORMATS = ['0.25L', '0.5L', '1L', '4L', '10L'];
const ADJUSTMENT_REASONS = [
  AGITATION_ADJUSTMENT_REASON,
  'Nivel del tanque',
  'Viscosidad',
  'Cubritivo',
  'Preservación',
  'Brillo',
  'Lavabilidad',
  'Color',
  'Reemplazo de materia prima',
  'Error operativo o de proceso',
  'Desaereante',
  'Cambio de almacenamiento de producción'
];

const DEFAULT_TARGET_SECONDS: Partial<Record<TankState, number>> = {
  FABRICANDO: 8 * 60 * 60,
  LABORATORIO: 30 * 60,
  AJUSTE: 60 * 60,
  RECHAZADO: 60 * 60,
  APROBADO: 2 * 60 * 60,
  ENVASANDO: 6 * 60 * 60,
  TRASVASANDO: 2 * 60 * 60,
  FUERA_DE_SERVICIO: 8 * 60 * 60
};

const BUENOS_AIRES_OFFSET_MS = 3 * 60 * 60 * 1000;

@Injectable()
export class PlantService {
  private readonly weights = new Map<string, Telemetry>();
  private readonly packagingSpeeds = new Map<string, PackagingSpeed>();
  private packagingEstimateCache?: {
    plantId: string;
    date: string;
    at: number;
    value: { litersToday: number | null; status: string };
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    @Optional() private readonly influxHistory?: InfluxHistoryService
  ) {}

  async authorizedPlants(companyId: string, userId: string) {
    return this.prisma.plant.findMany({
      where: { companyId, isActive: true, userAccesses: { some: { userId } } },
      select: { id: true, code: true, name: true, displayOrder: true, finalOperation: true },
      orderBy: { displayOrder: 'asc' }
    });
  }

  async assertPlantAccess(companyId: string, userId: string, plantCode: string, tankId?: string) {
    const plant = await this.prisma.plant.findFirst({
      where: {
        companyId,
        code: plantCode.toUpperCase(),
        isActive: true,
        userAccesses: { some: { userId } }
      },
      include: { userAccesses: { where: { userId }, select: { canTransfer: true } } }
    });
    if (!plant) throw new NotFoundException('Planta no encontrada o no autorizada');
    if (tankId) {
      const tank = await this.prisma.tank.findFirst({
        where: { id: tankId, companyId, plantId: plant.id, isActive: true }
      });
      if (!tank) throw new NotFoundException('Equipo no encontrado en la planta solicitada');
    }
    return plant;
  }

  async scopedConfig(companyId: string, userId: string, plantCode: string) {
    const plant = await this.assertPlantAccess(companyId, userId, plantCode);
    return this.loadConfig(companyId, plant.id);
  }

  async scopedTanks(companyId: string, userId: string, plantCode: string) {
    const plant = await this.assertPlantAccess(companyId, userId, plantCode);
    return this.tanks(companyId, plant.id);
  }

  async planningBoard(companyId: string, userId: string, plantCode: string) {
    const plant = await this.assertPlanningPlantAccess(companyId, userId, plantCode);
    const tanks = await this.prisma.tank.findMany({
      where: {
        companyId,
        plantId: plant.id,
        isActive: true,
        equipmentType: 'TANK'
      },
      select: {
        id: true,
        number: true,
        name: true,
        capacityKg: true,
        state: true,
        activeLot: {
          select: {
            id: true,
            manufacturingOrder: true,
            materialCode: true,
            description: true
          }
        },
        planningCards: {
          select: {
            id: true,
            manufacturingOrder: true,
            materialCode: true,
            description: true,
            position: true,
            updatedAt: true
          },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
        }
      },
      orderBy: { number: 'asc' }
    });

    return {
      plant: { id: plant.id, code: plant.code, name: plant.name },
      tanks: tanks.map((tank) => ({
        ...tank,
        capacityKg: tank.capacityKg === null ? null : Number(tank.capacityKg)
      }))
    };
  }

  async createPlanningCard(
    companyId: string,
    user: JwtUser,
    plantCode: string,
    dto: CreatePlanningCardDto
  ) {
    const plant = await this.assertPlanningPlantAccess(companyId, user.sub, plantCode);
    if (!dto.description.trim()) throw new BadRequestException('La descripción es obligatoria');
    return this.prisma.$transaction(
      async (tx) => {
        const tank = await tx.tank.findFirst({
          where: {
            id: dto.tankId,
            companyId,
            plantId: plant.id,
            isActive: true,
            equipmentType: 'TANK'
          },
          select: { id: true }
        });
        if (!tank) throw new NotFoundException('Tanque no encontrado en la pizarra');
        const last = await tx.planningCard.findFirst({
          where: { plantId: plant.id, tankId: tank.id },
          select: { position: true },
          orderBy: { position: 'desc' }
        });
        const card = await tx.planningCard.create({
          data: {
            companyId,
            plantId: plant.id,
            tankId: tank.id,
            manufacturingOrder: dto.manufacturingOrder,
            materialCode: dto.materialCode,
            description: dto.description.trim(),
            position: (last?.position ?? -1) + 1,
            createdByUserId: user.sub
          }
        });
        await this.audit(
          tx,
          companyId,
          user,
          tank.id,
          null,
          'CREATE',
          'PlanningCard',
          card.id,
          null,
          card,
          'Tarjeta agregada a la pizarra'
        );
        return card;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async updatePlanningCard(
    companyId: string,
    user: JwtUser,
    plantCode: string,
    cardId: string,
    dto: UpdatePlanningCardDto
  ) {
    const plant = await this.assertPlanningPlantAccess(companyId, user.sub, plantCode);
    if (!dto.description.trim()) throw new BadRequestException('La descripción es obligatoria');
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.planningCard.findFirst({
        where: { id: cardId, companyId, plantId: plant.id }
      });
      if (!before) throw new NotFoundException('Tarjeta de planificación no encontrada');
      const after = await tx.planningCard.update({
        where: { id: cardId },
        data: {
          manufacturingOrder: dto.manufacturingOrder,
          materialCode: dto.materialCode,
          description: dto.description.trim()
        }
      });
      await this.audit(
        tx,
        companyId,
        user,
        before.tankId,
        null,
        'UPDATE',
        'PlanningCard',
        cardId,
        before,
        after,
        'Tarjeta editada en la pizarra'
      );
      return after;
    });
  }

  async movePlanningCard(
    companyId: string,
    user: JwtUser,
    plantCode: string,
    cardId: string,
    dto: MovePlanningCardDto
  ) {
    const plant = await this.assertPlanningPlantAccess(companyId, user.sub, plantCode);
    return this.prisma.$transaction(
      async (tx) => {
        const card = await tx.planningCard.findFirst({
          where: { id: cardId, companyId, plantId: plant.id }
        });
        if (!card) throw new NotFoundException('Tarjeta de planificación no encontrada');
        const targetTank = await tx.tank.findFirst({
          where: {
            id: dto.tankId,
            companyId,
            plantId: plant.id,
            isActive: true,
            equipmentType: 'TANK'
          },
          select: { id: true }
        });
        if (!targetTank) throw new NotFoundException('Tanque de destino no encontrado');

        const sourceCards = await tx.planningCard.findMany({
          where: { plantId: plant.id, tankId: card.tankId, id: { not: card.id } },
          select: { id: true },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
        });
        const targetCards =
          card.tankId === targetTank.id
            ? sourceCards
            : await tx.planningCard.findMany({
                where: { plantId: plant.id, tankId: targetTank.id },
                select: { id: true },
                orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
              });
        const targetPosition = Math.min(dto.position, targetCards.length);
        targetCards.splice(targetPosition, 0, { id: card.id });

        if (card.tankId !== targetTank.id) {
          await this.persistPlanningOrder(
            tx,
            card.tankId,
            sourceCards.map((item) => item.id)
          );
        }
        await this.persistPlanningOrder(
          tx,
          targetTank.id,
          targetCards.map((item) => item.id)
        );
        await this.audit(
          tx,
          companyId,
          user,
          targetTank.id,
          null,
          'UPDATE',
          'PlanningCard',
          card.id,
          { tankId: card.tankId, position: card.position },
          { tankId: targetTank.id, position: targetPosition },
          'Tarjeta reordenada en la pizarra'
        );
        return { ok: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async deletePlanningCard(companyId: string, user: JwtUser, plantCode: string, cardId: string) {
    const plant = await this.assertPlanningPlantAccess(companyId, user.sub, plantCode);
    return this.prisma.$transaction(
      async (tx) => {
        const card = await tx.planningCard.findFirst({
          where: { id: cardId, companyId, plantId: plant.id }
        });
        if (!card) throw new NotFoundException('Tarjeta de planificación no encontrada');
        await tx.planningCard.delete({ where: { id: card.id } });
        await tx.planningCard.updateMany({
          where: { plantId: plant.id, tankId: card.tankId, position: { gt: card.position } },
          data: { position: { decrement: 1 } }
        });
        await this.audit(
          tx,
          companyId,
          user,
          card.tankId,
          null,
          'DELETE',
          'PlanningCard',
          card.id,
          card,
          null,
          'Tarjeta eliminada de la pizarra'
        );
        return { ok: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async packagingPlanningBoard(companyId: string, userId: string, plantCode: string) {
    const plant = await this.assertPlanningPlantAccess(companyId, userId, plantCode);
    const tankSelect = {
      id: true,
      number: true,
      name: true,
      state: true,
      activeLot: {
        select: {
          id: true,
          manufacturingOrder: true,
          materialCode: true,
          description: true,
          packagingOrders: {
            where: { finishedAt: null, cancelledAt: null },
            select: {
              packagingOrder: true,
              materialCode: true,
              dispenser: true,
              filter: true,
              description: true,
              startedAt: true
            },
            orderBy: { startedAt: 'desc' as const },
            take: 1
          }
        }
      }
    };
    const [tanks, cards] = await Promise.all([
      this.prisma.tank.findMany({
        where: {
          companyId,
          plantId: plant.id,
          isActive: true,
          equipmentType: 'TANK'
        },
        select: tankSelect,
        orderBy: { number: 'asc' }
      }),
      this.prisma.packagingPlanningCard.findMany({
        where: { companyId, plantId: plant.id },
        select: {
          id: true,
          dispenser: true,
          position: true,
          filter: true,
          notes: true,
          updatedAt: true,
          tank: { select: tankSelect }
        },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
      })
    ]);
    return {
      plant: { id: plant.id, code: plant.code, name: plant.name },
      dispensers: DISPENSERS,
      filters: PACKAGING_PLANNING_FILTERS,
      tanks,
      cards
    };
  }

  async createPackagingPlanningCard(
    companyId: string,
    user: JwtUser,
    plantCode: string,
    dto: CreatePackagingPlanningCardDto
  ) {
    const plant = await this.assertPlanningPlantAccess(companyId, user.sub, plantCode);
    return this.prisma.$transaction(
      async (tx) => {
        const tank = await tx.tank.findFirst({
          where: {
            id: dto.tankId,
            companyId,
            plantId: plant.id,
            isActive: true,
            equipmentType: 'TANK'
          },
          select: { id: true, state: true }
        });
        if (!tank) throw new NotFoundException('Tanque no encontrado en la pizarra');
        this.assertPackagingPlanningTankState(tank.state);
        const existing = await tx.packagingPlanningCard.findFirst({
          where: { plantId: plant.id, tankId: tank.id },
          select: { id: true }
        });
        if (existing) throw new ConflictException('El tanque ya está planificado para envasado');
        const count = await tx.packagingPlanningCard.count({
          where: { plantId: plant.id }
        });
        if (count >= 4) {
          throw new ConflictException('Devree ya tiene las cuatro posiciones planificadas');
        }
        const card = await tx.packagingPlanningCard.create({
          data: {
            companyId,
            plantId: plant.id,
            tankId: tank.id,
            dispenser: dto.dispenser,
            position: count,
            hooked: dto.hooked ?? false,
            filter: dto.filter,
            notes: dto.notes?.trim() ?? '',
            createdByUserId: user.sub
          }
        });
        await this.audit(
          tx,
          companyId,
          user,
          tank.id,
          null,
          'CREATE',
          'PackagingPlanningCard',
          card.id,
          null,
          card,
          'Tanque agregado a la planificación de envasado'
        );
        return card;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async updatePackagingPlanningCard(
    companyId: string,
    user: JwtUser,
    plantCode: string,
    cardId: string,
    dto: UpdatePackagingPlanningCardDto
  ) {
    const plant = await this.assertPlanningPlantAccess(companyId, user.sub, plantCode);
    return this.prisma.$transaction(
      async (tx) => {
        const before = await tx.packagingPlanningCard.findFirst({
          where: { id: cardId, companyId, plantId: plant.id }
        });
        if (!before) throw new NotFoundException('Tarjeta de envasado no encontrada');
        const tank = await tx.tank.findFirst({
          where: {
            id: dto.tankId,
            companyId,
            plantId: plant.id,
            isActive: true,
            equipmentType: 'TANK'
          },
          select: { id: true, state: true }
        });
        if (!tank) throw new NotFoundException('Tanque no encontrado en la pizarra');
        this.assertPackagingPlanningTankState(tank.state);
        const duplicate = await tx.packagingPlanningCard.findFirst({
          where: { plantId: plant.id, tankId: tank.id, id: { not: cardId } },
          select: { id: true }
        });
        if (duplicate) throw new ConflictException('El tanque ya está planificado para envasado');
        const after = await tx.packagingPlanningCard.update({
          where: { id: cardId },
          data: {
            tankId: tank.id,
            hooked: dto.hooked ?? before.hooked,
            filter: dto.filter,
            notes: dto.notes?.trim() ?? ''
          }
        });
        await this.audit(
          tx,
          companyId,
          user,
          tank.id,
          null,
          'UPDATE',
          'PackagingPlanningCard',
          cardId,
          before,
          after,
          'Tarjeta editada en la planificación de envasado'
        );
        return after;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async movePackagingPlanningCard(
    companyId: string,
    user: JwtUser,
    plantCode: string,
    cardId: string,
    dto: MovePackagingPlanningCardDto
  ) {
    const plant = await this.assertPlanningPlantAccess(companyId, user.sub, plantCode);
    return this.prisma.$transaction(
      async (tx) => {
        const card = await tx.packagingPlanningCard.findFirst({
          where: { id: cardId, companyId, plantId: plant.id }
        });
        if (!card) throw new NotFoundException('Tarjeta de envasado no encontrada');
        const cards = await tx.packagingPlanningCard.findMany({
          where: { plantId: plant.id, id: { not: card.id } },
          select: { id: true, dispenser: true },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
        });
        const targetPosition = Math.min(dto.position, cards.length);
        cards.splice(targetPosition, 0, { id: card.id, dispenser: dto.dispenser });
        await this.persistPackagingPlanningOrder(tx, cards);
        await this.audit(
          tx,
          companyId,
          user,
          card.tankId,
          null,
          'UPDATE',
          'PackagingPlanningCard',
          card.id,
          { dispenser: card.dispenser, position: card.position },
          { dispenser: dto.dispenser, position: targetPosition },
          'Tarjeta reordenada en la planificación de envasado'
        );
        return { ok: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async deletePackagingPlanningCard(
    companyId: string,
    user: JwtUser,
    plantCode: string,
    cardId: string
  ) {
    const plant = await this.assertPlanningPlantAccess(companyId, user.sub, plantCode);
    return this.prisma.$transaction(
      async (tx) => {
        const card = await tx.packagingPlanningCard.findFirst({
          where: { id: cardId, companyId, plantId: plant.id }
        });
        if (!card) throw new NotFoundException('Tarjeta de envasado no encontrada');
        await tx.packagingPlanningCard.delete({ where: { id: card.id } });
        await tx.packagingPlanningCard.updateMany({
          where: {
            plantId: plant.id,
            position: { gt: card.position }
          },
          data: { position: { decrement: 1 } }
        });
        await this.audit(
          tx,
          companyId,
          user,
          card.tankId,
          null,
          'DELETE',
          'PackagingPlanningCard',
          card.id,
          card,
          null,
          'Tarjeta eliminada de la planificación de envasado'
        );
        return { ok: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async getConfig(companyId: string) {
    return this.loadConfig(companyId);
  }

  async publicTanks(plantCode = 'LATEX') {
    const companyId = this.config.get<string>('SYSTEM_OWNER_COMPANY_ID') || 'seed_company_disal';
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, isActive: true },
      select: {
        id: true,
        plants: {
          where: { code: plantCode.toUpperCase(), isActive: true },
          select: { id: true },
          take: 1
        }
      }
    });
    if (!company) throw new NotFoundException('La pantalla de planta no está configurada');

    const plantId = company.plants[0]?.id;
    if (!plantId) throw new NotFoundException('La planta solicitada no está configurada');
    return this.publicTanksForPlant(company.id, plantId);
  }

  async publicPackagingEstimates(plantCode: string) {
    if (plantCode.toUpperCase() !== 'LATEX')
      throw new NotFoundException('Indicadores disponibles sólo para Látex');
    const companyId = this.config.get<string>('SYSTEM_OWNER_COMPANY_ID') || 'seed_company_disal';
    const plant = await this.prisma.plant.findFirst({
      where: { companyId, code: 'LATEX', isActive: true },
      select: { id: true }
    });
    if (!plant) throw new NotFoundException('La planta solicitada no está configurada');
    const now = new Date();
    const today = new Date(now.getTime() - BUENOS_AIRES_OFFSET_MS).toISOString().slice(0, 10);
    const cached = this.packagingEstimateCache;
    if (cached?.plantId === plant.id && cached.date === today && Date.now() - cached.at < 60_000)
      return cached.value;
    if (!this.influxHistory) return { litersToday: null, status: 'UNAVAILABLE' };
    const { start } = this.plantDayBounds(today);
    const periods = await this.prisma.tankStateHistory.findMany({
      where: {
        companyId,
        plantId: plant.id,
        state: 'ENVASANDO',
        startedAt: { lt: now },
        OR: [{ endedAt: null }, { endedAt: { gt: start } }]
      },
      select: {
        tankId: true,
        startedAt: true,
        endedAt: true,
        lot: { select: { specificWeight: true } },
        tank: { select: { scaleKey: true, number: true } }
      }
    });
    if (!periods.length) {
      const value = { litersToday: 0, status: 'AVAILABLE' };
      this.packagingEstimateCache = { plantId: plant.id, date: today, at: Date.now(), value };
      return value;
    }
    let liters = 0;
    let incomplete = false;
    const tankHistories = await Promise.all(
      [...new Set(periods.map((period) => period.tankId))].map(async (tankId) => {
        const tankPeriods = periods.filter((period) => period.tankId === tankId);
        const tank = tankPeriods[0].tank;
        const history = await this.influxHistory!.readWeightSeries(tank.scaleKey, start, now, {
          plantCode: 'LATEX',
          tankNumber: tank.number
        });
        return { tankPeriods, history };
      })
    );
    for (const { tankPeriods, history } of tankHistories) {
      if (history.status !== 'AVAILABLE') {
        incomplete = true;
        continue;
      }
      for (const period of tankPeriods) {
        const from = Math.max(start.getTime(), period.startedAt.getTime());
        const until = Math.min(now.getTime(), period.endedAt?.getTime() ?? now.getTime());
        const within = history.points.filter((point) => {
          const at = Date.parse(point.timestamp);
          return at >= from && at <= until;
        });
        if (
          !within.length ||
          Date.parse(within[0].timestamp) - from > 10 * 60_000 ||
          until - Date.parse(within[within.length - 1].timestamp) > 10 * 60_000
        )
          incomplete = true;
      }
      for (let index = 1; index < history.points.length; index++) {
        const previous = history.points[index - 1];
        const current = history.points[index];
        const previousAt = Date.parse(previous.timestamp);
        const currentAt = Date.parse(current.timestamp);
        const minutes = (currentAt - previousAt) / 60_000;
        if (minutes <= 0) continue;
        const period = tankPeriods.find(
          (item) =>
            previousAt >= Math.max(start.getTime(), item.startedAt.getTime()) &&
            currentAt <= (item.endedAt?.getTime() ?? now.getTime())
        );
        if (!period) continue;
        if (minutes > 10) {
          incomplete = true;
          continue;
        }
        const density = Number(period.lot?.specificWeight);
        const dropKg = previous.grossKg - current.grossKg;
        if (!Number.isFinite(density) || density <= 0 || dropKg <= 2) {
          if (!Number.isFinite(density) || density <= 0) incomplete = true;
          continue;
        }
        if (dropKg / minutes > 1200) {
          incomplete = true;
          continue;
        }
        liters += dropKg / density;
      }
    }
    const value = {
      litersToday: incomplete ? null : Math.round(liters),
      status: incomplete ? 'INCOMPLETE' : 'AVAILABLE'
    };
    this.packagingEstimateCache = { plantId: plant.id, date: today, at: Date.now(), value };
    return value;
  }

  async publicAllTanks() {
    const companyId = this.config.get<string>('SYSTEM_OWNER_COMPANY_ID') || 'seed_company_disal';
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, isActive: true },
      select: {
        id: true,
        plants: {
          where: { isActive: true },
          select: { id: true, code: true, name: true },
          orderBy: { displayOrder: 'asc' }
        }
      }
    });
    if (!company) throw new NotFoundException('La pantalla de planta no está configurada');

    const rows = await Promise.all(
      company.plants.map(async (plant) => {
        const tanks = await this.publicTanksForPlant(company.id, plant.id);
        return tanks.map((tank) => ({
          plantCode: plant.code,
          plantName: plant.name,
          ...tank
        }));
      })
    );
    return rows.flat();
  }

  private async publicTanksForPlant(companyId: string, plantId: string) {
    const tanks = await this.tanks(companyId, plantId);
    return tanks.map((tank) => ({
      id: tank.id,
      number: tank.number,
      name: tank.name,
      equipmentType: tank.equipmentType,
      telemetryMode: tank.telemetryMode,
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
      packagingSpeed: tank.packagingSpeed,
      activeLot: tank.activeLot
        ? {
            id: tank.activeLot.id,
            manufacturingOrder: tank.activeLot.manufacturingOrder,
            materialCode: tank.activeLot.materialCode,
            description: tank.activeLot.description,
            specificWeight: tank.activeLot.specificWeight,
            packagingOrders: tank.activeLot.packagingOrders.map((order) => ({
              packagingOrder: order.packagingOrder,
              materialCode: order.materialCode,
              line: order.line,
              format: order.format,
              dispenser: order.dispenser,
              filter: order.filter,
              description: order.description,
              startedAt: order.startedAt
            })),
            laboratorySamples: (tank.activeLot.laboratorySamples ?? []).map((sample) => ({
              id: sample.id,
              iteration: sample.iteration,
              status: sample.status,
              requestedAt: sample.requestedAt,
              receivedAt: sample.receivedAt,
              analysisStartedAt: sample.analysisStartedAt,
              resolvedAt: sample.resolvedAt
            })),
            qualityDecisions: tank.activeLot.qualityDecisions.map((decision) => ({
              reason: decision.reason,
              adjustmentReasons: decision.adjustmentReasons
            }))
          }
        : null
    }));
  }

  async tanks(companyId: string, plantId?: string) {
    if (!plantId)
      plantId = (
        await this.prisma.plant.findFirst({
          where: { companyId, code: 'LATEX' },
          select: { id: true }
        })
      )?.id;
    if (!plantId) throw new NotFoundException('Planta Látex no configurada');
    const configuredTargets = await this.targetSeconds(companyId, undefined, plantId);
    const tanks = await this.prisma.tank.findMany({
      where: { companyId, plantId, isActive: true },
      include: {
        stateHistory: { where: { endedAt: null }, orderBy: { startedAt: 'desc' }, take: 1 },
        activeLot: {
          include: {
            packagingOrders: {
              where: { finishedAt: null, cancelledAt: null },
              orderBy: { startedAt: 'desc' },
              take: 1
            },
            laboratorySamples: {
              where: { cancelledAt: null },
              orderBy: { iteration: 'desc' },
              take: 1
            },
            qualityDecisions: {
              where: { cancelledAt: null },
              include: { adjustmentItems: { orderBy: { position: 'asc' } } },
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        }
      },
      orderBy: { number: 'asc' }
    });

    return tanks.map((tank) => {
      const reading = tank.scaleKey ? this.weights.get(`${plantId}:${tank.scaleKey}`) : undefined;
      const activeOrder = tank.activeLot?.packagingOrders[0];
      const currentPeriod = tank.stateHistory[0];
      const speed =
        tank.state === 'ENVASANDO' && activeOrder
          ? (this.packagingSpeeds.get(`${plantId}:DEVREE`) ??
            this.packagingSpeeds.get(`${plantId}:${activeOrder.line}`))
          : undefined;
      const speedOnline =
        !!speed &&
        Date.now() - Date.parse(speed.receivedAt) <= WEIGHT_SIGNAL_TIMEOUT_MS &&
        !!activeOrder &&
        Date.parse(speed.measuredAt) >=
          Math.max(activeOrder.startedAt.getTime(), currentPeriod?.startedAt.getTime() ?? 0);
      const age = reading
        ? Date.now() - new Date(reading.receivedAt).getTime()
        : Number.POSITIVE_INFINITY;
      const stateElapsedSeconds = currentPeriod
        ? Math.max(0, Math.floor((Date.now() - currentPeriod.startedAt.getTime()) / 1000))
        : null;
      const targetSeconds = currentPeriod?.targetSeconds ?? configuredTargets[tank.state] ?? null;
      return {
        ...tank,
        capacityKg: tank.capacityKg === null ? null : Number(tank.capacityKg),
        activeLot: tank.activeLot
          ? {
              ...tank.activeLot,
              specificWeight:
                tank.activeLot.specificWeight === null
                  ? null
                  : Number(tank.activeLot.specificWeight),
              qualityDecisions: tank.activeLot.qualityDecisions.map((decision) => ({
                ...decision,
                specificWeight:
                  decision.specificWeight === null ? null : Number(decision.specificWeight),
                adjustmentItems: decision.adjustmentItems.map((item) => ({
                  ...item,
                  quantityKg: Number(item.quantityKg)
                }))
              }))
            }
          : null,
        stateStartedAt: currentPeriod?.startedAt ?? tank.updatedAt,
        stateElapsedSeconds,
        stateTargetSeconds: targetSeconds,
        stateAttention:
          targetSeconds && stateElapsedSeconds !== null
            ? stateElapsedSeconds >= targetSeconds
              ? 'CRITICAL'
              : stateElapsedSeconds >= targetSeconds * 0.8
                ? 'WARNING'
                : 'OK'
            : 'OK',
        packagingSpeed: {
          containersPerMinute: speedOnline && speed ? speed.containersPerMinute : null,
          measuredAt: speedOnline && speed ? speed.measuredAt : null,
          online: speedOnline
        },
        telemetry:
          tank.telemetryMode === 'NOT_INSTALLED'
            ? {
                grossKg: null,
                netKg: null,
                measuredAt: null,
                receivedAt: null,
                online: null,
                ageMs: null,
                status: 'NOT_INSTALLED'
              }
            : reading
              ? {
                  ...reading,
                  online: age <= WEIGHT_SIGNAL_TIMEOUT_MS,
                  ageMs: age,
                  status: age <= WEIGHT_SIGNAL_TIMEOUT_MS ? 'ONLINE' : 'NO_COMMUNICATION'
                }
              : {
                  grossKg: null,
                  netKg: null,
                  measuredAt: null,
                  receivedAt: null,
                  online: false,
                  ageMs: null,
                  status: tank.telemetryMode === 'PENDING' ? 'PENDING_MAPPING' : 'NO_COMMUNICATION'
                }
      };
    });
  }

  async ingestWeights(
    apiKey: string | undefined,
    companyId: string | undefined,
    dto: WeightBatchDto,
    plantCode = 'LATEX'
  ) {
    const expected = this.config.get<string>('NODE_RED_API_KEY');
    const targetCompany =
      companyId?.trim() ||
      this.config.get<string>('SYSTEM_OWNER_COMPANY_ID') ||
      'seed_company_disal';
    if (!expected || apiKey !== expected || plantCode.toUpperCase() !== 'LATEX')
      throw new UnauthorizedException('Clave de integración inválida');
    const plant = await this.prisma.plant.findFirstOrThrow({
      where: { companyId: targetCompany, code: 'LATEX' }
    });
    const now = new Date().toISOString();
    for (const reading of dto.readings) {
      const measuredAt =
        reading.measuredAt && !Number.isNaN(Date.parse(reading.measuredAt))
          ? new Date(reading.measuredAt).toISOString()
          : now;
      const equipment = await this.prisma.tank.findFirst({
        where: {
          plantId: plant.id,
          scaleKey: reading.scaleKey,
          telemetryMode: 'AUTOMATIC',
          isActive: true
        }
      });
      if (!equipment)
        throw new BadRequestException(`Balanza desconocida o no habilitada: ${reading.scaleKey}`);
      if (reading.measuredAt && Number.isNaN(Date.parse(reading.measuredAt)))
        throw new BadRequestException(`Timestamp inválido para ${reading.scaleKey}`);
      const cacheKey = `${plant.id}:${reading.scaleKey}`;
      const previous = this.weights.get(cacheKey);
      if (previous && Date.parse(measuredAt) <= Date.parse(previous.measuredAt)) continue;
      this.weights.set(cacheKey, {
        grossKg: reading.grossKg,
        netKg: reading.netKg,
        measuredAt,
        receivedAt: now
      });
    }
    const speeds = dto.speeds
      ? this.acceptPackagingSpeeds(plant.id, { readings: dto.speeds })
      : undefined;
    return {
      accepted: dto.readings.length,
      receivedAt: now,
      persisted: false,
      ...(speeds ? { speeds } : {})
    };
  }

  async ingestPlantWeights(plantCode: string, apiKey: string | undefined, dto: WeightBatchDto) {
    if (!apiKey) throw new UnauthorizedException('Clave de integración inválida');
    const plant = await this.prisma.plant.findFirst({
      where: { code: plantCode.toUpperCase(), isActive: true },
      include: { integrations: { where: { isActive: true } } }
    });
    if (!plant) throw new NotFoundException('Planta no encontrada');
    const supplied = createHash('sha256').update(apiKey).digest();
    const integration = plant.integrations.find(
      (candidate) =>
        (!dto.source || candidate.source === dto.source) &&
        (() => {
          const stored = Buffer.from(candidate.keyHash, 'hex');
          return stored.length === supplied.length && timingSafeEqual(stored, supplied);
        })()
    );
    if (!integration) throw new UnauthorizedException('Clave de integración inválida');
    if (dto.speeds && plant.code !== 'LATEX')
      throw new BadRequestException('La velocidad de envasado sólo está habilitada para LATEX');
    const now = new Date().toISOString();
    const results: Array<{ scaleKey: string; status: string; message?: string }> = [];
    for (const reading of dto.readings) {
      if (reading.measuredAt && Number.isNaN(Date.parse(reading.measuredAt))) {
        results.push({
          scaleKey: reading.scaleKey,
          status: 'REJECTED',
          message: 'timestamp inválido'
        });
        continue;
      }
      const equipment = await this.prisma.tank.findFirst({
        where: {
          plantId: plant.id,
          scaleKey: reading.scaleKey,
          telemetryMode: 'AUTOMATIC',
          isActive: true
        }
      });
      if (!equipment) {
        results.push({
          scaleKey: reading.scaleKey,
          status: 'REJECTED',
          message: 'equipo desconocido o sin telemetría automática'
        });
        continue;
      }
      const measuredAt = reading.measuredAt ? new Date(reading.measuredAt).toISOString() : now;
      const cacheKey = `${plant.id}:${reading.scaleKey}`;
      const previous = this.weights.get(cacheKey);
      if (previous && Date.parse(measuredAt) <= Date.parse(previous.measuredAt)) {
        results.push({ scaleKey: reading.scaleKey, status: 'IGNORED_OLDER' });
        continue;
      }
      this.weights.set(cacheKey, {
        grossKg: reading.grossKg,
        netKg: reading.netKg,
        measuredAt,
        receivedAt: now
      });
      results.push({ scaleKey: reading.scaleKey, status: 'ACCEPTED' });
    }
    const speeds = dto.speeds
      ? this.acceptPackagingSpeeds(plant.id, { readings: dto.speeds })
      : undefined;
    return {
      accepted: results.filter((r) => r.status === 'ACCEPTED').length,
      rejected: results.filter((r) => r.status === 'REJECTED').length,
      ignored: results.filter((r) => r.status === 'IGNORED_OLDER').length,
      receivedAt: now,
      persisted: false,
      results,
      ...(speeds ? { speeds } : {})
    };
  }

  async ingestPackagingSpeeds(
    apiKey: string | undefined,
    companyId: string | undefined,
    dto: PackagingSpeedBatchDto
  ) {
    const expected = this.config.get<string>('NODE_RED_API_KEY');
    if (!expected || apiKey !== expected)
      throw new UnauthorizedException('Clave de integración inválida');
    const targetCompany =
      companyId?.trim() ||
      this.config.get<string>('SYSTEM_OWNER_COMPANY_ID') ||
      'seed_company_disal';
    const plant = await this.prisma.plant.findFirstOrThrow({
      where: { companyId: targetCompany, code: 'LATEX', isActive: true }
    });
    return this.acceptPackagingSpeeds(plant.id, dto);
  }

  async ingestPlantPackagingSpeeds(
    plantCode: string,
    apiKey: string | undefined,
    dto: PackagingSpeedBatchDto
  ) {
    if (!apiKey) throw new UnauthorizedException('Clave de integración inválida');
    if (plantCode.toUpperCase() !== 'LATEX')
      throw new BadRequestException('La velocidad de envasado sólo está habilitada para LATEX');
    const plant = await this.prisma.plant.findFirst({
      where: { code: 'LATEX', isActive: true },
      include: { integrations: { where: { isActive: true } } }
    });
    if (!plant) throw new NotFoundException('Planta no encontrada');
    const supplied = createHash('sha256').update(apiKey).digest();
    const integration = plant.integrations.find(
      (candidate) =>
        (!dto.source || candidate.source === dto.source) &&
        (() => {
          const stored = Buffer.from(candidate.keyHash, 'hex');
          return stored.length === supplied.length && timingSafeEqual(stored, supplied);
        })()
    );
    if (!integration) throw new UnauthorizedException('Clave de integración inválida');
    return this.acceptPackagingSpeeds(plant.id, dto);
  }

  private acceptPackagingSpeeds(plantId: string, dto: PackagingSpeedBatchDto) {
    const now = new Date().toISOString();
    const results: Array<{ line: string; status: string }> = [];
    for (const reading of dto.readings) {
      const measuredAt = reading.measuredAt ?? now;
      const cacheKey = `${plantId}:${reading.line}`;
      const previous = this.packagingSpeeds.get(cacheKey);
      if (previous && Date.parse(measuredAt) <= Date.parse(previous.measuredAt)) {
        results.push({ line: reading.line, status: 'IGNORED_OLDER' });
        continue;
      }
      this.packagingSpeeds.set(cacheKey, {
        containersPerMinute: reading.containersPerMinute,
        measuredAt,
        receivedAt: now
      });
      results.push({ line: reading.line, status: 'ACCEPTED' });
    }
    return {
      accepted: results.filter((result) => result.status === 'ACCEPTED').length,
      ignored: results.filter((result) => result.status === 'IGNORED_OLDER').length,
      receivedAt: now,
      persisted: false,
      results
    };
  }

  async start(companyId: string, tankId: string, user: JwtUser, dto: StartManufacturingDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const tank = await this.findTank(tx, companyId, tankId);
        this.assertTank(tank, 'VACIO', dto.version);
        const lot = await tx.productionLot.create({
          data: {
            companyId,
            plantId: tank.plantId,
            tankId,
            manufacturingOrder: dto.manufacturingOrder,
            materialCode: dto.materialCode,
            description: dto.description.trim(),
            createdByUserId: user.sub,
            plannedQuantityKg: dto.plannedQuantityKg,
            priority: dto.priority ?? 'NORMAL',
            shift: dto.shift,
            scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined
          }
        });
        const plannedCard = await tx.planningCard.findFirst({
          where: {
            companyId,
            plantId: tank.plantId,
            tankId,
            manufacturingOrder: dto.manufacturingOrder,
            materialCode: dto.materialCode
          },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
        });
        if (plannedCard) {
          await tx.planningCard.delete({ where: { id: plannedCard.id } });
          await tx.planningCard.updateMany({
            where: {
              plantId: tank.plantId,
              tankId,
              position: { gt: plannedCard.position }
            },
            data: { position: { decrement: 1 } }
          });
        }
        await this.move(tx, tank, 'FABRICANDO', user, lot.id, `OF ${dto.manufacturingOrder}`);
        await tx.tank.update({ where: { id: tank.id }, data: { activeLotId: lot.id } });
        await this.audit(
          tx,
          companyId,
          user,
          tank.id,
          lot.id,
          'CREATE',
          'ProductionLot',
          lot.id,
          null,
          dto,
          null
        );
        return { ok: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async sendToLab(companyId: string, tankId: string, user: JwtUser, dto: VersionedActionDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const tank = await this.findTank(tx, companyId, tankId);
        if (!['FABRICANDO', 'AJUSTE'].includes(tank.state))
          throw new ConflictException(
            `La transición ${tank.state} → LABORATORIO no está permitida`
          );
        if (tank.version !== dto.version)
          throw new ConflictException('El tanque cambió. Actualizá la pantalla.');
        if (!tank.activeLotId) throw new ConflictException('El tanque no tiene un lote activo');
        const latestSample = await tx.laboratorySample.findFirst({
          where: { lotId: tank.activeLotId },
          orderBy: { iteration: 'desc' },
          select: { iteration: true }
        });
        await tx.laboratorySample.create({
          data: {
            companyId,
            plantId: tank.plantId,
            tankId: tank.id,
            lotId: tank.activeLotId,
            iteration: (latestSample?.iteration ?? 0) + 1,
            requestedByUserId: user.sub
          }
        });
        await this.move(tx, tank, 'LABORATORIO', user, tank.activeLotId, dto.reason);
        await this.notifications.notifyTankAction(tx, {
          companyId,
          actorUserId: user.sub,
          tankId: tank.id,
          targetSector: 'LABORATORIO',
          title: 'Muestra pendiente de recepción',
          message: `${tank.name} ingresó a Laboratorio. Confirmá la recepción cuando llegue la muestra.`
        });
        return { ok: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async receiveLaboratorySample(
    companyId: string,
    tankId: string,
    user: JwtUser,
    dto: ReceiveLaboratorySampleDto
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const tank = await this.findTank(tx, companyId, tankId);
        this.assertTank(tank, 'LABORATORIO', dto.version);
        if (!tank.activeLotId) throw new ConflictException('El tanque no tiene un lote activo');
        const sample = await tx.laboratorySample.findFirst({
          where: {
            companyId,
            plantId: tank.plantId,
            tankId,
            lotId: tank.activeLotId,
            status: 'AWAITING_RECEIPT',
            cancelledAt: null
          },
          orderBy: { iteration: 'desc' }
        });
        if (!sample) throw new ConflictException('No existe una muestra pendiente de recepción');

        const changed = await tx.tank.updateMany({
          where: { id: tank.id, state: 'LABORATORIO', version: dto.version },
          data: { version: { increment: 1 } }
        });
        if (changed.count !== 1)
          throw new ConflictException('El tanque cambió. Actualizá la pantalla.');
        const receivedAt = new Date();
        const nextStatus = dto.startAnalysis ? 'ANALYZING' : 'RECEIVED';
        await tx.laboratorySample.update({
          where: { id: sample.id },
          data: {
            status: nextStatus,
            receivedAt,
            receivedByUserId: user.sub,
            analysisStartedAt: dto.startAnalysis ? receivedAt : null,
            analysisStartedByUserId: dto.startAnalysis ? user.sub : null
          }
        });
        await this.audit(
          tx,
          companyId,
          user,
          tank.id,
          tank.activeLotId,
          'SAMPLE_RECEIVED',
          'LaboratorySample',
          sample.id,
          { status: sample.status },
          {
            status: nextStatus,
            receivedAt,
            analysisStartedAt: dto.startAnalysis ? receivedAt : null
          },
          dto.startAnalysis
            ? 'Recepción de muestra e inicio de análisis confirmados'
            : 'Recepción de muestra confirmada; tanque en espera'
        );
        return {
          ok: true,
          sampleId: sample.id,
          status: nextStatus,
          receivedAt: receivedAt.toISOString()
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async startLaboratoryAnalysis(
    companyId: string,
    tankId: string,
    user: JwtUser,
    dto: VersionedActionDto
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const tank = await this.findTank(tx, companyId, tankId);
        this.assertTank(tank, 'LABORATORIO', dto.version);
        if (!tank.activeLotId) throw new ConflictException('El tanque no tiene un lote activo');
        const sample = await tx.laboratorySample.findFirst({
          where: {
            companyId,
            plantId: tank.plantId,
            tankId,
            lotId: tank.activeLotId,
            status: 'RECEIVED',
            cancelledAt: null
          },
          orderBy: { iteration: 'desc' }
        });
        if (!sample) throw new ConflictException('No existe una muestra recibida en espera');
        const changed = await tx.tank.updateMany({
          where: { id: tank.id, state: 'LABORATORIO', version: dto.version },
          data: { version: { increment: 1 } }
        });
        if (changed.count !== 1)
          throw new ConflictException('El tanque cambió. Actualizá la pantalla.');
        const analysisStartedAt = new Date();
        await tx.laboratorySample.update({
          where: { id: sample.id },
          data: { status: 'ANALYZING', analysisStartedAt, analysisStartedByUserId: user.sub }
        });
        await this.audit(
          tx,
          companyId,
          user,
          tank.id,
          tank.activeLotId,
          'LABORATORY_ANALYSIS_STARTED',
          'LaboratorySample',
          sample.id,
          { status: sample.status },
          { status: 'ANALYZING', analysisStartedAt },
          dto.reason ?? 'Inicio de análisis confirmado'
        );
        return {
          ok: true,
          sampleId: sample.id,
          analysisStartedAt: analysisStartedAt.toISOString()
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async quality(companyId: string, tankId: string, user: JwtUser, dto: QualityDecisionDto) {
    if (dto.result === 'APROBADO' && (!dto.specificWeight || dto.specificWeight <= 0)) {
      throw new BadRequestException('El peso específico es obligatorio para aprobar');
    }
    if (dto.result === 'AJUSTE' && !dto.adjustmentReasons?.length)
      throw new BadRequestException('Seleccioná al menos un motivo de ajuste');
    if (dto.result.startsWith('RECHAZADO') && !dto.reason)
      throw new BadRequestException('Indicá el motivo del rechazo');
    if (dto.result === 'RECHAZADO_RECUPERAR' && !dto.recoveryAction)
      throw new BadRequestException('Indicá el destino de recuperación');

    const adjustmentReasons =
      dto.result === 'AJUSTE'
        ? [...new Set(dto.adjustmentReasons!.map((reason) => reason.trim()).filter(Boolean))]
        : [];
    if (dto.result === 'AJUSTE' && !adjustmentReasons.length)
      throw new BadRequestException('Seleccioná al menos un motivo de ajuste');
    if (
      dto.result === 'AJUSTE' &&
      !(adjustmentReasons.length === 1 && adjustmentReasons[0] === AGITATION_ADJUSTMENT_REASON) &&
      !dto.adjustments?.length
    )
      throw new BadRequestException('Agregá al menos un material para el ajuste');
    const decisionReason = dto.result === 'AJUSTE' ? adjustmentReasons.join(', ') : dto.reason;

    return this.prisma.$transaction(
      async (tx) => {
        const tank = await this.findTank(tx, companyId, tankId);
        this.assertTank(tank, 'LABORATORIO', dto.version);
        if (!tank.activeLotId) throw new ConflictException('El tanque no tiene un lote activo');
        const sample = await tx.laboratorySample.findFirst({
          where: {
            companyId,
            plantId: tank.plantId,
            tankId,
            lotId: tank.activeLotId,
            status: 'ANALYZING',
            cancelledAt: null
          },
          orderBy: { iteration: 'desc' }
        });
        if (!sample) {
          throw new ConflictException(
            'Laboratorio debe iniciar el análisis antes de informar el resultado'
          );
        }
        const state: TankState =
          dto.result === 'APROBADO' ? 'APROBADO' : dto.result === 'AJUSTE' ? 'AJUSTE' : 'RECHAZADO';
        const decision = await tx.qualityDecision.create({
          data: {
            companyId,
            plantId: tank.plantId,
            lotId: tank.activeLotId,
            result: dto.result as QualityResult,
            employeeNumber: dto.employeeNumber,
            specificWeight: dto.specificWeight,
            reason: decisionReason,
            adjustmentReasons,
            recoveryAction: dto.recoveryAction,
            userId: user.sub,
            adjustmentItems:
              dto.result === 'AJUSTE'
                ? {
                    create: (dto.adjustments ?? []).map((item, position) => ({
                      position,
                      materialCode: item.materialCode,
                      quantityKg: item.quantityKg
                    }))
                  }
                : undefined
          }
        });
        await tx.productionLot.update({
          where: { id: tank.activeLotId },
          data: { specificWeight: state === 'APROBADO' ? dto.specificWeight : null }
        });
        await tx.laboratorySample.update({
          where: { id: sample.id },
          data: { status: 'RESOLVED', resolvedAt: new Date(), qualityDecisionId: decision.id }
        });
        await this.move(tx, tank, state, user, tank.activeLotId, decisionReason ?? dto.result);
        if (state === 'APROBADO') {
          await this.notifications.notifyTankAction(tx, {
            companyId,
            actorUserId: user.sub,
            tankId: tank.id,
            targetSector: 'ENVASADO',
            title: 'Tanque aprobado para envasar',
            message: `${tank.name} fue aprobado por Laboratorio y está disponible para iniciar el envasado.`
          });
        } else {
          await this.notifications.notifyTankAction(tx, {
            companyId,
            actorUserId: user.sub,
            tankId: tank.id,
            targetSector: 'FABRICACION',
            title:
              state === 'AJUSTE' ? 'Tanque requiere ajuste' : 'Tanque rechazado por Laboratorio',
            message: `${tank.name} requiere intervención de Fabricación${decisionReason ? `: ${decisionReason}` : '.'}`
          });
        }
        await this.audit(
          tx,
          companyId,
          user,
          tank.id,
          tank.activeLotId,
          'QUALITY_DECISION',
          'QualityDecision',
          decision.id,
          null,
          dto,
          decisionReason
        );
        return { ok: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async correctQualityAdjustment(
    companyId: string,
    tankId: string,
    user: JwtUser,
    dto: CorrectQualityAdjustmentDto
  ) {
    const adjustmentReasons = [
      ...new Set(dto.adjustmentReasons.map((reason) => reason.trim()).filter(Boolean))
    ];
    if (!adjustmentReasons.length)
      throw new BadRequestException('Seleccioná al menos un motivo de ajuste');
    if (
      !(adjustmentReasons.length === 1 && adjustmentReasons[0] === AGITATION_ADJUSTMENT_REASON) &&
      !dto.adjustments?.length
    )
      throw new BadRequestException('Agregá al menos un material para el ajuste');
    const decisionReason = adjustmentReasons.join(', ');

    return this.prisma.$transaction(
      async (tx) => {
        const tank = await this.findTank(tx, companyId, tankId);
        this.assertTank(tank, 'AJUSTE', dto.version);
        if (!tank.activeLotId) throw new ConflictException('El tanque no tiene un lote activo');

        const current = await tx.qualityDecision.findFirst({
          where: { companyId, lotId: tank.activeLotId, result: 'AJUSTE', cancelledAt: null },
          include: { adjustmentItems: { orderBy: { position: 'asc' } } },
          orderBy: { createdAt: 'desc' }
        });
        if (!current)
          throw new ConflictException('No existe una solicitud de ajuste activa para corregir');

        const changed = await tx.tank.updateMany({
          where: { id: tank.id, state: 'AJUSTE', version: dto.version },
          data: { version: { increment: 1 } }
        });
        if (changed.count !== 1)
          throw new ConflictException('El tanque cambió. Actualizá la pantalla.');

        const before = {
          reason: current.reason,
          adjustmentReasons: current.adjustmentReasons,
          adjustments: current.adjustmentItems.map((item) => ({
            materialCode: item.materialCode,
            quantityKg: Number(item.quantityKg)
          }))
        };
        const decision = await tx.qualityDecision.update({
          where: { id: current.id },
          data: {
            reason: decisionReason,
            adjustmentReasons,
            adjustmentItems: {
              deleteMany: {},
              create: (dto.adjustments ?? []).map((item, position) => ({
                position,
                materialCode: item.materialCode,
                quantityKg: item.quantityKg
              }))
            }
          },
          include: { adjustmentItems: { orderBy: { position: 'asc' } } }
        });
        const after = {
          reason: decision.reason,
          adjustmentReasons: decision.adjustmentReasons,
          adjustments: decision.adjustmentItems.map((item) => ({
            materialCode: item.materialCode,
            quantityKg: Number(item.quantityKg)
          }))
        };

        await this.notifications.notifyTankAction(tx, {
          companyId,
          actorUserId: user.sub,
          tankId: tank.id,
          targetSector: 'FABRICACION',
          title: 'Solicitud de ajuste actualizada',
          message: `${tank.name}: Laboratorio corrigió la solicitud de ajuste (${decisionReason}).`
        });
        await this.audit(
          tx,
          companyId,
          user,
          tank.id,
          tank.activeLotId,
          'CORRECTION',
          'QualityDecision',
          decision.id,
          before,
          after,
          'Corrección de solicitud de ajuste'
        );
        return { ok: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async startPackaging(companyId: string, tankId: string, user: JwtUser, dto: PackagingDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const tank = await this.findTank(tx, companyId, tankId);
        await this.assertFinalOperation(tx, tank.plantId, 'PACKAGING');
        await this.validatePackaging(companyId, dto, tank.plantId);
        this.assertTank(tank, 'APROBADO', dto.version);
        if (!tank.activeLotId) throw new ConflictException('El tanque no tiene un lote activo');
        await this.assertLatexPackagingSlot(tx, tank.plantId, tank.id);
        const order = await tx.packagingOrder.create({
          data: {
            companyId,
            plantId: tank.plantId,
            tankId,
            lotId: tank.activeLotId,
            packagingOrder: dto.packagingOrder,
            materialCode: dto.materialCode,
            line: dto.line,
            format: dto.format,
            dispenser: dto.dispenser ?? null,
            filter: dto.filter ?? null,
            description: dto.description?.trim() ?? '',
            startedByUserId: user.sub
          }
        });
        await this.move(tx, tank, 'ENVASANDO', user, tank.activeLotId, `OE ${dto.packagingOrder}`);
        const planned = await tx.packagingPlanningCard.findFirst({
          where: { companyId, plantId: tank.plantId, tankId: tank.id }
        });
        if (planned) {
          await tx.packagingPlanningCard.delete({ where: { id: planned.id } });
          await tx.packagingPlanningCard.updateMany({
            where: {
              plantId: tank.plantId,
              position: { gt: planned.position }
            },
            data: { position: { decrement: 1 } }
          });
        }
        await this.audit(
          tx,
          companyId,
          user,
          tank.id,
          tank.activeLotId,
          'CREATE',
          'PackagingOrder',
          order.id,
          null,
          dto,
          null
        );
        return { ok: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }
    );
  }

  async pausePackaging(companyId: string, tankId: string, user: JwtUser, dto: VersionedActionDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const tank = await this.findTank(tx, companyId, tankId);
        await this.assertLatexPackagingPlant(tx, tank.plantId);
        this.assertTank(tank, 'ENVASANDO', dto.version);
        await this.assertOpenPackagingOrder(tx, tank.id);
        await this.move(
          tx,
          tank,
          'ENVASADO_PAUSADO',
          user,
          tank.activeLotId,
          dto.reason?.trim() || 'Envasado pausado'
        );
        return { ok: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }
    );
  }

  async resumePackaging(companyId: string, tankId: string, user: JwtUser, dto: VersionedActionDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const tank = await this.findTank(tx, companyId, tankId);
        await this.assertLatexPackagingPlant(tx, tank.plantId);
        this.assertTank(tank, 'ENVASADO_PAUSADO', dto.version);
        await this.assertOpenPackagingOrder(tx, tank.id);
        await this.assertLatexPackagingSlot(tx, tank.plantId, tank.id);
        await this.move(
          tx,
          tank,
          'ENVASANDO',
          user,
          tank.activeLotId,
          dto.reason?.trim() || 'Envasado reanudado'
        );
        return { ok: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }
    );
  }

  private async assertLatexPackagingPlant(tx: Prisma.TransactionClient, plantId: string) {
    const plant = await tx.plant.findUnique({ where: { id: plantId }, select: { code: true } });
    if (plant?.code !== 'LATEX')
      throw new BadRequestException('La pausa de envasado sólo está disponible para Látex');
  }

  private async assertOpenPackagingOrder(tx: Prisma.TransactionClient, tankId: string) {
    const order = await tx.packagingOrder.findFirst({
      where: { tankId, finishedAt: null, cancelledAt: null },
      select: { id: true }
    });
    if (!order) throw new ConflictException('No existe una OE abierta');
  }

  async newPackagingOrder(companyId: string, tankId: string, user: JwtUser, dto: PackagingDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const tank = await this.findTank(tx, companyId, tankId);
        await this.assertFinalOperation(tx, tank.plantId, 'PACKAGING');
        await this.validatePackaging(companyId, dto, tank.plantId);
        this.assertTank(tank, 'ENVASANDO', dto.version);
        if (!tank.activeLotId) throw new ConflictException('El tanque no tiene un lote activo');
        await this.closePackaging(tx, tank.id, user.sub);
        const order = await tx.packagingOrder.create({
          data: {
            companyId,
            plantId: tank.plantId,
            tankId,
            lotId: tank.activeLotId,
            packagingOrder: dto.packagingOrder,
            materialCode: dto.materialCode,
            line: dto.line,
            format: dto.format,
            dispenser: dto.dispenser ?? null,
            filter: dto.filter ?? null,
            description: dto.description?.trim() ?? '',
            startedByUserId: user.sub
          }
        });
        const changed = await tx.tank.updateMany({
          where: { id: tank.id, version: tank.version, state: tank.state },
          data: { version: { increment: 1 } }
        });
        if (changed.count !== 1)
          throw new ConflictException('El tanque cambió. Actualizá la pantalla.');
        await this.audit(
          tx,
          companyId,
          user,
          tank.id,
          tank.activeLotId,
          'NEW_ORDER',
          'PackagingOrder',
          order.id,
          null,
          dto,
          dto.reason
        );
        return { ok: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async correctPackaging(
    companyId: string,
    tankId: string,
    user: JwtUser,
    dto: CorrectPackagingDto
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const tank = await this.findTank(tx, companyId, tankId);
        await this.assertFinalOperation(tx, tank.plantId, 'PACKAGING');
        await this.validatePackaging(companyId, dto, tank.plantId);
        this.assertTank(tank, 'ENVASANDO', dto.version);
        const current = await tx.packagingOrder.findFirst({
          where: { tankId, finishedAt: null, cancelledAt: null },
          orderBy: { startedAt: 'desc' }
        });
        if (!current) throw new ConflictException('No existe una OE abierta');
        const after = await tx.packagingOrder.update({
          where: { id: current.id },
          data: {
            packagingOrder: dto.packagingOrder,
            materialCode: dto.materialCode,
            line: dto.line,
            format: dto.format,
            dispenser: dto.dispenser ?? null,
            filter: dto.filter ?? null,
            description: dto.description?.trim() ?? ''
          }
        });
        const changed = await tx.tank.updateMany({
          where: { id: tank.id, version: tank.version },
          data: { version: { increment: 1 } }
        });
        if (changed.count !== 1)
          throw new ConflictException('El tanque cambió. Actualizá la pantalla.');
        await this.audit(
          tx,
          companyId,
          user,
          tank.id,
          tank.activeLotId,
          'CORRECTION',
          'PackagingOrder',
          current.id,
          current,
          after,
          dto.reason
        );
        return { ok: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async finishPackaging(companyId: string, tankId: string, user: JwtUser, dto: FinishPackagingDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const tank = await this.findTank(tx, companyId, tankId);
        await this.assertFinalOperation(tx, tank.plantId, 'PACKAGING');
        this.assertTank(tank, 'ENVASANDO', dto.version);
        await this.closePackaging(tx, tank.id, user.sub, dto);
        if (tank.activeLotId)
          await tx.productionLot.update({
            where: { id: tank.activeLotId },
            data: { finishedAt: new Date() }
          });
        await this.move(tx, tank, 'VACIO', user, tank.activeLotId, 'Fin de envasado');
        await tx.tank.update({ where: { id: tank.id }, data: { activeLotId: null } });
        await this.notifications.notifyTankAction(tx, {
          companyId,
          actorUserId: user.sub,
          tankId: tank.id,
          targetSector: 'FABRICACION',
          title: 'Tanque disponible para fabricar',
          message: `${tank.name} finalizó el envasado y quedó vacío para una nueva fabricación.`
        });
        return { ok: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async emptyRejected(companyId: string, tankId: string, user: JwtUser, dto: VersionedActionDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const tank = await this.findTank(tx, companyId, tankId);
        this.assertTank(tank, 'RECHAZADO', dto.version);
        if (tank.activeLotId)
          await tx.productionLot.update({
            where: { id: tank.activeLotId },
            data: { finishedAt: new Date() }
          });
        await this.move(
          tx,
          tank,
          'VACIO',
          user,
          tank.activeLotId,
          dto.reason ?? 'Vaciado de lote rechazado'
        );
        await tx.tank.update({ where: { id: tank.id }, data: { activeLotId: null } });
        return { ok: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async startTransfer(companyId: string, tankId: string, user: JwtUser, dto: VersionedActionDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const tank = await this.findTank(tx, companyId, tankId);
        this.assertTank(tank, 'APROBADO', dto.version);
        await this.assertFinalOperation(tx, tank.plantId, 'TRANSFER');
        const access = await tx.userPlantAccess.findUnique({
          where: { userId_plantId: { userId: user.sub, plantId: tank.plantId } }
        });
        if (!access?.canTransfer && user.role !== 'ADMIN')
          throw new UnauthorizedException('El usuario no tiene permiso explícito de trasvase');
        if (!tank.activeLotId) throw new ConflictException('El equipo no tiene un lote activo');
        const operation = await tx.transferOperation.create({
          data: {
            companyId,
            plantId: tank.plantId,
            tankId,
            lotId: tank.activeLotId,
            startedByUserId: user.sub
          }
        });
        await this.move(
          tx,
          tank,
          'TRASVASANDO',
          user,
          tank.activeLotId,
          dto.reason ?? 'Inicio de trasvase'
        );
        await this.audit(
          tx,
          companyId,
          user,
          tank.id,
          tank.activeLotId,
          'CREATE',
          'TransferOperation',
          operation.id,
          null,
          dto,
          dto.reason
        );
        return { ok: true, transferOperationId: operation.id };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async finishTransfer(companyId: string, tankId: string, user: JwtUser, dto: VersionedActionDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const tank = await this.findTank(tx, companyId, tankId);
        this.assertTank(tank, 'TRASVASANDO', dto.version);
        await this.assertFinalOperation(tx, tank.plantId, 'TRANSFER');
        const access = await tx.userPlantAccess.findUnique({
          where: { userId_plantId: { userId: user.sub, plantId: tank.plantId } }
        });
        if (!access?.canTransfer && user.role !== 'ADMIN')
          throw new UnauthorizedException('El usuario no tiene permiso explícito de trasvase');
        const operation = await tx.transferOperation.findFirst({
          where: { tankId, finishedAt: null, cancelledAt: null },
          orderBy: { startedAt: 'desc' }
        });
        if (!operation) throw new ConflictException('No existe un trasvase abierto');
        const finishedAt = new Date();
        await tx.transferOperation.update({
          where: { id: operation.id },
          data: {
            finishedAt,
            finishedByUserId: user.sub,
            durationSeconds: Math.max(
              0,
              Math.floor((finishedAt.getTime() - operation.startedAt.getTime()) / 1000)
            )
          }
        });
        if (tank.activeLotId)
          await tx.productionLot.update({ where: { id: tank.activeLotId }, data: { finishedAt } });
        await this.move(tx, tank, 'VACIO', user, tank.activeLotId, dto.reason ?? 'Fin de trasvase');
        await tx.tank.update({ where: { id: tank.id }, data: { activeLotId: null } });
        return { ok: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async serviceOut(companyId: string, tankId: string, user: JwtUser, dto: ServiceDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const tank = await this.findTank(tx, companyId, tankId);
        this.assertTank(tank, 'VACIO', dto.version);
        await this.move(tx, tank, 'FUERA_DE_SERVICIO', user, null, dto.reason, {
          serviceReason: dto.reason,
          serviceNotes: dto.notes
        });
        return { ok: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async serviceIn(companyId: string, tankId: string, user: JwtUser, dto: VersionedActionDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const tank = await this.findTank(tx, companyId, tankId);
        this.assertTank(tank, 'FUERA_DE_SERVICIO', dto.version);
        await this.move(tx, tank, 'VACIO', user, null, dto.reason ?? 'Equipo habilitado', {
          serviceReason: null,
          serviceNotes: null
        });
        return { ok: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async correctLot(companyId: string, tankId: string, user: JwtUser, dto: CorrectLotDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const tank = await this.findTank(tx, companyId, tankId);
        if (tank.version !== dto.version || !tank.activeLotId)
          throw new ConflictException('El tanque cambió. Actualizá la pantalla.');
        const before = await tx.productionLot.findUniqueOrThrow({
          where: { id: tank.activeLotId }
        });
        const after = await tx.productionLot.update({
          where: { id: tank.activeLotId },
          data: {
            manufacturingOrder: dto.manufacturingOrder,
            materialCode: dto.materialCode,
            description: dto.description?.trim()
          }
        });
        const changed = await tx.tank.updateMany({
          where: { id: tank.id, version: tank.version },
          data: { version: { increment: 1 } }
        });
        if (changed.count !== 1)
          throw new ConflictException('El tanque cambió. Actualizá la pantalla.');
        await this.audit(
          tx,
          companyId,
          user,
          tank.id,
          tank.activeLotId,
          'CORRECTION',
          'ProductionLot',
          tank.activeLotId,
          before,
          after,
          dto.reason
        );
        return { ok: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  async history(
    companyId: string,
    tankId?: string,
    state?: string,
    from?: string,
    to?: string,
    plantId?: string,
    offset?: string
  ) {
    const fromDate = from ? this.plantDayBounds(from).start : undefined;
    const toDate = to ? this.plantDayBounds(to).end : undefined;
    const parsedOffset = Number(offset ?? 0);
    const skip = Number.isSafeInteger(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;
    const rows = await this.prisma.tankStateHistory.findMany({
      where: {
        companyId,
        plantId,
        tankId: tankId || undefined,
        state:
          state && Object.values(TankState).includes(state as TankState)
            ? (state as TankState)
            : undefined,
        startedAt: { lt: toDate },
        OR: fromDate ? [{ endedAt: null }, { endedAt: { gte: fromDate } }] : undefined
      },
      include: {
        tank: { select: { number: true, name: true } },
        lot: { include: { packagingOrders: { orderBy: { startedAt: 'desc' } } } },
        user: { select: { fullName: true, username: true } }
      },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: 1000,
      skip
    });
    const now = new Date();
    return rows.map((row) => ({
      ...row,
      durationSeconds:
        row.durationSeconds ??
        Math.max(0, Math.floor(((row.endedAt ?? now).getTime() - row.startedAt.getTime()) / 1000))
    }));
  }

  async historySummary(
    companyId: string,
    plantId: string,
    filters: {
      tankId?: string;
      state?: string;
      from?: string;
      to?: string;
      search?: string;
      sortBy?: string;
      sortDirection?: string;
      offset?: string;
      limit?: string;
    }
  ) {
    const fromDate = filters.from ? this.plantDayBounds(filters.from).start : undefined;
    const toDate = filters.to ? this.plantDayBounds(filters.to).end : undefined;
    if (fromDate && toDate && fromDate >= toDate)
      throw new BadRequestException('El inicio debe ser anterior al fin');
    if (filters.state && !Object.values(TankState).includes(filters.state as TankState))
      throw new BadRequestException('Estado inválido');
    const offset = Number(filters.offset ?? 0);
    const limit = Number(filters.limit ?? 50);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100_000)
      throw new BadRequestException('Desplazamiento inválido');
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000)
      throw new BadRequestException('Límite inválido');
    const sortBy = filters.sortBy ?? 'manufacturingOrder';
    const allowedSorts = [
      'manufacturingOrder',
      'materialCode',
      'description',
      'adjustments',
      'packagingOrders'
    ];
    if (!allowedSorts.includes(sortBy)) throw new BadRequestException('Columna de orden inválida');
    const sortDirection = filters.sortDirection ?? 'asc';
    if (sortDirection !== 'asc' && sortDirection !== 'desc')
      throw new BadRequestException('Dirección de orden inválida');
    const search = filters.search?.trim() ?? '';
    if (search.length > 180) throw new BadRequestException('Búsqueda demasiado larga');

    const rows = await this.prisma.$queryRaw<
      Array<{
        lotId: string;
        manufacturingOrder: string;
        materialCode: string;
        description: string;
        adjustments: bigint;
        packagingOrders: bigint;
      }>
    >(Prisma.sql`
      WITH matching_lots AS (
        SELECT DISTINCT h."lotId"
        FROM "TankStateHistory" h
        JOIN "ProductionLot" l ON l.id = h."lotId"
        JOIN "Tank" t ON t.id = h."tankId"
        LEFT JOIN "User" u ON u.id = h."userId"
        WHERE h."companyId" = ${companyId}
          AND h."plantId" = ${plantId}
          AND l."companyId" = ${companyId}
          AND l."plantId" = ${plantId}
          AND h."lotId" IS NOT NULL
          ${filters.tankId ? Prisma.sql`AND h."tankId" = ${filters.tankId}` : Prisma.empty}
          ${filters.state ? Prisma.sql`AND h.state = ${filters.state}::"TankState"` : Prisma.empty}
          ${toDate ? Prisma.sql`AND h."startedAt" < ${toDate}` : Prisma.empty}
          ${fromDate ? Prisma.sql`AND (h."endedAt" IS NULL OR h."endedAt" > ${fromDate})` : Prisma.empty}
          ${
            search
              ? Prisma.sql`AND (
            strpos(lower(t.name), lower(${search})) > 0
            OR strpos(t.number::text, ${search}) > 0
            OR strpos(lower(l."manufacturingOrder"), lower(${search})) > 0
            OR strpos(lower(l."materialCode"), lower(${search})) > 0
            OR strpos(lower(l.description), lower(${search})) > 0
            OR strpos(lower(COALESCE(h.description, '')), lower(${search})) > 0
            OR strpos(lower(COALESCE(u."fullName", '')), lower(${search})) > 0
            OR strpos(lower(COALESCE(u.username, '')), lower(${search})) > 0
            OR EXISTS (
              SELECT 1 FROM "PackagingOrder" po
              WHERE po."lotId" = l.id
                AND po."companyId" = ${companyId}
                AND po."plantId" = ${plantId}
                AND (
                strpos(lower(po."packagingOrder"), lower(${search})) > 0
                OR strpos(lower(COALESCE(po."materialCode", '')), lower(${search})) > 0
                OR strpos(lower(po.description), lower(${search})) > 0
                OR strpos(lower(po.line), lower(${search})) > 0
                OR strpos(lower(po.format), lower(${search})) > 0
                OR strpos(lower(COALESCE(po.dispenser, '')), lower(${search})) > 0
                OR strpos(lower(COALESCE(po.filter, '')), lower(${search})) > 0
              )
            )
          )`
              : Prisma.empty
          }
      )
      SELECT l.id AS "lotId", l."manufacturingOrder", l."materialCode", l.description,
        (SELECT COUNT(*) FROM "QualityDecision" q
          WHERE q."lotId" = l.id
            AND q."companyId" = ${companyId}
            AND q."plantId" = ${plantId}
            AND q.result = 'AJUSTE'::"QualityResult"
            AND q."cancelledAt" IS NULL
            ${fromDate ? Prisma.sql`AND q."createdAt" >= ${fromDate}` : Prisma.empty}
            ${toDate ? Prisma.sql`AND q."createdAt" < ${toDate}` : Prisma.empty}
        ) AS adjustments,
        (SELECT COUNT(*) FROM "PackagingOrder" po
          WHERE po."lotId" = l.id
            AND po."companyId" = ${companyId}
            AND po."plantId" = ${plantId}
            AND po."cancelledAt" IS NULL
        ) AS "packagingOrders"
      FROM matching_lots m
      JOIN "ProductionLot" l ON l.id = m."lotId"
    `);
    const collator = new Intl.Collator('es-AR', { numeric: true, sensitivity: 'base' });
    const sorted = rows
      .map((row) => ({
        ...row,
        adjustments: Number(row.adjustments),
        packagingOrders: Number(row.packagingOrders)
      }))
      .sort((left, right) => {
        const comparison =
          sortBy === 'adjustments' || sortBy === 'packagingOrders'
            ? Number(left[sortBy]) - Number(right[sortBy])
            : collator.compare(
                String(left[sortBy as 'manufacturingOrder' | 'materialCode' | 'description']),
                String(right[sortBy as 'manufacturingOrder' | 'materialCode' | 'description'])
              );
        return (
          (sortDirection === 'desc' ? -comparison : comparison) ||
          left.lotId.localeCompare(right.lotId)
        );
      });
    return { total: sorted.length, rows: sorted.slice(offset, offset + limit) };
  }

  async lotTimeline(
    companyId: string,
    lotId: string,
    plantId?: string,
    includeWeightHistory = false
  ) {
    const lot = await this.prisma.productionLot.findFirst({
      where: { id: lotId, companyId, plantId },
      include: {
        tank: {
          select: {
            name: true,
            number: true,
            scaleKey: true,
            plant: { select: { code: true } }
          }
        },
        stateHistory: {
          include: { user: { select: { fullName: true, username: true } } },
          orderBy: { startedAt: 'asc' }
        },
        qualityDecisions: {
          include: {
            user: { select: { fullName: true } },
            adjustmentItems: { orderBy: { position: 'asc' } }
          },
          orderBy: { createdAt: 'asc' }
        },
        laboratorySamples: {
          include: {
            requestedBy: { select: { fullName: true } },
            receivedBy: { select: { fullName: true } },
            analysisStartedBy: { select: { fullName: true } }
          },
          orderBy: { iteration: 'asc' }
        },
        packagingOrders: {
          include: {
            startedBy: { select: { fullName: true } },
            finishedBy: { select: { fullName: true } }
          },
          orderBy: { startedAt: 'asc' }
        },
        transferOperations: {
          include: {
            startedBy: { select: { fullName: true } },
            finishedBy: { select: { fullName: true } }
          },
          orderBy: { startedAt: 'asc' }
        }
      }
    });
    if (!lot) throw new NotFoundException('Orden de fabricación no encontrada');
    const now = new Date();
    const manufacturingStartedAt =
      lot.stateHistory.find((row) => row.state === 'FABRICANDO')?.startedAt ?? lot.startedAt;
    const weightHistory =
      includeWeightHistory && this.influxHistory
        ? await this.influxHistory.readWeightSeries(
            lot.tank.scaleKey,
            manufacturingStartedAt,
            lot.finishedAt ?? now,
            { plantCode: lot.tank.plant.code, tankNumber: lot.tank.number }
          )
        : {
            status: 'CONFIGURATION_PENDING' as const,
            message: 'La consulta histórica de InfluxDB todavía no está configurada.',
            points: [],
            lastTimestamp: null
          };
    return {
      ...lot,
      tank: { name: lot.tank.name, number: lot.tank.number },
      specificWeight: lot.specificWeight === null ? null : Number(lot.specificWeight),
      plannedQuantityKg: lot.plannedQuantityKg === null ? null : Number(lot.plannedQuantityKg),
      totalDurationSeconds: Math.max(
        0,
        Math.floor(((lot.finishedAt ?? now).getTime() - lot.startedAt.getTime()) / 1000)
      ),
      stateHistory: lot.stateHistory.map((row) => ({
        ...row,
        weightKg: row.weightKg === null ? null : Number(row.weightKg),
        durationSeconds:
          row.durationSeconds ??
          Math.max(0, Math.floor(((row.endedAt ?? now).getTime() - row.startedAt.getTime()) / 1000))
      })),
      qualityDecisions: lot.qualityDecisions.map((decision) => ({
        ...decision,
        specificWeight: decision.specificWeight === null ? null : Number(decision.specificWeight),
        adjustmentItems: decision.adjustmentItems.map((item) => ({
          ...item,
          quantityKg: Number(item.quantityKg)
        }))
      })),
      laboratorySamples: lot.laboratorySamples.map((sample) => ({
        ...sample,
        waitingForReceiptSeconds: sample.receivedAt
          ? Math.max(
              0,
              Math.floor((sample.receivedAt.getTime() - sample.requestedAt.getTime()) / 1000)
            )
          : null,
        waitingForAnalysisSeconds:
          sample.receivedAt && sample.analysisStartedAt
            ? Math.max(
                0,
                Math.floor(
                  (sample.analysisStartedAt.getTime() - sample.receivedAt.getTime()) / 1000
                )
              )
            : null,
        analysisSeconds:
          sample.analysisStartedAt && sample.resolvedAt
            ? Math.max(
                0,
                Math.floor(
                  (sample.resolvedAt.getTime() - sample.analysisStartedAt.getTime()) / 1000
                )
              )
            : null
      })),
      packagingOrders: lot.packagingOrders.map((order) => ({
        ...order,
        producedKg: order.producedKg === null ? null : Number(order.producedKg),
        wasteKg: order.wasteKg === null ? null : Number(order.wasteKg)
      })),
      manufacturingCharges: [],
      weightHistory
    };
  }

  async dailyManagement(companyId: string, date: string, plantId?: string) {
    if (!plantId)
      plantId = (
        await this.prisma.plant.findFirstOrThrow({
          where: { companyId, code: 'LATEX' },
          select: { id: true }
        })
      ).id;
    const plant = await this.prisma.plant.findUniqueOrThrow({
      where: { id: plantId },
      select: { code: true, name: true, finalOperation: true }
    });
    const { start, end } = this.plantDayBounds(date);
    const now = new Date();
    const isLive = now >= start && now < end;
    const reportAt = isLive ? now : new Date(end.getTime() - 1);
    const [liveTanks, periods, completedLots, quality, packaging, laboratorySamples, closure] =
      await Promise.all([
        this.tanks(companyId, plantId),
        this.prisma.tankStateHistory.findMany({
          where: {
            companyId,
            plantId,
            startedAt: { lt: end },
            OR: [{ endedAt: null }, { endedAt: { gte: start } }]
          },
          include: {
            tank: { select: { name: true, number: true } },
            lot: {
              select: {
                id: true,
                manufacturingOrder: true,
                materialCode: true,
                description: true,
                priority: true,
                plannedQuantityKg: true
              }
            }
          },
          orderBy: { startedAt: 'asc' }
        }),
        this.prisma.productionLot.findMany({
          where: { companyId, plantId, cancelledAt: null, finishedAt: { gte: start, lt: end } },
          select: {
            id: true,
            manufacturingOrder: true,
            materialCode: true,
            description: true,
            startedAt: true,
            finishedAt: true
          }
        }),
        this.prisma.qualityDecision.findMany({
          where: { companyId, plantId, cancelledAt: null, createdAt: { gte: start, lt: end } },
          select: { result: true }
        }),
        this.prisma.packagingOrder.findMany({
          where: { companyId, plantId, finishedAt: { gte: start, lt: end } },
          select: { producedKg: true, wasteKg: true, producedUnits: true, durationSeconds: true }
        }),
        this.prisma.laboratorySample.findMany({
          where: {
            companyId,
            plantId,
            cancelledAt: null,
            requestedAt: { lt: end },
            OR: [{ resolvedAt: null }, { resolvedAt: { gte: start } }]
          },
          select: {
            status: true,
            requestedAt: true,
            receivedAt: true,
            analysisStartedAt: true,
            resolvedAt: true
          }
        }),
        this.prisma.dailyPlantClosure.findUnique({
          where: { plantId_date: { plantId, date: start } },
          include: { createdBy: { select: { fullName: true } } }
        })
      ]);
    const durationByState: Record<string, number> = {};
    for (const period of periods) {
      const effectiveStart = Math.max(period.startedAt.getTime(), start.getTime());
      const effectiveEnd = Math.min((period.endedAt ?? new Date()).getTime(), end.getTime());
      durationByState[period.state] =
        (durationByState[period.state] ?? 0) +
        Math.max(0, Math.floor((effectiveEnd - effectiveStart) / 1000));
    }
    const tanks = isLive
      ? liveTanks
      : liveTanks.map((tank) => {
          const period = [...periods]
            .reverse()
            .find(
              (candidate) =>
                candidate.tankId === tank.id &&
                candidate.startedAt <= reportAt &&
                (!candidate.endedAt || candidate.endedAt > reportAt)
            );
          const elapsed = period
            ? Math.max(0, Math.floor((reportAt.getTime() - period.startedAt.getTime()) / 1000))
            : 0;
          const target = period?.targetSeconds ?? null;
          return {
            ...tank,
            state: period?.state ?? TankState.VACIO,
            activeLot: period?.lot
              ? {
                  ...period.lot,
                  plannedQuantityKg:
                    period.lot.plannedQuantityKg === null
                      ? null
                      : Number(period.lot.plannedQuantityKg)
                }
              : null,
            stateStartedAt: period?.startedAt ?? start,
            stateElapsedSeconds: elapsed,
            stateTargetSeconds: target,
            stateAttention: target
              ? elapsed >= target
                ? 'CRITICAL'
                : elapsed >= target * 0.8
                  ? 'WARNING'
                  : 'OK'
              : 'OK',
            telemetry: {
              grossKg:
                period?.weightKg === null || period?.weightKg === undefined
                  ? null
                  : Number(period.weightKg),
              netKg: null,
              measuredAt: null,
              receivedAt: null,
              online: true,
              ageMs: null
            }
          };
        });
    const totals = packaging.reduce(
      (acc, order) => ({
        producedKg: acc.producedKg + Number(order.producedKg ?? 0),
        wasteKg: acc.wasteKg + Number(order.wasteKg ?? 0),
        producedUnits: acc.producedUnits + Number(order.producedUnits ?? 0)
      }),
      { producedKg: 0, wasteKg: 0, producedUnits: 0 }
    );
    const currentByState = tanks.reduce<Record<string, number>>((acc, tank) => {
      acc[tank.state] = (acc[tank.state] ?? 0) + 1;
      return acc;
    }, {});
    const receiptDurations = laboratorySamples
      .filter(
        (sample) => sample.receivedAt && sample.receivedAt >= start && sample.receivedAt < end
      )
      .map((sample) =>
        Math.max(
          0,
          Math.floor((sample.receivedAt!.getTime() - sample.requestedAt.getTime()) / 1000)
        )
      );
    const analysisDurations = laboratorySamples
      .filter(
        (sample) =>
          sample.analysisStartedAt &&
          sample.resolvedAt &&
          sample.resolvedAt >= start &&
          sample.resolvedAt < end
      )
      .map((sample) =>
        Math.max(
          0,
          Math.floor((sample.resolvedAt!.getTime() - sample.analysisStartedAt!.getTime()) / 1000)
        )
      );
    const average = (values: number[]) =>
      values.length
        ? Math.round(values.reduce((total, value) => total + value, 0) / values.length)
        : null;
    const awaitingReceipt = laboratorySamples.filter(
      (sample) =>
        sample.requestedAt <= reportAt && (!sample.receivedAt || sample.receivedAt > reportAt)
    ).length;
    const inAnalysis = laboratorySamples.filter(
      (sample) =>
        sample.analysisStartedAt &&
        sample.analysisStartedAt <= reportAt &&
        (!sample.resolvedAt || sample.resolvedAt > reportAt)
    ).length;
    return {
      plant,
      date,
      generatedAt: new Date().toISOString(),
      isLive,
      snapshotAt: reportAt.toISOString(),
      currentByState,
      onlineScales: isLive ? tanks.filter((tank) => tank.telemetry.online).length : null,
      completedLots: completedLots.map((lot) => ({
        ...lot,
        durationSeconds: Math.max(
          0,
          Math.floor(((lot.finishedAt?.getTime() ?? Date.now()) - lot.startedAt.getTime()) / 1000)
        )
      })),
      quality: quality.reduce<Record<string, number>>((acc, decision) => {
        acc[decision.result] = (acc[decision.result] ?? 0) + 1;
        return acc;
      }, {}),
      laboratory: {
        awaitingReceipt,
        inAnalysis,
        received: laboratorySamples.filter(
          (sample) => sample.receivedAt && sample.receivedAt >= start && sample.receivedAt < end
        ).length,
        resolved: laboratorySamples.filter(
          (sample) => sample.resolvedAt && sample.resolvedAt >= start && sample.resolvedAt < end
        ).length,
        averageReceiptSeconds: average(receiptDurations),
        averageAnalysisSeconds: average(analysisDurations)
      },
      packaging: { ...totals, completedOrders: packaging.length },
      durationByState,
      tanks,
      attention: tanks.filter(
        (tank) =>
          tank.stateAttention !== 'OK' ||
          (isLive && tank.telemetry.online === false && tank.telemetryMode === 'AUTOMATIC')
      ),
      closure
    };
  }

  async closeDay(companyId: string, user: JwtUser, dto: DailyClosureDto, plantId?: string) {
    if (!plantId)
      plantId = (
        await this.prisma.plant.findFirstOrThrow({
          where: { companyId, code: 'LATEX' },
          select: { id: true }
        })
      ).id;
    const snapshot = await this.dailyManagement(companyId, dto.date, plantId);
    const { start } = this.plantDayBounds(dto.date);
    const existing = await this.prisma.dailyPlantClosure.findUnique({
      where: { plantId_date: { plantId, date: start } }
    });
    if (existing)
      throw new ConflictException('La jornada ya fue cerrada y su fotografía no puede modificarse');
    const serializableSnapshot = JSON.parse(
      JSON.stringify({ ...snapshot, closure: null })
    ) as Prisma.InputJsonValue;
    return this.prisma.dailyPlantClosure.create({
      data: {
        companyId,
        plantId,
        date: start,
        snapshot: serializableSnapshot,
        notes: dto.notes,
        createdByUserId: user.sub
      },
      include: { createdBy: { select: { fullName: true } } }
    });
  }

  closures(companyId: string, plantId?: string) {
    return this.prisma.dailyPlantClosure.findMany({
      where: { companyId, plantId },
      include: { createdBy: { select: { fullName: true } } },
      orderBy: { date: 'desc' },
      take: 90
    });
  }

  async updateTargets(companyId: string, dto: StageTargetsDto, plantId?: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { settings: true }
    });
    if (!company) throw new NotFoundException('Empresa no encontrada');
    const settings = (company.settings ?? {}) as Record<string, unknown>;
    const plantStageTargetsMinutes = {
      FABRICANDO: dto.fabricando,
      LABORATORIO: dto.laboratorio,
      AJUSTE: dto.ajuste,
      RECHAZADO: dto.rechazado,
      APROBADO: dto.aprobado,
      ENVASANDO: dto.envasando,
      FUERA_DE_SERVICIO: dto.fueraDeServicio
    };
    if (plantId) {
      const plant = await this.prisma.plant.findUniqueOrThrow({
        where: { id: plantId },
        select: { settings: true }
      });
      await this.prisma.plant.update({
        where: { id: plantId },
        data: {
          settings: {
            ...((plant.settings ?? {}) as object),
            stageTargetsMinutes: plantStageTargetsMinutes
          } as Prisma.InputJsonValue
        }
      });
    } else
      await this.prisma.company.update({
        where: { id: companyId },
        data: { settings: { ...settings, plantStageTargetsMinutes } as Prisma.InputJsonValue }
      });
    return { stageTargetsMinutes: plantStageTargetsMinutes };
  }

  async managementExport(companyId: string, date: string, format: 'pdf' | 'xls', plantId?: string) {
    const liveReport = await this.dailyManagement(companyId, date, plantId);
    const report = liveReport.closure?.snapshot
      ? {
          ...(liveReport.closure.snapshot as unknown as Omit<typeof liveReport, 'closure'>),
          isLive: false
        }
      : liveReport;
    if (format === 'xls') {
      const laboratory = report.laboratory ?? {
        awaitingReceipt: 0,
        inAnalysis: 0,
        received: 0,
        resolved: 0,
        averageReceiptSeconds: null,
        averageAnalysisSeconds: null
      };
      const rows = report.tanks.map((tank) => [
        tank.name,
        tank.activeLot?.manufacturingOrder ?? '',
        tank.activeLot?.materialCode ?? '',
        tank.activeLot?.description ?? '',
        tank.state,
        tank.stateStartedAt
          ? new Date(tank.stateStartedAt).toLocaleString('es-AR', {
              timeZone: 'America/Argentina/Buenos_Aires'
            })
          : '',
        tank.stateElapsedSeconds ?? 0,
        tank.telemetryMode === 'NOT_INSTALLED'
          ? 'No aplica'
          : tank.telemetryMode === 'PENDING'
            ? 'Mapeo pendiente'
            : tank.telemetry.online
              ? 'En línea'
              : 'Sin señal'
      ]);
      const xmlRows = [
        ['Equipo', 'OF', 'Material', 'Descripción', 'Estado', 'Desde', 'Duración (seg)', 'Balanza'],
        ...rows
      ]
        .map(
          (row) =>
            `<Row>${row.map((cell) => `<Cell><Data ss:Type="${typeof cell === 'number' ? 'Number' : 'String'}">${this.escapeXml(String(cell))}</Data></Cell>`).join('')}</Row>`
        )
        .join('');
      const laboratoryRows = [
        ['Indicador', 'Valor (segundos)'],
        ['Muestras esperando recepción al cierre', laboratory.awaitingReceipt],
        ['Muestras en análisis al cierre', laboratory.inAnalysis],
        ['Muestras recibidas en la jornada', laboratory.received],
        ['Resultados emitidos en la jornada', laboratory.resolved],
        ['Promedio envío a recepción', laboratory.averageReceiptSeconds ?? ''],
        ['Promedio recepción a resultado', laboratory.averageAnalysisSeconds ?? '']
      ]
        .map(
          (row) =>
            `<Row>${row.map((cell) => `<Cell><Data ss:Type="${typeof cell === 'number' ? 'Number' : 'String'}">${this.escapeXml(String(cell))}</Data></Cell>`).join('')}</Row>`
        )
        .join('');
      const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Resumen diario"><Table>${xmlRows}</Table></Worksheet><Worksheet ss:Name="Laboratorio"><Table>${laboratoryRows}</Table></Worksheet></Workbook>`;
      return {
        body: Buffer.from(`\ufeff${xml}`, 'utf8'),
        contentType: 'application/vnd.ms-excel; charset=utf-8',
        filename: `DISAL-resumen-${date}.xls`
      };
    }
    return {
      body: this.managementPdf(report, date),
      contentType: 'application/pdf',
      filename: `DISAL-resumen-${date}.pdf`
    };
  }

  auditHistory(companyId: string, tankId?: string, plantId?: string) {
    return this.prisma.plantAuditLog.findMany({
      where: { companyId, plantId, tankId: tankId || undefined },
      include: {
        tank: { select: { number: true, name: true } },
        user: { select: { fullName: true, username: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 1000
    });
  }

  private async validatePackaging(companyId: string, dto: PackagingDto, plantId?: string) {
    const config = await this.loadConfig(companyId, plantId);
    if (!config.lines.includes(dto.line)) throw new BadRequestException('Celda no configurada');
    if (!config.formats.includes(dto.format))
      throw new BadRequestException('Formato no configurado');
    if (config.plantCode === 'SINTETICOS') return;
    if (!config.dispensers.includes(dto.dispenser ?? ''))
      throw new BadRequestException('Dosificadora no configurada');
    if (!config.filters.includes(dto.filter ?? ''))
      throw new BadRequestException('Filtro no configurado');
    if (!dto.description?.trim())
      throw new BadRequestException('La descripción de envasado es obligatoria');
  }

  private async loadConfig(companyId: string, plantId?: string) {
    const source = plantId
      ? await this.prisma.plant.findUnique({
          where: { id: plantId },
          select: { settings: true, finalOperation: true, code: true }
        })
      : await this.prisma.company.findUnique({
          where: { id: companyId },
          select: { settings: true }
        });
    const settings = (source?.settings ?? {}) as Record<string, unknown>;
    const configuredTargets = (settings.stageTargetsMinutes ??
      settings.plantStageTargetsMinutes) as Record<string, unknown> | undefined;
    const plantCode = (source as { code?: string } | null)?.code;
    const isLatex = !plantId || plantCode === 'LATEX' || plantCode === 'LATEX_VIEJO';
    const isSynthetics = plantCode === 'SINTETICOS';
    return {
      plantCode,
      lines: isSynthetics
        ? SYNTHETICS_LINES
        : Array.isArray(settings.packagingLines)
          ? settings.packagingLines.filter((v): v is string => typeof v === 'string')
          : isLatex
            ? LINES
            : [],
      formats: isSynthetics
        ? SYNTHETICS_FORMATS
        : Array.isArray(settings.packagingFormats)
          ? settings.packagingFormats.filter((v): v is string => typeof v === 'string')
          : isLatex
            ? FORMATS
            : [],
      dispensers: Array.isArray(settings.packagingDispensers)
        ? settings.packagingDispensers.filter((v): v is string => typeof v === 'string')
        : isLatex
          ? DISPENSERS
          : [],
      filters: Array.isArray(settings.packagingFilters)
        ? settings.packagingFilters.filter((v): v is string => typeof v === 'string')
        : isLatex
          ? FILTERS
          : [],
      adjustmentReasons: [
        ...new Set(
          Array.isArray(settings.adjustmentReasons)
            ? [
                ...settings.adjustmentReasons.filter((v): v is string => typeof v === 'string'),
                AGITATION_ADJUSTMENT_REASON
              ]
            : ADJUSTMENT_REASONS
        )
      ],
      stageTargetsMinutes: Object.fromEntries(
        Object.entries(DEFAULT_TARGET_SECONDS).map(([state, seconds]) => [
          state,
          Number(configuredTargets?.[state]) || Math.round(seconds / 60)
        ])
      ),
      finalOperation:
        (source as { finalOperation?: 'PACKAGING' | 'TRANSFER' } | null)?.finalOperation ??
        'PACKAGING'
    };
  }

  private assertRollbackAdministrator(user: JwtUser) {
    if (user.role !== 'ADMIN')
      throw new ForbiddenException('Sólo un Administrador puede retroceder estados');
  }

  private async rollbackCandidate(tx: Prisma.TransactionClient, companyId: string, tankId: string) {
    const tank = await this.findTank(tx, companyId, tankId);
    if (!tank.activeLotId) {
      const history = await tx.tankStateHistory.findMany({
        where: { companyId, plantId: tank.plantId, tankId },
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }]
      });
      if (!history.length || history[0].endedAt || history[0].state !== tank.state)
        throw new ConflictException('No hay un paso anterior verificable para este tanque');
      if (history[0].lotId) {
        const latestLot = await tx.productionLot.findUnique({ where: { id: history[0].lotId } });
        if (latestLot?.cancelledAt)
          throw new ConflictException('El lote ya fue retrocedido hasta su inicio');
      }
      const effective: typeof history = [];
      for (const period of [...history].reverse()) {
        if (period.description?.startsWith('Retroceso administrativo:')) {
          if (effective.length < 2 || effective.at(-2)?.state !== period.state)
            throw new ConflictException('El historial de retrocesos del tanque es inconsistente');
          effective.pop();
        } else effective.push(period);
      }
      const current = effective.at(-1);
      const previous = effective.at(-2);
      if (!current || !previous || current.state !== tank.state)
        throw new ConflictException('No hay un paso anterior verificable para este tanque');
      if (tank.state === 'FUERA_DE_SERVICIO' && previous.state === 'VACIO')
        return {
          tank,
          target: TankState.VACIO,
          sample: null,
          decision: null,
          plannedPackaging: null,
          cancelLot: false,
          packagingOrders: [],
          transferOperations: [],
          reactivateLotId: null,
          reopenPackagingOrder: null,
          reopenTransferOperation: null,
          restoreServiceReason: null
        };
      if (tank.state === 'VACIO' && previous.state === 'FUERA_DE_SERVICIO')
        return {
          tank,
          target: TankState.FUERA_DE_SERVICIO,
          sample: null,
          decision: null,
          plannedPackaging: null,
          cancelLot: false,
          packagingOrders: [],
          transferOperations: [],
          reactivateLotId: null,
          reopenPackagingOrder: null,
          reopenTransferOperation: null,
          restoreServiceReason: previous.description ?? 'Fuera de servicio'
        };
      if (
        tank.state === 'VACIO' &&
        current.lotId &&
        previous.lotId === current.lotId &&
        ['ENVASANDO', 'TRASVASANDO', 'RECHAZADO'].includes(previous.state)
      ) {
        const lot = await tx.productionLot.findUnique({ where: { id: current.lotId } });
        if (!lot || lot.cancelledAt || !lot.finishedAt)
          throw new ConflictException('El cierre del lote no está vigente');
        const reopenPackagingOrder =
          previous.state === 'ENVASANDO'
            ? await tx.packagingOrder.findFirst({
                where: { lotId: lot.id, cancelledAt: null },
                orderBy: { startedAt: 'desc' }
              })
            : null;
        const reopenTransferOperation =
          previous.state === 'TRASVASANDO'
            ? await tx.transferOperation.findFirst({
                where: { lotId: lot.id, cancelledAt: null },
                orderBy: { startedAt: 'desc' }
              })
            : null;
        if (
          (previous.state === 'ENVASANDO' && !reopenPackagingOrder) ||
          (previous.state === 'TRASVASANDO' && !reopenTransferOperation)
        )
          throw new ConflictException('No existe la operación final del lote para reabrir');
        return {
          tank,
          target: previous.state,
          sample: null,
          decision: null,
          plannedPackaging: null,
          cancelLot: false,
          packagingOrders: [],
          transferOperations: [],
          reactivateLotId: lot.id,
          reopenPackagingOrder,
          reopenTransferOperation,
          restoreServiceReason: null
        };
      }
      throw new ConflictException(
        `El retroceso ${tank.state} → ${previous.state} no está habilitado`
      );
    }
    const periods = await tx.tankStateHistory.findMany({
      where: { companyId, plantId: tank.plantId, tankId, lotId: tank.activeLotId },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }]
    });
    if (!periods.length || periods[0].endedAt || periods[0].state !== tank.state)
      throw new ConflictException('No hay un paso anterior verificable para este lote');
    const effectivePeriods: typeof periods = [];
    for (const period of [...periods].reverse()) {
      if (period.description?.startsWith('Retroceso administrativo:')) {
        if (effectivePeriods.length < 2 || effectivePeriods.at(-2)?.state !== period.state)
          throw new ConflictException('El historial de retrocesos del lote es inconsistente');
        effectivePeriods.pop();
      } else {
        effectivePeriods.push(period);
      }
    }
    const currentPeriod = effectivePeriods.at(-1);
    const previousPeriod = effectivePeriods.at(-2);
    if (!currentPeriod || currentPeriod.state !== tank.state)
      throw new ConflictException('No hay un paso anterior verificable para este lote');
    if (!previousPeriod && currentPeriod.state === 'FABRICANDO') {
      return {
        tank,
        target: TankState.VACIO,
        sample: null,
        decision: null,
        plannedPackaging: null,
        cancelLot: true,
        packagingOrders: [],
        transferOperations: [],
        reactivateLotId: null,
        reopenPackagingOrder: null,
        reopenTransferOperation: null,
        restoreServiceReason: null
      };
    }
    if (!previousPeriod)
      throw new ConflictException('No hay un paso anterior verificable para este lote');
    const previous = previousPeriod.state;
    if (
      (tank.state === 'ENVASADO_PAUSADO' && previous === 'ENVASANDO') ||
      (tank.state === 'ENVASANDO' && previous === 'ENVASADO_PAUSADO')
    ) {
      await this.assertOpenPackagingOrder(tx, tank.id);
      return {
        tank,
        target: previous,
        sample: null,
        decision: null,
        plannedPackaging: null,
        cancelLot: false,
        packagingOrders: [],
        transferOperations: [],
        reactivateLotId: null,
        reopenPackagingOrder: null,
        reopenTransferOperation: null,
        restoreServiceReason: null
      };
    }
    if (tank.state === 'ENVASANDO' && previous === 'APROBADO') {
      const packagingOrders = await tx.packagingOrder.findMany({
        where: {
          companyId,
          plantId: tank.plantId,
          tankId,
          lotId: tank.activeLotId,
          cancelledAt: null
        },
        orderBy: { startedAt: 'desc' }
      });
      if (!packagingOrders.length)
        throw new ConflictException('No hay una OE vigente para revertir');
      return {
        tank,
        target: previous,
        sample: null,
        decision: null,
        plannedPackaging: null,
        cancelLot: false,
        packagingOrders,
        transferOperations: [],
        reactivateLotId: null,
        reopenPackagingOrder: null,
        reopenTransferOperation: null,
        restoreServiceReason: null
      };
    }
    if (tank.state === 'TRASVASANDO' && previous === 'APROBADO') {
      const transferOperations = await tx.transferOperation.findMany({
        where: {
          companyId,
          plantId: tank.plantId,
          tankId,
          lotId: tank.activeLotId,
          cancelledAt: null
        },
        orderBy: { startedAt: 'desc' }
      });
      if (!transferOperations.length)
        throw new ConflictException('No hay un trasvase vigente para revertir');
      return {
        tank,
        target: previous,
        sample: null,
        decision: null,
        plannedPackaging: null,
        cancelLot: false,
        packagingOrders: [],
        transferOperations,
        reactivateLotId: null,
        reopenPackagingOrder: null,
        reopenTransferOperation: null,
        restoreServiceReason: null
      };
    }
    const sample = await tx.laboratorySample.findFirst({
      where: {
        companyId,
        plantId: tank.plantId,
        tankId,
        lotId: tank.activeLotId,
        cancelledAt: null
      },
      orderBy: { iteration: 'desc' }
    });
    if (tank.state === 'LABORATORIO' && (previous === 'FABRICANDO' || previous === 'AJUSTE')) {
      if (!sample) throw new ConflictException('No hay una muestra vigente para esta etapa');
      if (sample.qualityDecisionId)
        throw new ConflictException('La muestra tiene una decisión de calidad vinculada');
      return {
        tank,
        target: previous,
        sample,
        decision: null,
        plannedPackaging: null,
        cancelLot: false,
        packagingOrders: [],
        transferOperations: [],
        reactivateLotId: null,
        reopenPackagingOrder: null,
        reopenTransferOperation: null,
        restoreServiceReason: null
      };
    }
    if (
      previous === 'LABORATORIO' &&
      (tank.state === 'APROBADO' || tank.state === 'AJUSTE' || tank.state === 'RECHAZADO')
    ) {
      if (sample && (sample.status !== 'RESOLVED' || !sample.qualityDecisionId))
        throw new ConflictException('No hay una decisión de calidad vigente para revertir');
      if (!sample) {
        const sampleCount = await tx.laboratorySample.count({
          where: { companyId, plantId: tank.plantId, tankId, lotId: tank.activeLotId }
        });
        if (sampleCount)
          throw new ConflictException('No hay una decisión de calidad vigente para revertir');
      }
      const decision = await tx.qualityDecision.findFirst({
        where: sample
          ? {
              id: sample.qualityDecisionId!,
              companyId,
              plantId: tank.plantId,
              lotId: tank.activeLotId,
              cancelledAt: null
            }
          : {
              companyId,
              plantId: tank.plantId,
              lotId: tank.activeLotId,
              cancelledAt: null,
              createdAt: { gte: previousPeriod.startedAt, lte: currentPeriod.startedAt }
            },
        orderBy: { createdAt: 'desc' }
      });
      if (!decision) throw new ConflictException('La decisión de calidad ya fue anulada');
      if (
        (tank.state === 'APROBADO' && decision.result !== 'APROBADO') ||
        (tank.state === 'AJUSTE' && decision.result !== 'AJUSTE') ||
        (tank.state === 'RECHAZADO' && !decision.result.startsWith('RECHAZADO'))
      )
        throw new ConflictException('La decisión de calidad no coincide con el estado actual');
      const plannedPackaging =
        tank.state === 'APROBADO'
          ? await tx.packagingPlanningCard.findFirst({
              where: { companyId, plantId: tank.plantId, tankId }
            })
          : null;
      const laterPackaging = await tx.packagingOrder.count({
        where: {
          lotId: tank.activeLotId,
          cancelledAt: null,
          startedAt: { gte: decision.createdAt }
        }
      });
      const laterTransfers = await tx.transferOperation.count({
        where: {
          lotId: tank.activeLotId,
          cancelledAt: null,
          startedAt: { gte: decision.createdAt }
        }
      });
      if (laterPackaging || laterTransfers)
        throw new ConflictException('El lote ya registra envasado o trasvase posterior');
      return {
        tank,
        target: previous,
        sample,
        decision,
        plannedPackaging,
        cancelLot: false,
        packagingOrders: [],
        transferOperations: [],
        reactivateLotId: null,
        reopenPackagingOrder: null,
        reopenTransferOperation: null,
        restoreServiceReason: null
      };
    }
    throw new ConflictException(`El retroceso ${tank.state} → ${previous} no está habilitado`);
  }

  async rollbackPreview(companyId: string, tankId: string, user: JwtUser) {
    this.assertRollbackAdministrator(user);
    const candidate = await this.prisma.$transaction((tx) =>
      this.rollbackCandidate(tx, companyId, tankId)
    );
    return {
      from: candidate.tank.state,
      to: candidate.target,
      version: candidate.tank.version,
      affectedRecord:
        (candidate.reactivateLotId
          ? 'Cierre del lote; se reabrirá la operación final si corresponde'
          : candidate.packagingOrders.length
            ? 'Órdenes de envasado del lote'
            : candidate.transferOperations.length
              ? 'Operación de trasvase del lote'
              : candidate.tank.state === 'FUERA_DE_SERVICIO' ||
                  candidate.target === 'FUERA_DE_SERVICIO'
                ? 'Estado de servicio del tanque'
                : candidate.tank.state === 'ENVASADO_PAUSADO' ||
                    candidate.target === 'ENVASADO_PAUSADO'
                  ? 'Pausa de la OE activa'
                  : candidate.cancelLot
                    ? 'Lote de fabricación'
                    : candidate.decision
                      ? candidate.sample
                        ? 'Decisión de calidad'
                        : 'Decisión de calidad; se solicitará una muestra nueva'
                      : 'Muestra de laboratorio') +
        (candidate.plannedPackaging ? '; se quitará la tarjeta de planificación de envasado' : '')
    };
  }

  async rollbackState(companyId: string, tankId: string, user: JwtUser, dto: RollbackTankStateDto) {
    this.assertRollbackAdministrator(user);
    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException('Indicá el motivo del retroceso');
    return this.prisma.$transaction(
      async (tx) => {
        const {
          tank,
          target,
          sample,
          decision,
          plannedPackaging,
          cancelLot,
          packagingOrders,
          transferOperations,
          reactivateLotId,
          reopenPackagingOrder,
          reopenTransferOperation,
          restoreServiceReason
        } = await this.rollbackCandidate(tx, companyId, tankId);
        if (tank.version !== dto.version)
          throw new ConflictException('El tanque cambió. Actualizá la pantalla.');
        if (target === 'ENVASANDO') await this.assertLatexPackagingSlot(tx, tank.plantId, tank.id);
        const cancelledAt = new Date();
        if (reactivateLotId) {
          await tx.productionLot.update({
            where: { id: reactivateLotId },
            data: { finishedAt: null }
          });
          if (reopenPackagingOrder) {
            await this.audit(
              tx,
              companyId,
              user,
              tank.id,
              reactivateLotId,
              'ROLLBACK',
              'PackagingOrder',
              reopenPackagingOrder.id,
              reopenPackagingOrder,
              null,
              reason
            );
            await tx.packagingOrder.update({
              where: { id: reopenPackagingOrder.id },
              data: {
                finishedAt: null,
                finishedByUserId: null,
                durationSeconds: null,
                producedKg: null,
                wasteKg: null,
                producedUnits: null
              }
            });
          }
          if (reopenTransferOperation) {
            await this.audit(
              tx,
              companyId,
              user,
              tank.id,
              reactivateLotId,
              'ROLLBACK',
              'TransferOperation',
              reopenTransferOperation.id,
              reopenTransferOperation,
              null,
              reason
            );
            await tx.transferOperation.update({
              where: { id: reopenTransferOperation.id },
              data: { finishedAt: null, finishedByUserId: null, durationSeconds: null }
            });
          }
        }
        for (const order of packagingOrders) {
          await tx.packagingOrder.update({ where: { id: order.id }, data: { cancelledAt } });
          await this.audit(
            tx,
            companyId,
            user,
            tank.id,
            tank.activeLotId,
            'ROLLBACK',
            'PackagingOrder',
            order.id,
            order,
            { cancelledAt },
            reason
          );
        }
        for (const operation of transferOperations) {
          await tx.transferOperation.update({ where: { id: operation.id }, data: { cancelledAt } });
          await this.audit(
            tx,
            companyId,
            user,
            tank.id,
            tank.activeLotId,
            'ROLLBACK',
            'TransferOperation',
            operation.id,
            operation,
            { cancelledAt },
            reason
          );
        }
        if (plannedPackaging) {
          await tx.packagingPlanningCard.delete({ where: { id: plannedPackaging.id } });
          await tx.packagingPlanningCard.updateMany({
            where: { plantId: tank.plantId, position: { gt: plannedPackaging.position } },
            data: { position: { decrement: 1 } }
          });
          await this.audit(
            tx,
            companyId,
            user,
            tank.id,
            tank.activeLotId,
            'DELETE',
            'PackagingPlanningCard',
            plannedPackaging.id,
            plannedPackaging,
            null,
            `Tarjeta quitada por retroceso administrativo: ${reason}`
          );
        }
        if (decision) {
          await tx.qualityDecision.update({ where: { id: decision.id }, data: { cancelledAt } });
          if (sample) {
            await tx.laboratorySample.update({
              where: { id: sample.id },
              data: {
                status: 'ANALYZING',
                resolvedAt: null,
                qualityDecisionId: null
              }
            });
          } else {
            await tx.laboratorySample.create({
              data: {
                companyId,
                plantId: tank.plantId,
                tankId,
                lotId: tank.activeLotId!,
                iteration: 1,
                requestedByUserId: user.sub
              }
            });
          }
          await tx.productionLot.update({
            where: { id: tank.activeLotId! },
            data: { specificWeight: null }
          });
        } else if (sample) {
          await tx.laboratorySample.update({ where: { id: sample!.id }, data: { cancelledAt } });
        } else if (cancelLot) {
          await tx.productionLot.update({
            where: { id: tank.activeLotId! },
            data: { cancelledAt }
          });
        }
        await this.move(
          tx,
          tank,
          target,
          user,
          tank.activeLotId ?? reactivateLotId,
          `Retroceso administrativo: ${reason}`,
          target === 'FUERA_DE_SERVICIO'
            ? { serviceReason: restoreServiceReason, serviceNotes: null }
            : tank.state === 'FUERA_DE_SERVICIO'
              ? { serviceReason: null, serviceNotes: null }
              : {}
        );
        if (cancelLot)
          await tx.tank.update({ where: { id: tank.id }, data: { activeLotId: null } });
        if (reactivateLotId)
          await tx.tank.update({ where: { id: tank.id }, data: { activeLotId: reactivateLotId } });
        await this.audit(
          tx,
          companyId,
          user,
          tank.id,
          tank.activeLotId ?? reactivateLotId,
          'ROLLBACK',
          'Tank',
          tank.id,
          { state: tank.state, sampleId: sample?.id ?? null, decisionId: decision?.id ?? null },
          {
            state: target,
            sampleCancelled: !decision && !!sample,
            decisionCancelled: !!decision,
            lotCancelled: cancelLot,
            newSampleRequested: !!decision && !sample,
            packagingPlanningRemoved: !!plannedPackaging,
            packagingOrdersCancelled: packagingOrders.length,
            transferOperationsCancelled: transferOperations.length,
            lotReactivated: !!reactivateLotId
          },
          reason
        );
        await this.notifications.notifyTankAction(tx, {
          companyId,
          actorUserId: user.sub,
          tankId: tank.id,
          targetSector:
            target === 'LABORATORIO'
              ? 'LABORATORIO'
              : ['APROBADO', 'ENVASANDO', 'TRASVASANDO'].includes(target)
                ? 'ENVASADO'
                : 'FABRICACION',
          title: 'Estado retrocedido por Administración',
          message: `${tank.name}: el estado volvió a ${target}. Motivo: ${reason}`
        });
        return { ok: true, state: target };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }
    );
  }

  private async assertLatexPackagingSlot(
    tx: Prisma.TransactionClient,
    plantId: string,
    tankId: string
  ) {
    const plant = await tx.plant.findUnique({ where: { id: plantId }, select: { code: true } });
    if (plant?.code !== 'LATEX') return;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('LATEX_PACKAGING'), hashtext(${plantId}))::text AS lock`;
    const active = await tx.tank.findFirst({
      where: { plantId, state: 'ENVASANDO', id: { not: tankId } },
      select: { id: true }
    });
    if (active) throw new ConflictException('La línea Devree ya está envasando otro tanque.');
  }

  private async transition(
    companyId: string,
    tankId: string,
    user: JwtUser,
    dto: VersionedActionDto,
    from: TankState[],
    to: TankState,
    description?: string
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const tank = await this.findTank(tx, companyId, tankId);
        if (!from.includes(tank.state))
          throw new ConflictException(`La transición ${tank.state} → ${to} no está permitida`);
        if (tank.version !== dto.version)
          throw new ConflictException('El tanque cambió. Actualizá la pantalla.');
        await this.move(tx, tank, to, user, tank.activeLotId, description);
        return { ok: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  private findTank(tx: Prisma.TransactionClient, companyId: string, id: string) {
    return tx.tank.findFirst({ where: { id, companyId } }).then((tank) => {
      if (!tank) throw new NotFoundException('Tanque no encontrado');
      return tank;
    });
  }

  private async assertPlanningPlantAccess(companyId: string, userId: string, plantCode: string) {
    const plant = await this.assertPlantAccess(companyId, userId, plantCode);
    if (plant.code !== 'LATEX') {
      throw new BadRequestException('La pizarra está habilitada únicamente para la planta Látex');
    }
    return plant;
  }

  private assertPackagingPlanningTankState(state: TankState) {
    if (state === TankState.ENVASANDO || state === TankState.ENVASADO_PAUSADO) {
      throw new ConflictException('El tanque ya tiene una OE activa');
    }
    if (state === TankState.VACIO || state === TankState.FUERA_DE_SERVICIO) {
      throw new ConflictException(
        'Los tanques vacíos o fuera de servicio no se pueden planificar para envasado'
      );
    }
  }

  private async persistPlanningOrder(
    tx: Prisma.TransactionClient,
    tankId: string,
    cardIds: string[]
  ) {
    await Promise.all(
      cardIds.map((id, position) =>
        tx.planningCard.update({ where: { id }, data: { tankId, position } })
      )
    );
  }

  private async persistPackagingPlanningOrder(
    tx: Prisma.TransactionClient,
    cards: Array<{ id: string; dispenser: string }>
  ) {
    await Promise.all(
      cards.map((card, position) =>
        tx.packagingPlanningCard.update({
          where: { id: card.id },
          data: { dispenser: card.dispenser, position }
        })
      )
    );
  }

  private assertTank(
    tank: { state: TankState; version: number },
    state: TankState,
    version: number
  ) {
    if (tank.version !== version)
      throw new ConflictException('El tanque cambió. Actualizá la pantalla.');
    if (tank.state !== state)
      throw new ConflictException(
        `La acción requiere estado ${state}; el tanque está ${tank.state}`
      );
  }

  private async move(
    tx: Prisma.TransactionClient,
    tank: {
      id: string;
      companyId: string;
      plantId: string;
      state: TankState;
      version: number;
      scaleKey?: string | null;
    },
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
    if (changed.count !== 1)
      throw new ConflictException('El tanque cambió. Actualizá la pantalla.');
    const changedAt = new Date();
    const openPeriod = await tx.tankStateHistory.findFirst({
      where: { tankId: tank.id, endedAt: null },
      orderBy: { startedAt: 'desc' }
    });
    if (openPeriod) {
      await tx.tankStateHistory.update({
        where: { id: openPeriod.id },
        data: {
          endedAt: changedAt,
          durationSeconds: Math.max(
            0,
            Math.floor((changedAt.getTime() - openPeriod.startedAt.getTime()) / 1000)
          )
        }
      });
    }
    const weight = tank.scaleKey
      ? this.weights.get(`${tank.plantId}:${tank.scaleKey}`)?.grossKg
      : undefined;
    const configuredTargets = await this.targetSeconds(tank.companyId, tx, tank.plantId);
    await tx.tankStateHistory.create({
      data: {
        companyId: tank.companyId,
        plantId: tank.plantId,
        tankId: tank.id,
        lotId,
        state,
        description,
        userId: user.sub,
        weightKg: weight,
        targetSeconds: configuredTargets[state]
      }
    });
    await this.audit(
      tx,
      tank.companyId,
      user,
      tank.id,
      lotId,
      'STATUS_CHANGE',
      'Tank',
      tank.id,
      { state: tank.state },
      { state },
      description
    );
  }

  private async closePackaging(
    tx: Prisma.TransactionClient,
    tankId: string,
    userId: string,
    metrics?: { producedKg?: number; wasteKg?: number; producedUnits?: number }
  ) {
    const current = await tx.packagingOrder.findFirst({
      where: { tankId, finishedAt: null, cancelledAt: null },
      orderBy: { startedAt: 'desc' }
    });
    if (!current) throw new ConflictException('No existe una OE abierta');
    const finishedAt = new Date();
    await tx.packagingOrder.update({
      where: { id: current.id },
      data: {
        finishedAt,
        finishedByUserId: userId,
        durationSeconds: Math.max(
          0,
          Math.floor((finishedAt.getTime() - current.startedAt.getTime()) / 1000)
        ),
        producedKg: metrics?.producedKg,
        wasteKg: metrics?.wasteKg,
        producedUnits: metrics?.producedUnits
      }
    });
  }

  private async audit(
    tx: Prisma.TransactionClient,
    companyId: string,
    user: JwtUser,
    tankId: string | null,
    lotId: string | null,
    action: string,
    entityType: string,
    entityId: string,
    before: unknown,
    after: unknown,
    reason: string | null | undefined
  ) {
    const plantId = tankId
      ? (await tx.tank.findUniqueOrThrow({ where: { id: tankId }, select: { plantId: true } }))
          .plantId
      : lotId
        ? (
            await tx.productionLot.findUniqueOrThrow({
              where: { id: lotId },
              select: { plantId: true }
            })
          ).plantId
        : (
            await tx.plant.findFirstOrThrow({
              where: { companyId, code: 'LATEX' },
              select: { id: true }
            })
          ).id;
    return tx.plantAuditLog.create({
      data: {
        companyId,
        plantId,
        userId: user.sub,
        tankId,
        lotId,
        action,
        entityType,
        entityId,
        reason,
        before: before === null ? Prisma.JsonNull : (before as Prisma.InputJsonValue),
        after: after === null ? Prisma.JsonNull : (after as Prisma.InputJsonValue)
      }
    });
  }

  private plantDayBounds(date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException('Fecha inválida');
    const localMidnightAsUtc = Date.parse(`${date}T00:00:00.000Z`);
    if (
      Number.isNaN(localMidnightAsUtc) ||
      new Date(localMidnightAsUtc).toISOString().slice(0, 10) !== date
    )
      throw new BadRequestException('Fecha inválida');
    const start = new Date(localMidnightAsUtc + BUENOS_AIRES_OFFSET_MS);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start, end };
  }

  private async targetSeconds(
    companyId: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
    plantId?: string
  ) {
    const record = plantId
      ? await tx.plant.findUnique({ where: { id: plantId }, select: { settings: true } })
      : await tx.company.findUnique({ where: { id: companyId }, select: { settings: true } });
    const settings = (record?.settings ?? {}) as Record<string, unknown>;
    const configured = settings.plantStageTargetsMinutes as Record<string, unknown> | undefined;
    return Object.fromEntries(
      Object.entries(DEFAULT_TARGET_SECONDS).map(([state, fallback]) => {
        const minutes = Number(configured?.[state]);
        return [
          state,
          Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : fallback
        ];
      })
    ) as Partial<Record<TankState, number>>;
  }

  private async assertFinalOperation(
    tx: Prisma.TransactionClient,
    plantId: string,
    expected: 'PACKAGING' | 'TRANSFER'
  ) {
    const plant = await tx.plant.findUniqueOrThrow({
      where: { id: plantId },
      select: { finalOperation: true }
    });
    if (plant.finalOperation !== expected)
      throw new ConflictException(
        expected === 'TRANSFER'
          ? 'Sólo Slurry admite trasvase'
          : 'La planta no admite órdenes de envasado'
      );
  }

  private escapeXml(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  private managementPdf(
    report: {
      plant?: { code: string; name: string; finalOperation: string };
      generatedAt: string;
      isLive?: boolean;
      snapshotAt?: string;
      onlineScales: number | null;
      completedLots: unknown[];
      packaging: {
        producedKg: number;
        wasteKg: number;
        producedUnits: number;
        completedOrders: number;
      };
      quality: Record<string, number>;
      laboratory?: {
        awaitingReceipt: number;
        inAnalysis: number;
        received: number;
        resolved: number;
        averageReceiptSeconds: number | null;
        averageAnalysisSeconds: number | null;
      };
      tanks: Array<{
        name: string;
        state: string;
        stateElapsedSeconds: number | null;
        activeLot: null | { manufacturingOrder: string; materialCode: string; description: string };
        telemetry: { grossKg: number | null; online: boolean | null };
      }>;
      attention: unknown[];
    },
    date: string
  ) {
    const commands: string[] = [];
    const clean = (value: string, max = 160) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\x20-\x7E]/g, '')
        .slice(0, max)
        .replace(/([\\()])/g, '\\$1');
    const fill = (x: number, y: number, width: number, height: number, color: string) =>
      commands.push(`${color} rg ${x} ${y} ${width} ${height} re f`);
    const stroke = (x: number, y: number, width: number, height: number, color: string) =>
      commands.push(`${color} RG 0.7 w ${x} ${y} ${width} ${height} re S`);
    const text = (
      value: string,
      x: number,
      y: number,
      size = 9,
      bold = false,
      color = '0.18 0.23 0.28'
    ) => {
      commands.push(
        `BT ${color} rg /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td (${clean(value)}) Tj ET`
      );
    };
    const minutes = (seconds: number | null) => {
      const total = Math.max(0, Math.round((seconds ?? 0) / 60));
      return total >= 60 ? `${Math.floor(total / 60)} h ${total % 60} min` : `${total} min`;
    };
    const localDate = new Date(`${date}T12:00:00-03:00`).toLocaleDateString('es-AR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Argentina/Buenos_Aires'
    });
    const generated = new Date(report.generatedAt).toLocaleString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires'
    });

    fill(0, 0, 842, 595, '0.965 0.975 0.982');
    fill(0, 520, 842, 75, '0.035 0.086 0.125');
    fill(0, 516, 842, 4, '0.020 0.620 0.850');
    text('DISAL', 36, 559, 23, true, '1 1 1');
    text(
      `PLANTA ${report.plant?.name ?? 'LATEX'}`.toUpperCase(),
      37,
      543,
      8,
      true,
      '0.36 0.80 0.97'
    );
    text('RESUMEN DIARIO DE PRODUCCION', 220, 560, 18, true, '1 1 1');
    text(localDate.toUpperCase(), 220, 541, 10, false, '0.75 0.83 0.89');
    text(
      report.isLive ? 'ESTADO EN VIVO' : 'CIERRE DEL DIA SELECCIONADO',
      665,
      552,
      8,
      true,
      report.isLive ? '0.25 0.84 0.48' : '0.98 0.72 0.20'
    );

    const incidents =
      (report.quality.AJUSTE ?? 0) +
      (report.quality.RECHAZADO_RECUPERAR ?? 0) +
      (report.quality.RECHAZADO_DESTRUIR ?? 0);
    const cards = [
      ['LOTES FINALIZADOS', String(report.completedLots.length), '0.020 0.620 0.850'],
      [
        'KG ENVASADOS',
        Math.round(report.packaging.producedKg).toLocaleString('es-AR'),
        '0.18 0.62 0.30'
      ],
      [
        'MERMA',
        `${Math.round(report.packaging.wasteKg).toLocaleString('es-AR')} kg`,
        '0.92 0.54 0.14'
      ],
      ['AJUSTES / RECHAZOS', String(incidents), incidents ? '0.82 0.20 0.22' : '0.18 0.62 0.30']
    ];
    cards.forEach(([label, value, color], index) => {
      const x = 36 + index * 196;
      fill(x, 444, 180, 56, '1 1 1');
      stroke(x, 444, 180, 56, '0.82 0.86 0.89');
      fill(x, 444, 5, 56, color);
      text(label, x + 16, 480, 7, true, '0.39 0.47 0.54');
      text(value, x + 16, 455, 18, true, '0.08 0.14 0.19');
    });

    fill(36, 407, 770, 25, '0.08 0.16 0.22');
    const columns = [42, 102, 176, 258, 436, 532, 626, 724];
    ['EQUIPO', 'OF', 'MATERIAL', 'PRODUCTO', 'ESTADO', 'DESDE', 'DURACION', 'PESO'].forEach(
      (header, index) => text(header, columns[index], 416, 7, true, '0.72 0.88 0.96')
    );
    report.tanks.slice(0, 9).forEach((tank, index) => {
      const y = 378 - index * 33;
      fill(36, y - 9, 770, 32, index % 2 ? '0.945 0.960 0.970' : '1 1 1');
      text(tank.name, columns[0], y, 9, true);
      text(tank.activeLot?.manufacturingOrder ?? '-', columns[1], y, 8, true);
      text(tank.activeLot?.materialCode ?? '-', columns[2], y, 8);
      text(
        tank.activeLot?.description ?? 'Sin OF activa',
        columns[3],
        y,
        8,
        false,
        '0.18 0.23 0.28'
      );
      text(
        tank.state.replaceAll('_', ' '),
        columns[4],
        y,
        7,
        true,
        tank.state === 'RECHAZADO' ? '0.78 0.13 0.16' : '0.06 0.43 0.63'
      );
      text(
        report.snapshotAt
          ? new Date(
              tank.stateElapsedSeconds === null
                ? report.snapshotAt
                : new Date(report.snapshotAt).getTime() - tank.stateElapsedSeconds * 1000
            ).toLocaleTimeString('es-AR', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'America/Argentina/Buenos_Aires'
            })
          : '-',
        columns[5],
        y,
        8
      );
      text(minutes(tank.stateElapsedSeconds), columns[6], y, 8);
      text(
        tank.telemetry.grossKg === null
          ? '-'
          : `${Math.round(tank.telemetry.grossKg).toLocaleString('es-AR')} kg`,
        columns[7],
        y,
        8,
        true
      );
    });

    if (report.laboratory) {
      text(
        `LAB: ${report.laboratory.awaitingReceipt} esperando muestra | ${report.laboratory.inAnalysis} en analisis | Promedio recepcion ${minutes(report.laboratory.averageReceiptSeconds)} | Promedio analisis ${minutes(report.laboratory.averageAnalysisSeconds)}`,
        40,
        91,
        7,
        true,
        '0.06 0.43 0.63'
      );
    }

    fill(36, 54, 770, 28, report.attention.length ? '0.995 0.925 0.925' : '0.910 0.975 0.930');
    text(
      report.attention.length
        ? `${report.attention.length} situaciones requieren seguimiento.`
        : 'Sin situaciones criticas para el periodo seleccionado.',
      48,
      64,
      9,
      true,
      report.attention.length ? '0.70 0.13 0.16' : '0.12 0.49 0.25'
    );
    text(
      `Generado: ${generated}  |  Fuente: Sistema de produccion DISAL  |  Documento para reunion diaria`,
      36,
      27,
      7,
      false,
      '0.43 0.49 0.54'
    );
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
    objects.forEach((object, index) => {
      offsets.push(Buffer.byteLength(pdf));
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xref = Buffer.byteLength(pdf);
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
      .slice(1)
      .map((offset) => `${String(offset).padStart(10, '0')} 00000 n `)
      .join('\n')}\n`;
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(pdf, 'ascii');
  }
}
