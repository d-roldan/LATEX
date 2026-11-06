import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JwtUser } from '../../common/auth/jwt-user.interface';
import { PrismaService } from '../../prisma/prisma.service';

export type ReportingFilters = { month?: string; from?: string; to?: string; plantIds?: string };
type Filters = ReportingFilters;
type OrderFilters = Filters & { offset?: string; limit?: string };

@Injectable()
export class ReportingService {
  constructor(private readonly prisma: PrismaService) {}

  async scope(user: JwtUser, plantIds?: string) {
    const plants = await this.prisma.plant.findMany({
      where: {
        companyId: user.companyId,
        isActive: true,
        userAccesses: { some: { userId: user.sub } }
      },
      select: { id: true, code: true, name: true, finalOperation: true },
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }]
    });
    if (plantIds === undefined || plantIds === '') return plants;
    if (plantIds === 'none') return [];
    const requested = plantIds.split(',').map((value) => value.trim());
    if (
      requested.length > 30 ||
      requested.some((value) => !/^[a-z0-9_-]{1,64}$/i.test(value)) ||
      new Set(requested).size !== requested.length
    )
      throw new BadRequestException('Selección de plantas inválida');
    const allowed = new Set(plants.map((plant) => plant.id));
    if (requested.some((id) => !allowed.has(id)))
      throw new NotFoundException('Planta no encontrada o no autorizada');
    return plants.filter((plant) => requested.includes(plant.id));
  }

  period(month?: string, from?: string, to?: string) {
    const current = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit'
    }).formatToParts(new Date());
    const selected =
      month ??
      `${current.find((part) => part.type === 'year')?.value}-${current.find((part) => part.type === 'month')?.value}`;
    if (from !== undefined || to !== undefined) {
      if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
        throw new BadRequestException('Rango de fechas inválido');
      const start = this.argentineMidnight(from);
      const last = this.argentineMidnight(to);
      if (last < start || (last.getTime() - start.getTime()) / 86_400_000 > 365)
        throw new BadRequestException('El rango debe tener hasta 366 días y estar ordenado');
      const [endYear, endMonth, endDay] = to.split('-').map(Number);
      const nextDay = new Date(Date.UTC(endYear, endMonth - 1, endDay + 1));
      const end = this.argentineMidnight(nextDay.toISOString().slice(0, 10));
      return {
        month: to.slice(0, 7),
        label: `${from.split('-').reverse().join('/')}–${to.split('-').reverse().join('/')}`,
        from,
        to,
        startInclusive: start.toISOString(),
        endExclusive: end.toISOString(),
        timeZone: 'America/Argentina/Buenos_Aires',
        start,
        end
      };
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(selected)) throw new BadRequestException('Mes inválido');
    const [year, monthNumber] = selected.split('-').map(Number);
    if (year < 2000 || year > 2100) throw new BadRequestException('Mes fuera de rango');
    const start = this.argentineMidnight(`${selected}-01`);
    const nextMonth = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
    const end = this.argentineMidnight(nextMonth);
    return {
      month: selected,
      label: selected,
      from: null,
      to: null,
      startInclusive: start.toISOString(),
      endExclusive: end.toISOString(),
      timeZone: 'America/Argentina/Buenos_Aires',
      start,
      end
    };
  }

  private argentineMidnight(value: string) {
    const [year, month, day] = value.split('-').map(Number);
    const calendar = new Date(Date.UTC(year, month - 1, day));
    if (year < 2000 || year > 2100 || calendar.toISOString().slice(0, 10) !== value)
      throw new BadRequestException('Fecha fuera de rango o inexistente');
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Argentina/Buenos_Aires',
      timeZoneName: 'shortOffset'
    }).formatToParts(new Date(Date.UTC(year, month - 1, day, 12)));
    const offset = parts.find((part) => part.type === 'timeZoneName')?.value;
    const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(offset ?? '');
    if (!match) throw new BadRequestException('Zona horaria no disponible');
    const minutes = (Number(match[2]) * 60 + Number(match[3] ?? 0)) * (match[1] === '+' ? 1 : -1);
    return new Date(Date.UTC(year, month - 1, day) - minutes * 60_000);
  }

  private pagination(offset?: string, limit?: string) {
    const skip = Number(offset ?? 0);
    const take = Number(limit ?? 50);
    if (!Number.isSafeInteger(skip) || skip < 0 || skip > 100_000)
      throw new BadRequestException('Desplazamiento inválido');
    if (!Number.isSafeInteger(take) || take < 1 || take > 100)
      throw new BadRequestException('Límite inválido');
    return { skip, take };
  }

  async capabilities(user: JwtUser) {
    const plants = await this.scope(user);
    const ids = plants.map((plant) => plant.id);
    const [lots, samples, packaging, states] = await Promise.all([
      this.prisma.productionLot.groupBy({
        by: ['plantId'],
        where: { companyId: user.companyId, plantId: { in: ids }, cancelledAt: null },
        _count: { _all: true }
      }),
      this.prisma.laboratorySample.groupBy({
        by: ['plantId'],
        where: { companyId: user.companyId, plantId: { in: ids }, cancelledAt: null },
        _count: { _all: true }
      }),
      this.prisma.packagingOrder.groupBy({
        by: ['plantId'],
        where: { companyId: user.companyId, plantId: { in: ids }, cancelledAt: null },
        _count: { _all: true }
      }),
      this.prisma.tankStateHistory.groupBy({
        by: ['plantId'],
        where: { companyId: user.companyId, plantId: { in: ids } },
        _count: { _all: true }
      })
    ]);
    const count = (groups: Array<{ plantId: string; _count: { _all: number } }>, id: string) =>
      groups.find((group) => group.plantId === id)?._count._all ?? 0;
    return {
      generatedAt: new Date().toISOString(),
      plants: plants.map((plant) => ({
        ...plant,
        observedRecords: {
          lots: count(lots, plant.id),
          laboratorySamples: count(samples, plant.id),
          packagingOrders: count(packaging, plant.id),
          stateEvents: count(states, plant.id)
        }
      }))
    };
  }

  async overview(user: JwtUser, filters: Filters) {
    const period = this.period(filters.month, filters.from, filters.to);
    const plants = await this.scope(user, filters.plantIds);
    const plantId = { in: plants.map((plant) => plant.id) };
    const base = { companyId: user.companyId, plantId };
    const [startedLots, finishedLots, decisions, adjustments, receivedSamples] =
      await this.prisma.$transaction(
        [
          this.prisma.productionLot.count({
            where: { ...base, cancelledAt: null, startedAt: { gte: period.start, lt: period.end } }
          }),
          this.prisma.productionLot.count({
            where: { ...base, cancelledAt: null, finishedAt: { gte: period.start, lt: period.end } }
          }),
          this.prisma.qualityDecision.count({
            where: { ...base, cancelledAt: null, createdAt: { gte: period.start, lt: period.end } }
          }),
          this.prisma.qualityDecision.count({
            where: {
              ...base,
              cancelledAt: null,
              result: 'AJUSTE',
              createdAt: { gte: period.start, lt: period.end }
            }
          }),
          this.prisma.laboratorySample.count({
            where: { ...base, cancelledAt: null, receivedAt: { gte: period.start, lt: period.end } }
          })
        ],
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }
      );
    return {
      datasetVersion: 'reporting-overview-v1',
      metricVersion: '2026-11-05',
      generatedAt: new Date().toISOString(),
      period: {
        month: period.month,
        label: period.label,
        from: period.from,
        to: period.to,
        startInclusive: period.startInclusive,
        endExclusive: period.endExclusive,
        timeZone: period.timeZone
      },
      includedPlants: plants.map(({ id, code, name }) => ({ id, code, name })),
      totals: { startedLots, finishedLots, decisions, adjustments, receivedSamples },
      warnings: [
        'Las poblaciones del período usan fechas distintas; no deben sumarse entre sí.',
        'La cobertura histórica de muestras y decisiones debe validarse antes de interpretar tasas.'
      ]
    };
  }

  async orders(user: JwtUser, filters: OrderFilters) {
    const period = this.period(filters.month, filters.from, filters.to);
    const plants = await this.scope(user, filters.plantIds);
    const { skip, take } = this.pagination(filters.offset, filters.limit);
    const where = {
      companyId: user.companyId,
      plantId: { in: plants.map((plant) => plant.id) },
      cancelledAt: null,
      startedAt: { gte: period.start, lt: period.end }
    };
    const [total, rows] = await this.prisma.$transaction(
      [
        this.prisma.productionLot.count({ where }),
        this.prisma.productionLot.findMany({
          where,
          select: {
            id: true,
            plantId: true,
            manufacturingOrder: true,
            materialCode: true,
            description: true,
            plannedQuantityKg: true,
            startedAt: true,
            finishedAt: true,
            tank: { select: { number: true, name: true } }
          },
          orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
          skip,
          take
        })
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }
    );
    return {
      datasetVersion: 'reporting-orders-v1',
      period: {
        month: period.month,
        label: period.label,
        from: period.from,
        to: period.to,
        startInclusive: period.startInclusive,
        endExclusive: period.endExclusive,
        timeZone: period.timeZone
      },
      includedPlants: plants.map(({ id, code, name }) => ({ id, code, name })),
      total,
      offset: skip,
      limit: take,
      rows: rows.map((row) => ({
        ...row,
        plannedQuantityKg: row.plannedQuantityKg?.toString() ?? null
      }))
    };
  }
}
