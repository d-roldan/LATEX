import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JwtUser } from '../../common/auth/jwt-user.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportingService } from './reporting.service';

type LabFilters = { month?: string; from?: string; to?: string; plantIds?: string };
type AdjustmentFilters = LabFilters & {
  materialCode?: string;
  lotId?: string;
  offset?: string;
  limit?: string;
};
type CountRow = { plantId: string; decisions: bigint; adjustments: bigint };
type SampleRow = {
  received: bigint;
  resolved: bigint;
  receiptCount: bigint;
  receiptAverage: number | null;
  analysisWaitCount: bigint;
  analysisWaitAverage: number | null;
  analysisCount: bigint;
  analysisAverage: number | null;
  missingAnalysisStart: bigint;
  invalidChronology: bigint;
};

@Injectable()
export class ReportingLaboratoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reporting: ReportingService
  ) {}

  async dashboard(user: JwtUser, filters: LabFilters) {
    const period = this.reporting.period(filters.month, filters.from, filters.to);
    const plants = await this.reporting.scope(user, filters.plantIds);
    const ids = plants.map((plant) => plant.id);
    const cutoff = new Date();
    const empty = {
      datasetVersion: 'reporting-laboratory-v1',
      metricVersion: 'laboratory-2026-11-v1',
      dataCutoff: cutoff.toISOString(),
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
      totals: {
        receivedSamples: 0,
        resolvedSamples: 0,
        adjustmentRequests: 0,
        adjustedLots: 0,
        reasonMentions: 0,
        evaluatedLots: 0,
        firstPassApproved: 0,
        firstPassRatePercent: null as number | null,
        multipleCycleLots: 0
      },
      times: {
        receiptWait: { count: 0, averageSeconds: null as number | null },
        analysisWait: { count: 0, averageSeconds: null as number | null },
        analysisElapsed: { count: 0, averageSeconds: null as number | null },
        laboratoryOccupancySeconds: 0
      },
      coverage: { missingAnalysisStart: 0, invalidChronology: 0, invalidLaboratoryIntervals: 0 },
      byPlant: [] as Array<{
        plantId: string;
        code: string;
        decisions: number;
        adjustments: number;
      }>,
      trend: [] as Array<{ month: string; decisions: number; adjustments: number }>,
      warnings: [
        'Las decisiones y las muestras usan fechas de inclusión distintas.',
        'La duración transcurrida de análisis no mide trabajo efectivo.',
        'La cobertura histórica debe verificarse antes de comparar tasas entre períodos o plantas.'
      ]
    };
    if (!ids.length) return empty;
    const plantSql = Prisma.join(ids);
    const [decisions, samples, firstPass, occupancy, trend, adjustmentTotals] =
      await this.prisma.$transaction(
        async (tx) => {
          const decisionRows = await tx.$queryRaw<CountRow[]>(Prisma.sql`
          SELECT q."plantId" AS "plantId",
            COUNT(*)::bigint AS decisions,
            COUNT(*) FILTER (WHERE q.result = 'AJUSTE'::"QualityResult")::bigint AS adjustments
          FROM "QualityDecision" q
          WHERE q."companyId" = ${user.companyId}
            AND q."plantId" IN (${plantSql})
            AND q."cancelledAt" IS NULL
            AND q."createdAt" >= ${period.start}
            AND q."createdAt" < ${period.end}
          GROUP BY q."plantId"
        `);
          const sampleRows = await tx.$queryRaw<SampleRow[]>(Prisma.sql`
          SELECT
            COUNT(*) FILTER (WHERE s."receivedAt" >= ${period.start}
              AND s."receivedAt" < ${period.end})::bigint AS received,
            COUNT(*) FILTER (WHERE s."resolvedAt" >= ${period.start}
              AND s."resolvedAt" < ${period.end})::bigint AS resolved,
            COUNT(*) FILTER (WHERE s."receivedAt" >= ${period.start}
              AND s."receivedAt" < ${period.end}
              AND s."receivedAt" >= s."requestedAt")::bigint AS "receiptCount",
            AVG(EXTRACT(EPOCH FROM (s."receivedAt" - s."requestedAt")))
              FILTER (WHERE s."receivedAt" >= ${period.start}
                AND s."receivedAt" < ${period.end}
                AND s."receivedAt" >= s."requestedAt")::float8 AS "receiptAverage",
            COUNT(*) FILTER (WHERE s."analysisStartedAt" >= ${period.start}
              AND s."analysisStartedAt" < ${period.end}
              AND s."receivedAt" IS NOT NULL
              AND s."analysisStartedAt" >= s."receivedAt")::bigint AS "analysisWaitCount",
            AVG(EXTRACT(EPOCH FROM (s."analysisStartedAt" - s."receivedAt")))
              FILTER (WHERE s."analysisStartedAt" >= ${period.start}
                AND s."analysisStartedAt" < ${period.end}
                AND s."receivedAt" IS NOT NULL
                AND s."analysisStartedAt" >= s."receivedAt")::float8 AS "analysisWaitAverage",
            COUNT(*) FILTER (WHERE s."resolvedAt" >= ${period.start}
              AND s."resolvedAt" < ${period.end}
              AND s."analysisStartedAt" IS NOT NULL
              AND s."resolvedAt" >= s."analysisStartedAt")::bigint AS "analysisCount",
            AVG(EXTRACT(EPOCH FROM (s."resolvedAt" - s."analysisStartedAt")))
              FILTER (WHERE s."resolvedAt" >= ${period.start}
                AND s."resolvedAt" < ${period.end}
                AND s."analysisStartedAt" IS NOT NULL
                AND s."resolvedAt" >= s."analysisStartedAt")::float8 AS "analysisAverage",
            COUNT(*) FILTER (WHERE s."resolvedAt" >= ${period.start}
              AND s."resolvedAt" < ${period.end}
              AND s."analysisStartedAt" IS NULL)::bigint AS "missingAnalysisStart",
            COUNT(*) FILTER (WHERE
              ((s."receivedAt" IS NOT NULL AND s."receivedAt" < s."requestedAt") OR
              (s."analysisStartedAt" IS NOT NULL AND s."receivedAt" IS NOT NULL
                AND s."analysisStartedAt" < s."receivedAt") OR
              (s."resolvedAt" IS NOT NULL AND s."analysisStartedAt" IS NOT NULL
                AND s."resolvedAt" < s."analysisStartedAt"))
              AND ((s."receivedAt" >= ${period.start} AND s."receivedAt" < ${period.end}) OR
                (s."analysisStartedAt" >= ${period.start} AND s."analysisStartedAt" < ${period.end}) OR
                (s."resolvedAt" >= ${period.start} AND s."resolvedAt" < ${period.end})))::bigint AS "invalidChronology"
          FROM "LaboratorySample" s
          WHERE s."companyId" = ${user.companyId}
            AND s."plantId" IN (${plantSql})
            AND s."cancelledAt" IS NULL
        `);
          const firstRows = await tx.$queryRaw<
            Array<{ evaluated: bigint; approved: bigint; multipleCycles: bigint }>
          >(Prisma.sql`
          WITH ordered AS (
            SELECT s."lotId", s."resolvedAt", q.result,
              ROW_NUMBER() OVER (PARTITION BY s."lotId" ORDER BY s."resolvedAt", s.id) AS rn,
              COUNT(*) OVER (PARTITION BY s."lotId") AS cycles
            FROM "LaboratorySample" s
            JOIN "QualityDecision" q ON q.id = s."qualityDecisionId"
              AND q."companyId" = s."companyId" AND q."plantId" = s."plantId"
              AND q."lotId" = s."lotId" AND q."cancelledAt" IS NULL
            WHERE s."companyId" = ${user.companyId}
              AND s."plantId" IN (${plantSql})
              AND s."cancelledAt" IS NULL
              AND s."resolvedAt" IS NOT NULL
          )
          SELECT COUNT(*)::bigint AS evaluated,
            COUNT(*) FILTER (WHERE result = 'APROBADO'::"QualityResult")::bigint AS approved,
            COUNT(*) FILTER (WHERE cycles >= 2)::bigint AS "multipleCycles"
          FROM ordered
          WHERE rn = 1 AND "resolvedAt" >= ${period.start} AND "resolvedAt" < ${period.end}
        `);
          const occupancyRows = await tx.$queryRaw<
            Array<{ seconds: number; invalid: bigint }>
          >(Prisma.sql`
          SELECT COALESCE(SUM(GREATEST(0, EXTRACT(EPOCH FROM
            (LEAST(COALESCE(h."endedAt", ${cutoff}), ${period.end})
              - GREATEST(h."startedAt", ${period.start}))))), 0)::float8 AS seconds,
            COUNT(*) FILTER (WHERE h."endedAt" < h."startedAt")::bigint AS invalid
          FROM "TankStateHistory" h
          WHERE h."companyId" = ${user.companyId}
            AND h."plantId" IN (${plantSql})
            AND h.state = 'LABORATORIO'::"TankState"
            AND h."lotId" IS NOT NULL
            AND h."startedAt" < ${period.end}
            AND COALESCE(h."endedAt", ${cutoff}) > ${period.start}
        `);
          const [year, month] = period.month.split('-').map(Number);
          const trendStart = new Date(Date.UTC(year, month - 6, 1, 3));
          const trendRows = await tx.$queryRaw<
            Array<{ month: string; decisions: bigint; adjustments: bigint }>
          >(Prisma.sql`
          SELECT to_char(q."createdAt" AT TIME ZONE 'America/Argentina/Buenos_Aires',
            'YYYY-MM') AS month,
            COUNT(*)::bigint AS decisions,
            COUNT(*) FILTER (WHERE q.result = 'AJUSTE'::"QualityResult")::bigint AS adjustments
          FROM "QualityDecision" q
          WHERE q."companyId" = ${user.companyId}
            AND q."plantId" IN (${plantSql})
            AND q."cancelledAt" IS NULL
            AND q."createdAt" >= ${trendStart}
            AND q."createdAt" < ${period.end}
          GROUP BY 1 ORDER BY 1
        `);
          const adjustmentRows = await tx.$queryRaw<
            Array<{ lots: bigint; mentions: bigint }>
          >(Prisma.sql`
          SELECT COUNT(DISTINCT q."lotId")::bigint AS lots,
            COALESCE(SUM(GREATEST(cardinality(q."adjustmentReasons"), 1)), 0)::bigint AS mentions
          FROM "QualityDecision" q
          WHERE q."companyId" = ${user.companyId}
            AND q."plantId" IN (${plantSql})
            AND q."cancelledAt" IS NULL
            AND q.result = 'AJUSTE'::"QualityResult"
            AND q."createdAt" >= ${period.start} AND q."createdAt" < ${period.end}
        `);
          return [
            decisionRows,
            sampleRows[0],
            firstRows[0],
            occupancyRows[0],
            trendRows,
            adjustmentRows[0]
          ] as const;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }
      );
    const adjustmentRequests = decisions.reduce((sum, row) => sum + Number(row.adjustments), 0);
    const evaluatedLots = Number(firstPass.evaluated);
    return {
      ...empty,
      totals: {
        receivedSamples: Number(samples.received),
        resolvedSamples: Number(samples.resolved),
        adjustmentRequests,
        adjustedLots: Number(adjustmentTotals.lots),
        reasonMentions: Number(adjustmentTotals.mentions),
        evaluatedLots,
        firstPassApproved: Number(firstPass.approved),
        firstPassRatePercent: evaluatedLots
          ? Math.round((10000 * Number(firstPass.approved)) / evaluatedLots) / 100
          : null,
        multipleCycleLots: Number(firstPass.multipleCycles)
      },
      times: {
        receiptWait: {
          count: Number(samples.receiptCount),
          averageSeconds:
            samples.receiptAverage === null ? null : Math.round(samples.receiptAverage)
        },
        analysisWait: {
          count: Number(samples.analysisWaitCount),
          averageSeconds:
            samples.analysisWaitAverage === null ? null : Math.round(samples.analysisWaitAverage)
        },
        analysisElapsed: {
          count: Number(samples.analysisCount),
          averageSeconds:
            samples.analysisAverage === null ? null : Math.round(samples.analysisAverage)
        },
        laboratoryOccupancySeconds: Math.max(0, Math.round(occupancy.seconds))
      },
      coverage: {
        missingAnalysisStart: Number(samples.missingAnalysisStart),
        invalidChronology: Number(samples.invalidChronology),
        invalidLaboratoryIntervals: Number(occupancy.invalid)
      },
      byPlant: plants.map((plant) => ({
        plantId: plant.id,
        code: plant.code,
        decisions: Number(decisions.find((row) => row.plantId === plant.id)?.decisions ?? 0),
        adjustments: Number(decisions.find((row) => row.plantId === plant.id)?.adjustments ?? 0)
      })),
      trend: trend.map((row) => ({
        month: row.month,
        decisions: Number(row.decisions),
        adjustments: Number(row.adjustments)
      }))
    };
  }

  async adjustments(user: JwtUser, filters: AdjustmentFilters) {
    const period = this.reporting.period(filters.month, filters.from, filters.to);
    const plants = await this.reporting.scope(user, filters.plantIds);
    const ids = plants.map((plant) => plant.id);
    const offset = Number(filters.offset ?? 0);
    const limit = Number(filters.limit ?? 25);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100_000)
      throw new BadRequestException('Desplazamiento inválido');
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
      throw new BadRequestException('Límite inválido');
    const materialCode = filters.materialCode?.trim();
    if (materialCode && (materialCode.length > 64 || !/^[a-z0-9._/-]+$/i.test(materialCode)))
      throw new BadRequestException('Material inválido');
    const lotId = filters.lotId?.trim();
    if (lotId && !/^[a-z0-9_-]{1,64}$/i.test(lotId)) throw new BadRequestException('Lote inválido');
    if (lotId) {
      const lot = await this.prisma.productionLot.findFirst({
        where: { id: lotId, companyId: user.companyId, plantId: { in: ids } },
        select: { id: true }
      });
      if (!lot) throw new NotFoundException('Lote no encontrado o no autorizado');
    }
    const periodInfo = {
      month: period.month,
      label: period.label,
      from: period.from,
      to: period.to,
      startInclusive: period.startInclusive,
      endExclusive: period.endExclusive,
      timeZone: period.timeZone
    };
    if (!ids.length)
      return {
        datasetVersion: 'reporting-adjustments-v1',
        period: periodInfo,
        includedPlants: [],
        totalRequests: 0,
        adjustedLots: 0,
        totalMentions: 0,
        pareto: [],
        materialPareto: [],
        materialReasons: [],
        detail: { total: 0, offset, limit, rows: [] }
      };
    const base = {
      companyId: user.companyId,
      plantId: { in: ids },
      cancelledAt: null,
      result: 'AJUSTE' as const,
      createdAt: { gte: period.start, lt: period.end },
      lotId: lotId || undefined,
      lot: materialCode ? { materialCode } : undefined
    };
    const conditions = Prisma.sql`
      q."companyId" = ${user.companyId}
      AND q."plantId" IN (${Prisma.join(ids)})
      AND q."cancelledAt" IS NULL
      AND q.result = 'AJUSTE'::"QualityResult"
      AND q."createdAt" >= ${period.start} AND q."createdAt" < ${period.end}
      ${lotId ? Prisma.sql`AND q."lotId" = ${lotId}` : Prisma.empty}
      ${materialCode ? Prisma.sql`AND l."materialCode" = ${materialCode}` : Prisma.empty}
    `;
    const [summaryRows, reasonRows, materialRows, materialReasonRows, detailRows] =
      await this.prisma.$transaction(
        async (tx) => {
          const summary = await tx.$queryRaw<Array<{ requests: bigint; lots: bigint }>>(Prisma.sql`
          SELECT COUNT(*)::bigint AS requests, COUNT(DISTINCT q."lotId")::bigint AS lots
          FROM "QualityDecision" q JOIN "ProductionLot" l ON l.id = q."lotId"
          WHERE ${conditions}
        `);
          const reasons = await tx.$queryRaw<
            Array<{ reason: string; mentions: bigint }>
          >(Prisma.sql`
          SELECT COALESCE(NULLIF(btrim(r.reason), ''), 'Sin clasificar') AS reason,
            COUNT(*)::bigint AS mentions
          FROM "QualityDecision" q JOIN "ProductionLot" l ON l.id = q."lotId"
          CROSS JOIN LATERAL unnest(CASE WHEN cardinality(q."adjustmentReasons") = 0
            THEN ARRAY['Sin clasificar']::text[] ELSE q."adjustmentReasons" END) AS r(reason)
          WHERE ${conditions}
          GROUP BY 1 ORDER BY mentions DESC, reason ASC
        `);
          const materials = await tx.$queryRaw<
            Array<{ materialCode: string; requests: bigint; lots: bigint }>
          >(Prisma.sql`
          SELECT l."materialCode" AS "materialCode", COUNT(*)::bigint AS requests,
            COUNT(DISTINCT q."lotId")::bigint AS lots
          FROM "QualityDecision" q JOIN "ProductionLot" l ON l.id = q."lotId"
          WHERE ${conditions}
          GROUP BY l."materialCode"
          ORDER BY requests DESC, "materialCode" ASC
        `);
          const materialReasons = await tx.$queryRaw<
            Array<{ materialCode: string; reason: string; mentions: bigint }>
          >(Prisma.sql`
          SELECT l."materialCode" AS "materialCode",
            COALESCE(NULLIF(btrim(r.reason), ''), 'Sin clasificar') AS reason,
            COUNT(*)::bigint AS mentions
          FROM "QualityDecision" q JOIN "ProductionLot" l ON l.id = q."lotId"
          CROSS JOIN LATERAL unnest(CASE WHEN cardinality(q."adjustmentReasons") = 0
            THEN ARRAY['Sin clasificar']::text[] ELSE q."adjustmentReasons" END) AS r(reason)
          WHERE ${conditions}
          GROUP BY l."materialCode", 2
          ORDER BY "materialCode" ASC, mentions DESC, reason ASC
        `);
          const detail = await tx.qualityDecision.findMany({
            where: base,
            select: {
              id: true,
              lotId: true,
              plantId: true,
              createdAt: true,
              adjustmentReasons: true,
              lot: { select: { manufacturingOrder: true, materialCode: true, description: true } },
              adjustmentItems: { select: { materialCode: true, quantityKg: true } }
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            skip: offset,
            take: limit
          });
          return [summary[0], reasons, materials, materialReasons, detail] as const;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }
      );
    const totalMentions = reasonRows.reduce((sum, row) => sum + Number(row.mentions), 0);
    let accumulated = 0;
    const pareto = reasonRows.map(({ reason, mentions: rawMentions }) => {
      const mentions = Number(rawMentions);
      accumulated += mentions;
      return {
        reason,
        mentions,
        percent: totalMentions ? Math.round((10000 * mentions) / totalMentions) / 100 : 0,
        cumulativePercent: totalMentions
          ? Math.round((10000 * accumulated) / totalMentions) / 100
          : 0
      };
    });
    const totalRequests = Number(summaryRows.requests);
    let accumulatedMaterialRequests = 0;
    const materialPareto = materialRows.map((row) => {
      const requests = Number(row.requests);
      accumulatedMaterialRequests += requests;
      return {
        materialCode: row.materialCode,
        requests,
        adjustedLots: Number(row.lots),
        percent: totalRequests ? Math.round((10000 * requests) / totalRequests) / 100 : 0,
        cumulativePercent: totalRequests
          ? Math.round((10000 * accumulatedMaterialRequests) / totalRequests) / 100
          : 0
      };
    });
    return {
      datasetVersion: 'reporting-adjustments-v1',
      period: periodInfo,
      includedPlants: plants.map(({ id, code, name }) => ({ id, code, name })),
      totalRequests,
      adjustedLots: Number(summaryRows.lots),
      totalMentions,
      pareto,
      materialPareto,
      materialReasons: materialReasonRows.map((row) => ({
        materialCode: row.materialCode,
        reason: row.reason,
        mentions: Number(row.mentions)
      })),
      detail: {
        total: Number(summaryRows.requests),
        offset,
        limit,
        rows: detailRows.map((row) => ({
          ...row,
          adjustmentItems: row.adjustmentItems.map((item) => ({
            ...item,
            quantityKg: item.quantityKg.toString()
          }))
        }))
      }
    };
  }

  async lotDetail(user: JwtUser, lotId: string) {
    if (!/^[a-z0-9_-]{1,64}$/i.test(lotId)) throw new BadRequestException('Lote inválido');
    const plants = await this.reporting.scope(user);
    const lot = await this.prisma.productionLot.findFirst({
      where: {
        id: lotId,
        companyId: user.companyId,
        plantId: { in: plants.map((plant) => plant.id) },
        cancelledAt: null
      },
      select: {
        id: true,
        plantId: true,
        manufacturingOrder: true,
        materialCode: true,
        description: true,
        startedAt: true,
        finishedAt: true
      }
    });
    if (!lot) throw new NotFoundException('Lote no encontrado o no autorizado');
    const samples = await this.prisma.laboratorySample.findMany({
      where: { lotId, plantId: lot.plantId, companyId: user.companyId, cancelledAt: null },
      select: {
        id: true,
        iteration: true,
        requestedAt: true,
        receivedAt: true,
        analysisStartedAt: true,
        resolvedAt: true,
        qualityDecision: {
          select: {
            id: true,
            result: true,
            adjustmentReasons: true,
            createdAt: true,
            cancelledAt: true
          }
        }
      },
      orderBy: [{ iteration: 'asc' }, { id: 'asc' }],
      take: 101
    });
    return {
      datasetVersion: 'reporting-laboratory-lot-v1',
      plant: plants.find((plant) => plant.id === lot.plantId),
      lot,
      samples: samples.slice(0, 100).map((sample) => ({
        ...sample,
        qualityDecision: sample.qualityDecision?.cancelledAt ? null : sample.qualityDecision
      })),
      truncated: samples.length > 100
    };
  }
}
