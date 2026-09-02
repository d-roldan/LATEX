import { Injectable } from '@nestjs/common';
import { Prisma, ProductionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtUser } from '../../common/auth/jwt-user.interface';
import { DEFAULT_COMPANY_SETTINGS } from '../companies/companies.constants';

export interface DeviationThresholdSettings {
  warningTimeDeviationPct: number;
  criticalTimeDeviationPct: number;
  warningCostDeviationPct: number;
  criticalCostDeviationPct: number;
}

export interface MonthlyManagementBucket {
  monthKey: string;
  monthLabel: string;
  closedOrders: number;
  totalWorkedHours: number;
  avgHours: number;
  revenue: number;
  materialCost: number;
  gain: number;
  loss: number;
}

interface EconomicEvolutionBucket {
  key: string;
  label: string;
  revenue: number;
  materialCost: number;
  margin: number;
  closedOrders: number;
}

interface ExecutiveOrderSummary {
  id: string;
  code: string;
  title: string;
  client: string;
  revenue: number;
  materialCost: number;
  workedHours: number;
  estimatedHours: number;
  margin: number;
  marginPct: number;
  badge?: 'top' | 'low-margin' | 'hours';
}

interface ExecutivePeriodSummary {
  revenue: number;
  materialCost: number;
  margin: number;
  workedHours: number;
  closedOrders: number;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  getStatus() {
    return { module: 'reports', status: 'ready' };
  }

  async dashboard(user: JwtUser, monthsCount?: number, from?: string, to?: string) {
    const companyId = user.companyId;

    let startOfPeriod: Date;
    let endOfPeriod: Date = new Date();
    endOfPeriod.setHours(23, 59, 59, 999);

    if (from && to) {
      startOfPeriod = this.parseRangeBoundary(from, 'start');
      endOfPeriod = this.parseRangeBoundary(to, 'end');
    } else {
      const count = monthsCount || 12;
      startOfPeriod = new Date();
      startOfPeriod.setMonth(startOfPeriod.getMonth() - (count - 1), 1);
      startOfPeriod.setHours(0, 0, 0, 0);
    }

    const calculatedMonthsCount = this.diffInMonths(startOfPeriod, endOfPeriod);
    const periodMs = endOfPeriod.getTime() - startOfPeriod.getTime();
    const previousEnd = new Date(startOfPeriod.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - periodMs);
    const settings = await this.getDeviationSettings(companyId);

    // Base filter: orders in production phase within period
    const periodFilter = {
      companyId,
      productionStatus: { not: null } as any,
      OR: [
        { createdAt: { gte: startOfPeriod, lte: endOfPeriod } },
        { updatedAt: { gte: startOfPeriod, lte: endOfPeriod } }
      ]
    };

    const [
      openCount,
      inProcessCount,
      finishedCount,
      delayedCount,
      operatorsActive,
      pendingQuotations,
      statusBreakdown,
      recentOrders,
      logsPeriod,
      consumptionsPeriod,
      estimatedCostPeriod,
      hoursByDay,
      operatorLoad,
      byClient,
      closedOrdersForPeriod,
      closedOrdersForPreviousPeriod
    ] = await Promise.all([
      this.prisma.order.count({
        where: {
          companyId,
          productionStatus: { in: ['PENDIENTE', 'PLANIFICADA', 'EN_PROCESO', 'PAUSADA'] },
          OR: [
            { createdAt: { gte: startOfPeriod, lte: endOfPeriod } },
            { updatedAt: { gte: startOfPeriod, lte: endOfPeriod } }
          ]
        }
      }),
      this.prisma.order.count({
        where: {
          companyId,
          productionStatus: { in: ['EN_PROCESO', 'PAUSADA'] },
          OR: [
            { createdAt: { gte: startOfPeriod, lte: endOfPeriod } },
            { updatedAt: { gte: startOfPeriod, lte: endOfPeriod } }
          ]
        }
      }),
      this.prisma.order.count({
        where: {
          companyId,
          productionStatus: { in: ['FINALIZADA', 'ENTREGADA'] },
          OR: [
            { finishedAt: { gte: startOfPeriod, lte: endOfPeriod } },
            { deliveredAt: { gte: startOfPeriod, lte: endOfPeriod } }
          ]
        }
      }),
      this.prisma.order.count({
        where: {
          companyId,
          productionStatus: { notIn: ['FINALIZADA', 'ENTREGADA', 'CANCELADA'] },
          commitmentDate: { gte: startOfPeriod, lte: endOfPeriod, lt: new Date() }
        }
      }),
      this.prisma.user.count({
        where: { companyId, role: 'OPERARIO', isActive: true }
      }),
      // KPI: presupuestos pendientes
      this.prisma.order.count({
        where: {
          companyId,
          commercialStatus: { in: ['BORRADOR', 'ENVIADO'] },
          productionStatus: null
        }
      }),
      this.prisma.order.groupBy({
        by: ['productionStatus'],
        where: {
          ...periodFilter
        },
        _count: true
      }),
      this.prisma.order.findMany({
        where: periodFilter,
        include: {
          client: true,
          assignments: {
            where: { unassignedAt: null },
            include: {
              user: { select: { id: true, fullName: true } },
              resource: { select: { id: true, name: true } }
            }
          },
          operationLogs: { orderBy: { eventAt: 'asc' } },
          materialConsumptions: true
        },
        orderBy: { createdAt: 'desc' },
        take: 12
      }),
      this.prisma.operationLog.findMany({
        where: {
          companyId,
          eventAt: { gte: startOfPeriod, lte: endOfPeriod },
          eventType: { in: ['INICIO', 'PAUSA', 'REANUDACION', 'FINALIZACION'] }
        },
        orderBy: { eventAt: 'asc' }
      }),
      this.prisma.materialConsumption.findMany({
        where: {
          companyId,
          createdAt: { gte: startOfPeriod, lte: endOfPeriod }
        },
        include: {
          order: { select: { estimatedCost: true } }
        }
      }),
      this.prisma.order.findMany({
        where: periodFilter,
        select: { estimatedCost: true }
      }),
      this.prisma.$queryRaw<Array<{ day: string; hours: number }>>`
        SELECT
          TO_CHAR(date_trunc('day', "eventAt"), 'YYYY-MM-DD') as day,
          COUNT(*) FILTER (WHERE "eventType" IN ('INICIO','REANUDACION'))::int * 2 as hours
        FROM "OperationLog"
        WHERE "companyId" = ${companyId}
          AND "eventAt" >= ${startOfPeriod}
          AND "eventAt" <= ${endOfPeriod}
        GROUP BY 1
        ORDER BY 1
      `,
      this.prisma.orderAssignment.groupBy({
        by: ['userId'],
        where: {
          companyId,
          userId: { not: null },
          unassignedAt: null,
          assignedAt: { lte: endOfPeriod },
          OR: [
            { unassignedAt: null },
            { unassignedAt: { gte: startOfPeriod } }
          ]
        },
        _count: true
      }),
      this.prisma.order.groupBy({
        by: ['clientId'],
        where: periodFilter,
        _count: true
      }),
      this.prisma.order.findMany({
        where: {
          companyId,
          productionStatus: { in: ['FINALIZADA', 'ENTREGADA'] },
          OR: [
            { deliveredAt: { gte: startOfPeriod, lte: endOfPeriod } },
            { finishedAt: { gte: startOfPeriod, lte: endOfPeriod } }
          ]
        },
        include: {
          client: { select: { id: true, name: true } },
          operationLogs: { orderBy: { eventAt: 'asc' } },
          materialConsumptions: true
        }
      }),
      this.prisma.order.findMany({
        where: {
          companyId,
          productionStatus: { in: ['FINALIZADA', 'ENTREGADA'] },
          OR: [
            { deliveredAt: { gte: previousStart, lte: previousEnd } },
            { finishedAt: { gte: previousStart, lte: previousEnd } }
          ]
        },
        include: {
          operationLogs: { orderBy: { eventAt: 'asc' } },
          materialConsumptions: true
        }
      })
    ]);

    const operators = await this.prisma.user.findMany({
      where: {
        companyId,
        id: { in: operatorLoad.map((item) => item.userId).filter((id): id is string => Boolean(id)) }
      },
      select: { id: true, fullName: true }
    });

    const clients = await this.prisma.client.findMany({
      where: {
        companyId,
        id: { in: byClient.map((item) => item.clientId) }
      },
      select: { id: true, name: true }
    });

    const estimatedTotalTotal = estimatedCostPeriod.reduce((acc, current) => acc + Number(current.estimatedCost), 0);
    const realTotalTotal = consumptionsPeriod.reduce(
      (acc, current) => acc + Number(current.quantity) * Number(current.unitCostSnapshot),
      0
    );

    const delayedOrdersList = recentOrders.filter(
      (order) =>
        order.commitmentDate &&
        order.commitmentDate < new Date() &&
        order.productionStatus &&
        !['FINALIZADA', 'ENTREGADA', 'CANCELADA'].includes(order.productionStatus)
    );

    const deviationAlerts = recentOrders
      .map((order) => this.buildDeviationAlert(order, settings))
      .filter((item) => item !== null);

    const warningAlerts = deviationAlerts.filter((item) => item.severity === 'warning').length;
    const criticalAlerts = deviationAlerts.filter((item) => item.severity === 'critical').length;

    const monthlyManagement = this.buildMonthlyManagementSeries(closedOrdersForPeriod, startOfPeriod, calculatedMonthsCount);
    const daysInPeriod = this.diffInDays(startOfPeriod, endOfPeriod);
    const economicEvolution = daysInPeriod <= 62
      ? {
          granularity: 'daily' as const,
          buckets: this.buildDailyEconomicSeries(closedOrdersForPeriod, consumptionsPeriod, startOfPeriod, daysInPeriod)
        }
      : {
          granularity: 'monthly' as const,
          buckets: this.buildMonthlyEconomicSeries(monthlyManagement, consumptionsPeriod)
        };
    const periodRevenue = monthlyManagement.reduce((acc, month) => acc + month.revenue, 0);
    const periodMaterialCost = consumptionsPeriod.reduce((acc, item) => acc + this.getConsumptionCost(item), 0);
    const periodGain = monthlyManagement.reduce((acc, month) => acc + month.gain, 0);
    const periodLoss = monthlyManagement.reduce((acc, month) => acc + month.loss, 0);
    const periodClosedOrders = monthlyManagement.reduce((acc, month) => acc + month.closedOrders, 0);
    const periodWorkedHours = monthlyManagement.reduce((acc, month) => acc + month.totalWorkedHours, 0);
    const periodSummary = {
      revenue: periodRevenue,
      materialCost: periodMaterialCost,
      margin: periodRevenue - periodMaterialCost,
      workedHours: periodWorkedHours,
      closedOrders: periodClosedOrders
    };
    const previousSummary = this.buildExecutivePeriodSummary(closedOrdersForPreviousPeriod);
    const profitableJobs = this.buildProfitableJobs(closedOrdersForPeriod);
    const profitableClients = this.buildProfitableClients(closedOrdersForPeriod);

    return {
      kpis: {
        openCount,
        inProcessCount,
        finishedCount,
        delayedCount,
        operatorsActive,
        pendingQuotations,
        hoursToday: logsPeriod.length * 2,
        estimatedVsReal: {
          estimatedTotal: estimatedTotalTotal,
          realTotal: realTotalTotal
        },
        alerts: {
          total: deviationAlerts.length,
          warning: warningAlerts,
          critical: criticalAlerts
        }
      },
      managementAnnual: {
        periodLabel: `${monthlyManagement[0]?.monthLabel ?? ''} - ${monthlyManagement[monthlyManagement.length - 1]?.monthLabel ?? ''}`,
        closedOrders: periodClosedOrders,
        avgHoursPerOrder: periodClosedOrders > 0 ? periodWorkedHours / periodClosedOrders : 0,
        revenueEstimated: periodRevenue,
        materialCostReal: periodMaterialCost,
        gainEstimated: periodGain,
        lossEstimated: periodLoss,
        marginEstimated: periodRevenue - periodMaterialCost
      },
      executiveSummary: {
        current: periodSummary,
        previous: previousSummary
      },
      profitableJobs,
      profitableClients,
      economicEvolution,
      monthlyManagement,
      deviationThresholds: settings,
      deviationAlerts,
      statusBreakdown: statusBreakdown.map((item) => ({
        status: item.productionStatus,
        count: item._count
      })),
      recentOrders: recentOrders,
      delayedOrders: delayedOrdersList,
      hoursByDay,
      operatorLoad: operatorLoad.map((item) => ({
        userId: item.userId,
        fullName: operators.find((operator) => operator.id === item.userId)?.fullName ?? 'Sin usuario',
        count: item._count
      })),
      byClient: byClient.map((item) => ({
        clientId: item.clientId,
        clientName: clients.find((client) => client.id === item.clientId)?.name ?? 'Cliente',
        count: item._count
      }))
    };
  }

  private diffInMonths(start: Date, end: Date): number {
    return (
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth()) + 1
    );
  }

  private parseRangeBoundary(value: string, boundary: 'start' | 'end'): Date {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime()) && value.includes('T')) {
      return parsed;
    }

    const date = new Date(value);
    if (boundary === 'start') {
      date.setHours(0, 0, 0, 0);
    } else {
      date.setHours(23, 59, 59, 999);
    }
    return date;
  }

  private diffInDays(start: Date, end: Date): number {
    const startDay = new Date(start);
    startDay.setHours(0, 0, 0, 0);
    const endDay = new Date(end);
    endDay.setHours(0, 0, 0, 0);
    return Math.max(1, Math.floor((endDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  }

  async productivity(
    companyId: string,
    from?: string,
    to?: string,
    clientId?: string,
    operatorId?: string,
    status?: string
  ) {
    const where: Prisma.OrderWhereInput = {
      companyId,
      productionStatus: { not: null },
      clientId,
      createdAt:
        from || to
          ? {
              gte: from ? new Date(from) : undefined,
              lte: to ? new Date(to) : undefined
            }
          : undefined,
      assignments: operatorId
        ? { some: { userId: operatorId } }
        : undefined
    };

    if (status && status in ProductionStatus) {
      where.productionStatus = status as ProductionStatus;
    }

    const settings = await this.getDeviationSettings(companyId);

    const orders = await this.prisma.order.findMany({
      where,
      include: {
        client: true,
        assignments: {
          include: {
            user: { select: { id: true, fullName: true, role: true } }
          }
        },
        materialConsumptions: true,
        operationLogs: { orderBy: { eventAt: 'asc' } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const hoursByOrder = orders.map((order) => {
      const workedMinutes = this.getWorkedMinutes(order);
      const workedHours = Math.round((workedMinutes / 60) * 10) / 10;

      const realMaterialCost = order.materialConsumptions.reduce(
        (acc, item) => acc + Number(item.quantity) * Number(item.unitCostSnapshot),
        0
      );

      const estimatedHours = Math.round(order.estimatedTimeMin / 60);
      const timeDeviationHours = workedHours - estimatedHours;
      const costDeviation = realMaterialCost - Number(order.estimatedCost);

      const timeDeviationPct = order.estimatedTimeMin > 0
        ? ((workedMinutes - order.estimatedTimeMin) / order.estimatedTimeMin) * 100
        : 0;
      const costDeviationPct = Number(order.estimatedCost) > 0
        ? ((realMaterialCost - Number(order.estimatedCost)) / Number(order.estimatedCost)) * 100
        : 0;

      const severity = this.calculateDeviationSeverity(timeDeviationPct, costDeviationPct, settings);

      return {
        id: order.id,
        code: order.code,
        status: order.productionStatus,
        client: order.client.name,
        estimatedHours,
        workedHours,
        estimatedCost: Number(order.estimatedCost),
        realMaterialCost,
        timeDeviationHours,
        costDeviation,
        timeDeviationPct,
        costDeviationPct,
        alertSeverity: severity,
        operators: order.assignments.map((assignment) => assignment.user?.fullName).filter(Boolean)
      };
    });

    const hoursByOperator = new Map<string, number>();
    hoursByOrder.forEach((order) => {
      order.operators.forEach((operator) => {
        hoursByOperator.set(
          operator ?? 'Sin operador',
          (hoursByOperator.get(operator ?? 'Sin operador') ?? 0) + order.workedHours
        );
      });
    });

    const overdueOrders = orders.filter(
      (order) =>
        order.commitmentDate &&
        order.commitmentDate < new Date() &&
        order.productionStatus &&
        !['FINALIZADA', 'ENTREGADA', 'CANCELADA'].includes(order.productionStatus)
    );

    const alerts = hoursByOrder.filter((order) => order.alertSeverity !== 'ok');

    return {
      hoursByOrder,
      thresholds: settings,
      alerts,
      hoursByOperator: Array.from(hoursByOperator.entries()).map(([operator, hours]) => ({
        operator,
        hours
      })),
      overdueOrders: overdueOrders.map((order) => ({
        id: order.id,
        code: order.code,
        client: order.client.name,
        status: order.productionStatus,
        commitmentDate: order.commitmentDate
      })),
      totals: {
        orders: orders.length,
        estimatedCost: orders.reduce((acc, order) => acc + Number(order.estimatedCost), 0),
        realMaterialCost: orders.reduce(
          (acc, order) =>
            acc +
            order.materialConsumptions.reduce(
              (materialAcc, material) => materialAcc + Number(material.quantity) * Number(material.unitCostSnapshot),
              0
            ),
          0
        )
      }
    };
  }

  async rarAnalytics(
    companyId: string,
    filters: { from?: string; to?: string; modelId?: string; sector?: string; operatorId?: string }
  ) {
    const now = new Date();
    const from = filters.from ? this.parseRangeBoundary(filters.from, 'start') : new Date(now.getTime() - 29 * 86400000);
    from.setHours(0, 0, 0, 0);
    const to = filters.to ? this.parseRangeBoundary(filters.to, 'end') : now;

    const orders = await this.prisma.order.findMany({
      where: {
        companyId,
        productionStatus: { not: null },
        cabinModelRevision: filters.modelId ? { cabinModelId: filters.modelId } : undefined,
        stages: filters.sector || filters.operatorId ? {
          some: {
            sector: filters.sector || undefined,
            workSessions: filters.operatorId ? { some: { userId: filters.operatorId } } : undefined
          }
        } : undefined
      },
      include: {
        client: { select: { name: true } },
        cabinModelRevision: {
          include: { cabinModel: { select: { id: true, code: true, name: true } } }
        },
        stages: {
          where: { sector: filters.sector || undefined },
          include: {
            workSessions: {
              where: {
                userId: filters.operatorId || undefined,
                startedAt: { lte: to },
                OR: [{ endedAt: null }, { endedAt: { gte: from } }]
              },
              include: { user: { select: { id: true, fullName: true } } }
            },
            consumptions: {
              where: { consumedAt: { gte: from, lte: to } }
            }
          },
          orderBy: { position: 'asc' }
        },
        materialConsumptions: {
          where: { consumedAt: { gte: from, lte: to } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const minutesForSession = (session: { startedAt: Date; endedAt: Date | null }) => {
      const start = Math.max(session.startedAt.getTime(), from.getTime());
      const end = Math.min((session.endedAt ?? now).getTime(), to.getTime(), now.getTime());
      return Math.max(0, (end - start) / 60000);
    };

    const stageMap = new Map<string, {
      code: string; name: string; sector: string; estimatedMinutes: number; workedMinutes: number;
      completed: number; total: number; delayed: number;
    }>();
    const sectorMap = new Map<string, { sector: string; estimatedMinutes: number; workedMinutes: number; active: number; blocked: number }>();
    const operatorMap = new Map<string, {
      id: string;
      name: string;
      workedMinutes: number;
      sessions: number;
      stages: Set<string>;
      completedStageIds: Set<string>;
      completedWorkedMinutes: number;
      earnedEstimatedMinutes: number;
    }>();
    let totalEstimatedMinutes = 0;
    let totalWorkedMinutes = 0;
    let completedStages = 0;
    let blockedStages = 0;
    let pausedStages = 0;
    let activeStages = 0;

    const orderRows = orders.map((order) => {
      let workedMinutes = 0;
      let estimatedMinutes = 0;
      let completed = 0;
      let blocked = 0;

      for (const stage of order.stages) {
        const stageWorked = stage.workSessions.reduce((sum, session) => sum + minutesForSession(session), 0);
        const hasPeriodActivity = stageWorked > 0 || (
          (stage.startedAt && stage.startedAt <= to && (!stage.finishedAt || stage.finishedAt >= from)) ||
          (stage.finishedAt && stage.finishedAt >= from && stage.finishedAt <= to) ||
          (stage.updatedAt >= from && stage.updatedAt <= to)
        );
        if (!hasPeriodActivity) continue;

        workedMinutes += stageWorked;
        estimatedMinutes += stage.estimatedTimeMin;
        totalWorkedMinutes += stageWorked;
        totalEstimatedMinutes += stage.estimatedTimeMin;
        if (stage.status === 'COMPLETADA') { completed++; completedStages++; }
        if (stage.status === 'BLOQUEADA') { blocked++; blockedStages++; }
        if (stage.status === 'PAUSADA') pausedStages++;
        if (stage.status === 'EN_PROCESO') activeStages++;

        const key = stage.code;
        const stageRow = stageMap.get(key) ?? {
          code: stage.code, name: stage.name, sector: stage.sector ?? 'Sin sector',
          estimatedMinutes: 0, workedMinutes: 0, completed: 0, total: 0, delayed: 0
        };
        stageRow.estimatedMinutes += stage.estimatedTimeMin;
        stageRow.workedMinutes += stageWorked;
        stageRow.total++;
        if (stage.status === 'COMPLETADA') stageRow.completed++;
        if (stageWorked > stage.estimatedTimeMin) stageRow.delayed++;
        stageMap.set(key, stageRow);

        const sectorName = stage.sector ?? 'Sin sector';
        const sectorRow = sectorMap.get(sectorName) ?? {
          sector: sectorName, estimatedMinutes: 0, workedMinutes: 0, active: 0, blocked: 0
        };
        sectorRow.estimatedMinutes += stage.estimatedTimeMin;
        sectorRow.workedMinutes += stageWorked;
        if (stage.status === 'EN_PROCESO') sectorRow.active++;
        if (stage.status === 'BLOQUEADA') sectorRow.blocked++;
        sectorMap.set(sectorName, sectorRow);

        for (const session of stage.workSessions) {
          const sessionMinutes = minutesForSession(session);
          const operator = operatorMap.get(session.userId) ?? {
            id: session.userId,
            name: session.user.fullName,
            workedMinutes: 0,
            sessions: 0,
            stages: new Set<string>(),
            completedStageIds: new Set<string>(),
            completedWorkedMinutes: 0,
            earnedEstimatedMinutes: 0
          };
          operator.workedMinutes += sessionMinutes;
          operator.sessions++;
          operator.stages.add(stage.code);
          if (stage.status === 'COMPLETADA' && stageWorked > 0 && sessionMinutes > 0) {
            operator.completedStageIds.add(`${order.id}:${stage.id}`);
            operator.completedWorkedMinutes += sessionMinutes;
            operator.earnedEstimatedMinutes += stage.estimatedTimeMin * (sessionMinutes / stageWorked);
          }
          operatorMap.set(session.userId, operator);
        }
      }

      const materialCost = order.materialConsumptions.reduce(
        (sum, item) => sum + Number(item.quantity) * Number(item.unitCostSnapshot), 0
      );
      return {
        id: order.id,
        code: order.code,
        client: order.client.name,
        model: order.cabinModelRevision?.cabinModel.code ?? 'Sin modelo',
        status: order.productionStatus,
        progressPct: order.progressPct,
        commitmentDate: order.commitmentDate,
        estimatedHours: estimatedMinutes / 60,
        workedHours: workedMinutes / 60,
        deviationPct: estimatedMinutes > 0 ? ((workedMinutes - estimatedMinutes) / estimatedMinutes) * 100 : 0,
        materialCost,
        completedStages: completed,
        totalStages: order.stages.length,
        blockedStages: blocked
      };
    }).filter((order) => order.totalStages > 0);

    const [models, operators, commercial] = await Promise.all([
      this.prisma.cabinModel.findMany({
        where: { companyId, isActive: true },
        select: { id: true, code: true, name: true },
        orderBy: { code: 'asc' }
      }),
      this.prisma.user.findMany({
        where: { companyId, role: 'OPERARIO', isActive: true },
        select: { id: true, fullName: true },
        orderBy: { fullName: 'asc' }
      }),
      this.prisma.order.groupBy({
        by: ['commercialStatus'],
        where: { companyId, createdAt: { gte: from, lte: to }, commercialStatus: { not: null } },
        _count: true
      })
    ]);

    const stages = Array.from(stageMap.values())
      .map((row) => ({ ...row, estimatedHours: row.estimatedMinutes / 60, workedHours: row.workedMinutes / 60,
        deviationPct: row.estimatedMinutes > 0 ? ((row.workedMinutes - row.estimatedMinutes) / row.estimatedMinutes) * 100 : 0 }))
      .sort((a, b) => b.deviationPct - a.deviationPct);
    const sectors = Array.from(sectorMap.values())
      .map((row) => ({ ...row, estimatedHours: row.estimatedMinutes / 60, workedHours: row.workedMinutes / 60,
        deviationPct: row.estimatedMinutes > 0 ? ((row.workedMinutes - row.estimatedMinutes) / row.estimatedMinutes) * 100 : 0 }))
      .sort((a, b) => b.workedMinutes - a.workedMinutes);

    return {
      period: { from, to },
      filters: {
        models,
        operators,
        sectors: Array.from(new Set(orders.flatMap((order) => order.stages.map((stage) => stage.sector).filter(Boolean)))).sort()
      },
      kpis: {
        cabins: orderRows.length,
        averageProgressPct: orderRows.length ? orderRows.reduce((sum, row) => sum + row.progressPct, 0) / orderRows.length : 0,
        estimatedHours: totalEstimatedMinutes / 60,
        workedHours: totalWorkedMinutes / 60,
        timeDeviationPct: totalEstimatedMinutes > 0 ? ((totalWorkedMinutes - totalEstimatedMinutes) / totalEstimatedMinutes) * 100 : 0,
        completedStages, blockedStages, pausedStages, activeStages,
        delayedCabins: orderRows.filter((row) => row.commitmentDate && row.commitmentDate < now && !['FINALIZADA', 'ENTREGADA', 'CANCELADA'].includes(row.status!)).length,
        materialCost: orderRows.reduce((sum, row) => sum + row.materialCost, 0)
      },
      stages,
      sectors,
      operators: Array.from(operatorMap.values()).map((row) => ({
        id: row.id,
        name: row.name,
        workedHours: row.workedMinutes / 60,
        sessions: row.sessions,
        stages: row.stages.size,
        completedStages: row.completedStageIds.size,
        completedWorkedHours: row.completedWorkedMinutes / 60,
        earnedEstimatedHours: row.earnedEstimatedMinutes / 60,
        efficiencyPct: row.completedWorkedMinutes > 0
          ? (row.earnedEstimatedMinutes / row.completedWorkedMinutes) * 100
          : null
      })).sort((a, b) => {
        if (a.efficiencyPct === null) return 1;
        if (b.efficiencyPct === null) return -1;
        return b.efficiencyPct - a.efficiencyPct;
      }),
      orders: orderRows.sort((a, b) => b.deviationPct - a.deviationPct),
      commercial: Object.fromEntries(commercial.map((row) => [row.commercialStatus ?? 'SIN_ESTADO', row._count]))
    };
  }

  private calculateWorkedMinutes(logs: Array<{ eventType: string; eventAt: Date }>) {
    let totalMinutes = 0;
    let openStart: Date | null = null;

    for (const log of logs) {
      if (log.eventType === 'INICIO' || log.eventType === 'REANUDACION') {
        openStart = log.eventAt;
      }
      if ((log.eventType === 'PAUSA' || log.eventType === 'FINALIZACION') && openStart) {
        const diff = Math.max(0, log.eventAt.getTime() - openStart.getTime());
        totalMinutes += diff / (1000 * 60);
        openStart = null;
      }
    }

    if (openStart) {
      const diff = Math.max(0, new Date().getTime() - openStart.getTime());
      totalMinutes += diff / (1000 * 60);
    }

    return Math.round(totalMinutes);
  }

  private getWorkedMinutes(order: {
    operationLogs: Array<{ eventType: string; eventAt: Date }>;
    startedAt: Date | null;
    finishedAt: Date | null;
    deliveredAt: Date | null;
  }) {
    const fromLogs = this.calculateWorkedMinutes(order.operationLogs);
    if (fromLogs > 0) return fromLogs;

    const end = order.deliveredAt ?? order.finishedAt;
    if (order.startedAt && end) {
      return Math.max(0, Math.round((end.getTime() - order.startedAt.getTime()) / (1000 * 60)));
    }
    return 0;
  }

  private calculateDeviationSeverity(
    timeDeviationPct: number,
    costDeviationPct: number,
    settings: DeviationThresholdSettings
  ): 'ok' | 'warning' | 'critical' {
    if (
      timeDeviationPct >= settings.criticalTimeDeviationPct ||
      costDeviationPct >= settings.criticalCostDeviationPct
    ) return 'critical';

    if (
      timeDeviationPct >= settings.warningTimeDeviationPct ||
      costDeviationPct >= settings.warningCostDeviationPct
    ) return 'warning';

    return 'ok';
  }

  private buildDeviationAlert(
    order: {
      id: string;
      code: string;
      productionStatus: string | null;
      client: { name: string };
      estimatedTimeMin: number;
      estimatedCost: Prisma.Decimal;
      operationLogs: Array<{ eventType: string; eventAt: Date }>;
      materialConsumptions: Array<{ quantity: Prisma.Decimal; unitCostSnapshot: Prisma.Decimal }>;
      assignments: Array<{ user: { fullName: string } | null }>;
      startedAt: Date | null;
      finishedAt: Date | null;
      deliveredAt: Date | null;
    },
    settings: DeviationThresholdSettings
  ) {
    const workedMinutes = this.getWorkedMinutes(order);
    const realMaterialCost = order.materialConsumptions.reduce(
      (acc, item) => acc + Number(item.quantity) * Number(item.unitCostSnapshot),
      0
    );

    const timeDeviationPct = order.estimatedTimeMin > 0
      ? ((workedMinutes - order.estimatedTimeMin) / order.estimatedTimeMin) * 100
      : 0;
    const costDeviationPct = Number(order.estimatedCost) > 0
      ? ((realMaterialCost - Number(order.estimatedCost)) / Number(order.estimatedCost)) * 100
      : 0;

    const severity = this.calculateDeviationSeverity(timeDeviationPct, costDeviationPct, settings);
    if (severity === 'ok') return null;

    const reasons: string[] = [];
    if (timeDeviationPct >= settings.warningTimeDeviationPct) {
      reasons.push(`Desvio de tiempo ${timeDeviationPct.toFixed(1)}%`);
    }
    if (costDeviationPct >= settings.warningCostDeviationPct) {
      reasons.push(`Desvio de costo ${costDeviationPct.toFixed(1)}%`);
    }

    return {
      id: order.id,
      code: order.code,
      status: order.productionStatus,
      client: order.client.name,
      severity,
      timeDeviationPct,
      costDeviationPct,
      reasons,
      operators: order.assignments.map((item) => item.user?.fullName).filter(Boolean)
    };
  }

  private buildMonthlyManagementSeries(
    closedOrders: Array<{
      productionStatus: string | null;
      deliveredAt: Date | null;
      finishedAt: Date | null;
      updatedAt: Date;
      estimatedCost: Prisma.Decimal;
      startedAt: Date | null;
      operationLogs: Array<{ eventType: string; eventAt: Date }>;
      materialConsumptions: Array<{ quantity: Prisma.Decimal; unitCostSnapshot: Prisma.Decimal }>;
    }>,
    startDate: Date,
    monthsCount: number
  ) {
    const months: MonthlyManagementBucket[] = [];
    const cursor = new Date(startDate);

    for (let i = 0; i < monthsCount; i += 1) {
      const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = cursor.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
      months.push({
        monthKey, monthLabel, closedOrders: 0, totalWorkedHours: 0,
        avgHours: 0, revenue: 0, materialCost: 0, gain: 0, loss: 0
      });
      cursor.setMonth(cursor.getMonth() + 1, 1);
    }

    const monthMap = new Map(months.map((month) => [month.monthKey, month]));

    for (const order of closedOrders) {
      const closeDate = order.deliveredAt ?? order.finishedAt ?? order.updatedAt;
      const monthKey = `${closeDate.getFullYear()}-${String(closeDate.getMonth() + 1).padStart(2, '0')}`;
      const month = monthMap.get(monthKey);
      if (!month) continue;

      const workedHours = this.getWorkedMinutes(order) / 60;
      const revenue = Number(order.estimatedCost);
      const materialCost = order.materialConsumptions.reduce(
        (acc, item) => acc + Number(item.quantity) * Number(item.unitCostSnapshot),
        0
      );
      const margin = revenue - materialCost;

      month.closedOrders += 1;
      month.totalWorkedHours += workedHours;
      month.revenue += revenue;
      month.materialCost += materialCost;
      month.gain += margin > 0 ? margin : 0;
      month.loss += margin < 0 ? Math.abs(margin) : 0;
    }

    for (const month of months) {
      month.avgHours = month.closedOrders > 0 ? month.totalWorkedHours / month.closedOrders : 0;
    }

    return months;
  }

  private buildDailyEconomicSeries(
    closedOrders: Array<{
      deliveredAt: Date | null;
      finishedAt: Date | null;
      updatedAt: Date;
      estimatedCost: Prisma.Decimal;
    }>,
    consumptions: Array<{ quantity: Prisma.Decimal; unitCostSnapshot: Prisma.Decimal; consumedAt: Date }>,
    startDate: Date,
    daysCount: number
  ): EconomicEvolutionBucket[] {
    const days: EconomicEvolutionBucket[] = [];
    const cursor = new Date(startDate);
    cursor.setHours(0, 0, 0, 0);

    for (let i = 0; i < daysCount; i += 1) {
      const key = cursor.toISOString().slice(0, 10);
      days.push({
        key,
        label: cursor.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),
        revenue: 0,
        materialCost: 0,
        margin: 0,
        closedOrders: 0
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    const dayMap = new Map(days.map((day) => [day.key, day]));

    for (const order of closedOrders) {
      const closeDate = order.deliveredAt ?? order.finishedAt ?? order.updatedAt;
      const key = closeDate.toISOString().slice(0, 10);
      const day = dayMap.get(key);
      if (!day) continue;

      const revenue = Number(order.estimatedCost);
      day.revenue += revenue;
      day.closedOrders += 1;
    }

    for (const consumption of consumptions) {
      const key = consumption.consumedAt.toISOString().slice(0, 10);
      const day = dayMap.get(key);
      if (!day) continue;

      const materialCost = this.getConsumptionCost(consumption);
      day.materialCost += materialCost;
    }

    let accumulatedMargin = 0;
    for (const day of days) {
      accumulatedMargin += day.revenue - day.materialCost;
      day.margin = accumulatedMargin;
    }

    return days;
  }

  private buildMonthlyEconomicSeries(
    monthlyManagement: MonthlyManagementBucket[],
    consumptions: Array<{ quantity: Prisma.Decimal; unitCostSnapshot: Prisma.Decimal; consumedAt: Date }>
  ): EconomicEvolutionBucket[] {
    const months = monthlyManagement.map((month) => ({
      key: month.monthKey,
      label: month.monthLabel,
      revenue: month.revenue,
      materialCost: 0,
      margin: month.revenue,
      closedOrders: month.closedOrders
    }));
    const monthMap = new Map(months.map((month) => [month.key, month]));

    for (const consumption of consumptions) {
      const key = `${consumption.consumedAt.getFullYear()}-${String(consumption.consumedAt.getMonth() + 1).padStart(2, '0')}`;
      const month = monthMap.get(key);
      if (!month) continue;

      const materialCost = this.getConsumptionCost(consumption);
      month.materialCost += materialCost;
      month.margin -= materialCost;
    }

    return months;
  }

  private buildExecutivePeriodSummary(
    orders: Array<{
      estimatedCost: Prisma.Decimal;
      operationLogs: Array<{ eventType: string; eventAt: Date }>;
      materialConsumptions: Array<{ quantity: Prisma.Decimal; unitCostSnapshot: Prisma.Decimal }>;
      startedAt: Date | null;
      finishedAt: Date | null;
      deliveredAt: Date | null;
    }>
  ): ExecutivePeriodSummary {
    return orders.reduce<ExecutivePeriodSummary>((acc, order) => {
      const materialCost = this.getMaterialCost(order.materialConsumptions);
      acc.revenue += Number(order.estimatedCost);
      acc.materialCost += materialCost;
      acc.margin += Number(order.estimatedCost) - materialCost;
      acc.workedHours += this.getWorkedMinutes(order) / 60;
      acc.closedOrders += 1;
      return acc;
    }, { revenue: 0, materialCost: 0, margin: 0, workedHours: 0, closedOrders: 0 });
  }

  private buildProfitableJobs(
    orders: Array<{
      id: string;
      code: string;
      title: string;
      estimatedCost: Prisma.Decimal;
      estimatedTimeMin: number;
      client: { name: string };
      operationLogs: Array<{ eventType: string; eventAt: Date }>;
      materialConsumptions: Array<{ quantity: Prisma.Decimal; unitCostSnapshot: Prisma.Decimal }>;
      startedAt: Date | null;
      finishedAt: Date | null;
      deliveredAt: Date | null;
    }>
  ): ExecutiveOrderSummary[] {
    const summaries: ExecutiveOrderSummary[] = orders.map((order) => {
      const revenue = Number(order.estimatedCost);
      const materialCost = this.getMaterialCost(order.materialConsumptions);
      const workedHours = Math.round((this.getWorkedMinutes(order) / 60) * 10) / 10;
      const estimatedHours = Math.round((order.estimatedTimeMin / 60) * 10) / 10;
      const margin = revenue - materialCost;
      const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
      const excessiveHours = estimatedHours > 0 && workedHours > estimatedHours * 1.25;

      return {
        id: order.id,
        code: order.code,
        title: order.title,
        client: order.client.name,
        revenue,
        materialCost,
        workedHours,
        estimatedHours,
        margin,
        marginPct,
        badge: excessiveHours ? 'hours' as const : undefined
      };
    });

    const byMargin = [...summaries].sort((a, b) => b.margin - a.margin);
    const rows = byMargin.slice(0, 5);
    const lowestMargin = [...summaries].sort((a, b) => a.marginPct - b.marginPct)[0];
    const top = rows[0];

    if (top) top.badge = 'top';
    if (lowestMargin && !rows.some((row) => row.id === lowestMargin.id)) {
      rows.push({ ...lowestMargin, badge: 'low-margin' });
    } else if (lowestMargin && lowestMargin.id !== top?.id && lowestMargin.marginPct < 20) {
      const row = rows.find((item) => item.id === lowestMargin.id);
      if (row) row.badge = 'low-margin';
    }

    return rows;
  }

  private buildProfitableClients(
    orders: Array<{
      clientId: string;
      client: { name: string };
      estimatedCost: Prisma.Decimal;
      operationLogs: Array<{ eventType: string; eventAt: Date }>;
      materialConsumptions: Array<{ quantity: Prisma.Decimal; unitCostSnapshot: Prisma.Decimal }>;
      startedAt: Date | null;
      finishedAt: Date | null;
      deliveredAt: Date | null;
    }>
  ) {
    const clients = new Map<string, {
      clientId: string;
      clientName: string;
      revenue: number;
      materialCost: number;
      margin: number;
      workedHours: number;
      orders: number;
    }>();

    for (const order of orders) {
      const current = clients.get(order.clientId) ?? {
        clientId: order.clientId,
        clientName: order.client.name,
        revenue: 0,
        materialCost: 0,
        margin: 0,
        workedHours: 0,
        orders: 0
      };
      const revenue = Number(order.estimatedCost);
      const materialCost = this.getMaterialCost(order.materialConsumptions);
      current.revenue += revenue;
      current.materialCost += materialCost;
      current.margin += revenue - materialCost;
      current.workedHours += this.getWorkedMinutes(order) / 60;
      current.orders += 1;
      clients.set(order.clientId, current);
    }

    return Array.from(clients.values())
      .map((client) => ({
        ...client,
        marginPct: client.revenue > 0 ? (client.margin / client.revenue) * 100 : 0
      }))
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 5);
  }

  private getMaterialCost(consumptions: Array<{ quantity: Prisma.Decimal; unitCostSnapshot: Prisma.Decimal }>) {
    return consumptions.reduce((acc, item) => acc + Number(item.quantity) * Number(item.unitCostSnapshot), 0);
  }

  private getConsumptionCost(consumption: { quantity: Prisma.Decimal; unitCostSnapshot: Prisma.Decimal }) {
    return Number(consumption.quantity) * Number(consumption.unitCostSnapshot);
  }

  private async getDeviationSettings(companyId: string): Promise<DeviationThresholdSettings> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { settings: true }
    });

    if (!company?.settings || typeof company.settings !== 'object') {
      return {
        warningTimeDeviationPct: DEFAULT_COMPANY_SETTINGS.warningTimeDeviationPct,
        criticalTimeDeviationPct: DEFAULT_COMPANY_SETTINGS.criticalTimeDeviationPct,
        warningCostDeviationPct: DEFAULT_COMPANY_SETTINGS.warningCostDeviationPct,
        criticalCostDeviationPct: DEFAULT_COMPANY_SETTINGS.criticalCostDeviationPct
      };
    }

    const settings = {
      ...DEFAULT_COMPANY_SETTINGS,
      ...(company.settings as Partial<typeof DEFAULT_COMPANY_SETTINGS>)
    };

    return {
      warningTimeDeviationPct: settings.warningTimeDeviationPct,
      criticalTimeDeviationPct: settings.criticalTimeDeviationPct,
      warningCostDeviationPct: settings.warningCostDeviationPct,
      criticalCostDeviationPct: settings.criticalCostDeviationPct
    };
  }
}
