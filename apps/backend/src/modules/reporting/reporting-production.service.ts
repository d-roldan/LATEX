import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JwtUser } from '../../common/auth/jwt-user.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportingService } from './reporting.service';

@Injectable()
export class ReportingProductionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reporting: ReportingService
  ) {}

  async dashboard(
    user: JwtUser,
    filters: { month?: string; from?: string; to?: string; plantIds?: string }
  ) {
    const period = this.reporting.period(filters.month, filters.from, filters.to);
    const plants = await this.reporting.scope(user, filters.plantIds);
    const ids = plants.map((plant) => plant.id);
    const periodInfo = {
      month: period.month,
      label: period.label,
      from: period.from,
      to: period.to,
      startInclusive: period.startInclusive,
      endExclusive: period.endExclusive,
      timeZone: period.timeZone
    };
    const empty = {
      datasetVersion: 'reporting-production-v1',
      period: periodInfo,
      includedPlants: plants.map(({ id, code, name }) => ({ id, code, name })),
      totals: {
        startedLots: 0,
        finishedLots: 0,
        plannedKgStarted: null as string | null,
        plannedKgCoverage: { withValue: 0, total: 0 },
        manufacturedKg: null as string | null,
        manufacturingClosedIntervals: 0,
        manufacturingAverageSeconds: null as number | null,
        packagingFinishedOrders: 0,
        packagedKg: null as string | null,
        packagedKgCoverage: { withValue: 0, total: 0 },
        packagedUnits: null as number | null,
        packagedUnitsCoverage: { withValue: 0, total: 0 },
        packagingWasteKg: null as string | null,
        packagingWasteCoverage: { withValue: 0, total: 0 }
      },
      byPlant: [] as Array<{
        plantId: string;
        code: string;
        name: string;
        startedLots: number;
        finishedLots: number;
        plannedKg: string | null;
        plannedCoverage: number;
      }>,
      byTank: [] as Array<{
        plantId: string;
        tankId: string;
        tankName: string;
        startedLots: number;
        plannedKg: string | null;
        plannedCoverage: number;
      }>,
      trend: [] as Array<{ month: string; startedLots: number; finishedLots: number }>,
      warnings: [
        'La cantidad planificada pertenece a la cohorte de OF iniciadas en el mes.',
        'Los kg envasados pertenecen a OE finalizadas en el mes y no representan kg fabricados.',
        'No existe una fuente validada de cantidad final realmente fabricada por OF.'
      ]
    };
    if (!ids.length) return empty;
    const base = { companyId: user.companyId, plantId: { in: ids }, cancelledAt: null };
    const startedWhere = { ...base, startedAt: { gte: period.start, lt: period.end } };
    const finishedWhere = { ...base, finishedAt: { gte: period.start, lt: period.end } };
    const packagingWhere = {
      ...base,
      finishedAt: { gte: period.start, lt: period.end }
    };
    const plantSql = Prisma.join(ids);
    const [year, month] = period.month.split('-').map(Number);
    const trendStart = new Date(Date.UTC(year, month - 6, 1, 3));
    const result = await this.prisma.$transaction(
      async (tx) => {
        const started = await tx.productionLot.aggregate({
          where: startedWhere,
          _count: { _all: true, plannedQuantityKg: true },
          _sum: { plannedQuantityKg: true }
        });
        const finished = await tx.productionLot.count({ where: finishedWhere });
        const startedByPlant = await tx.productionLot.groupBy({
          by: ['plantId'],
          where: startedWhere,
          _count: { _all: true, plannedQuantityKg: true },
          _sum: { plannedQuantityKg: true }
        });
        const finishedByPlant = await tx.productionLot.groupBy({
          by: ['plantId'],
          where: finishedWhere,
          _count: { _all: true }
        });
        const startedByTank = await tx.productionLot.groupBy({
          by: ['plantId', 'tankId'],
          where: startedWhere,
          _count: { _all: true, plannedQuantityKg: true },
          _sum: { plannedQuantityKg: true }
        });
        const tanks = await tx.tank.findMany({
          where: { companyId: user.companyId, plantId: { in: ids } },
          select: { id: true, name: true }
        });
        const packaging = await tx.packagingOrder.aggregate({
          where: packagingWhere,
          _count: { _all: true, producedKg: true, producedUnits: true, wasteKg: true },
          _sum: { producedKg: true, producedUnits: true, wasteKg: true }
        });
        const intervals = await tx.$queryRaw<
          Array<{ count: bigint; averageSeconds: number | null }>
        >(Prisma.sql`
        SELECT COUNT(*)::bigint AS count,
          AVG(EXTRACT(EPOCH FROM (h."endedAt" - h."startedAt")))::float8 AS "averageSeconds"
        FROM "TankStateHistory" h
        WHERE h."companyId" = ${user.companyId}
          AND h."plantId" IN (${plantSql})
          AND h.state = 'FABRICANDO'::"TankState"
          AND h."lotId" IS NOT NULL
          AND h."endedAt" >= ${period.start} AND h."endedAt" < ${period.end}
          AND h."endedAt" >= h."startedAt"
      `);
        const trend = await tx.$queryRaw<
          Array<{ month: string; started: bigint; finished: bigint }>
        >(Prisma.sql`
        WITH months AS (
          SELECT to_char(l."startedAt" AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM') AS month,
            COUNT(*)::bigint AS started, 0::bigint AS finished
          FROM "ProductionLot" l
          WHERE l."companyId" = ${user.companyId} AND l."plantId" IN (${plantSql})
            AND l."cancelledAt" IS NULL
            AND l."startedAt" >= ${trendStart} AND l."startedAt" < ${period.end}
          GROUP BY 1
          UNION ALL
          SELECT to_char(l."finishedAt" AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM'),
            0::bigint, COUNT(*)::bigint
          FROM "ProductionLot" l
          WHERE l."companyId" = ${user.companyId} AND l."plantId" IN (${plantSql})
            AND l."cancelledAt" IS NULL
            AND l."finishedAt" >= ${trendStart} AND l."finishedAt" < ${period.end}
          GROUP BY 1
        ) SELECT month, SUM(started)::bigint AS started, SUM(finished)::bigint AS finished
          FROM months GROUP BY month ORDER BY month
      `);
        return {
          started,
          finished,
          startedByPlant,
          finishedByPlant,
          startedByTank,
          tanks,
          packaging,
          intervals: intervals[0],
          trend
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }
    );
    const tankNames = new Map(result.tanks.map((tank) => [tank.id, tank.name]));
    return {
      ...empty,
      totals: {
        startedLots: result.started._count._all,
        finishedLots: result.finished,
        plannedKgStarted: result.started._sum.plannedQuantityKg?.toString() ?? null,
        plannedKgCoverage: {
          withValue: result.started._count.plannedQuantityKg,
          total: result.started._count._all
        },
        manufacturedKg: null,
        manufacturingClosedIntervals: Number(result.intervals.count),
        manufacturingAverageSeconds:
          result.intervals.averageSeconds === null
            ? null
            : Math.round(result.intervals.averageSeconds),
        packagingFinishedOrders: result.packaging._count._all,
        packagedKg: result.packaging._sum.producedKg?.toString() ?? null,
        packagedKgCoverage: {
          withValue: result.packaging._count.producedKg,
          total: result.packaging._count._all
        },
        packagedUnits: result.packaging._sum.producedUnits,
        packagedUnitsCoverage: {
          withValue: result.packaging._count.producedUnits,
          total: result.packaging._count._all
        },
        packagingWasteKg: result.packaging._sum.wasteKg?.toString() ?? null,
        packagingWasteCoverage: {
          withValue: result.packaging._count.wasteKg,
          total: result.packaging._count._all
        }
      },
      byPlant: plants.map((plant) => {
        const started = result.startedByPlant.find((row) => row.plantId === plant.id);
        const finished = result.finishedByPlant.find((row) => row.plantId === plant.id);
        return {
          plantId: plant.id,
          code: plant.code,
          name: plant.name,
          startedLots: started?._count._all ?? 0,
          finishedLots: finished?._count._all ?? 0,
          plannedKg: started?._sum.plannedQuantityKg?.toString() ?? null,
          plannedCoverage: started?._count.plannedQuantityKg ?? 0
        };
      }),
      byTank: result.startedByTank
        .map((row) => ({
          plantId: row.plantId,
          tankId: row.tankId,
          tankName: tankNames.get(row.tankId) ?? row.tankId,
          startedLots: row._count._all,
          plannedKg: row._sum.plannedQuantityKg?.toString() ?? null,
          plannedCoverage: row._count.plannedQuantityKg
        }))
        .sort(
          (a, b) => b.startedLots - a.startedLots || a.tankName.localeCompare(b.tankName, 'es-AR')
        ),
      trend: result.trend.map((row) => ({
        month: row.month,
        startedLots: Number(row.started),
        finishedLots: Number(row.finished)
      }))
    };
  }
}
