import { Injectable } from '@nestjs/common';
import { AuditActionType, AuditEntityType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface CreateAuditEntryInput {
  companyId: string;
  userId?: string | null;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditActionType;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
}

export interface AuditDashboardFilters {
  from: Date;
  to: Date;
  page: number;
  limit: number;
  source?: 'SYSTEM' | 'PLANT';
  action?: string;
  userId?: string;
  plantId?: string;
  search?: string;
}

const SENSITIVE_KEYS = /password|passwordhash|token|secret|authorization|keyhash/i;

function redactAuditValue(value: Prisma.JsonValue | null | undefined): Prisma.JsonValue | null {
  if (value === undefined) return null;

  if (Array.isArray(value)) {
    return value.map((item) => redactAuditValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE_KEYS.test(key) ? '[OCULTO]' : redactAuditValue(item)
      ])
    );
  }

  return value;
}

function loginResult(metadata: Prisma.JsonValue | null): string {
  if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') {
    return 'SUCCESS';
  }

  const result = metadata.result;
  return typeof result === 'string' ? result : 'SUCCESS';
}

function dayKey(value: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: CreateAuditEntryInput) {
    return this.prisma.auditLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        before: input.before,
        after: input.after,
        metadata: input.metadata
      }
    });
  }

  async dashboard(companyId: string, filters: AuditDashboardFilters) {
    const dateFilter = { gte: filters.from, lte: filters.to };
    const search = filters.search?.trim();
    const actionIsSystem = filters.action
      ? Object.values(AuditActionType).includes(filters.action as AuditActionType)
      : true;
    const includeSystem = filters.source !== 'PLANT' && !filters.plantId && actionIsSystem;
    const includePlant = filters.source !== 'SYSTEM';
    const systemWhere: Prisma.AuditLogWhereInput = {
      companyId,
      createdAt: dateFilter,
      userId: filters.userId || undefined,
      action: filters.action ? (filters.action as AuditActionType) : undefined,
      OR: search
        ? [
            { entityId: { contains: search, mode: 'insensitive' } },
            { user: { fullName: { contains: search, mode: 'insensitive' } } },
            { user: { email: { contains: search, mode: 'insensitive' } } },
            { user: { username: { contains: search, mode: 'insensitive' } } }
          ]
        : undefined
    };
    const plantWhere: Prisma.PlantAuditLogWhereInput = {
      companyId,
      createdAt: dateFilter,
      userId: filters.userId || undefined,
      plantId: filters.plantId || undefined,
      action: filters.action || undefined,
      OR: search
        ? [
            { action: { contains: search, mode: 'insensitive' } },
            { entityType: { contains: search, mode: 'insensitive' } },
            { entityId: { contains: search, mode: 'insensitive' } },
            { reason: { contains: search, mode: 'insensitive' } },
            { user: { fullName: { contains: search, mode: 'insensitive' } } },
            { user: { username: { contains: search, mode: 'insensitive' } } },
            { plant: { name: { contains: search, mode: 'insensitive' } } },
            { tank: { name: { contains: search, mode: 'insensitive' } } },
            { lot: { manufacturingOrder: { contains: search, mode: 'insensitive' } } }
          ]
        : undefined
    };
    const skip = (filters.page - 1) * filters.limit;
    const fetchLimit = skip + filters.limit;

    const [
      users,
      loginEvents,
      systemActivity,
      plantActivity,
      plants,
      plantActions,
      systemRows,
      plantRows,
      systemTotal,
      plantTotal,
      systemDates,
      plantDates,
      securityLogins
    ] = await Promise.all([
      this.prisma.user.findMany({
        where: { companyId },
        select: {
          id: true,
          fullName: true,
          email: true,
          username: true,
          role: true,
          isActive: true,
          isProtected: true,
          isSystemOwner: true,
          failedLoginAttempts: true,
          lockedUntil: true,
          createdAt: true
        },
        orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }]
      }),
      this.prisma.auditLog.findMany({
        where: { companyId, entityType: 'AUTH', action: 'LOGIN', userId: { not: null } },
        select: { userId: true, createdAt: true, metadata: true },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.auditLog.groupBy({
        by: ['userId'],
        where: { companyId, userId: { not: null } },
        _max: { createdAt: true }
      }),
      this.prisma.plantAuditLog.groupBy({
        by: ['userId'],
        where: { companyId, userId: { not: null } },
        _max: { createdAt: true }
      }),
      this.prisma.plant.findMany({
        where: { companyId },
        select: { id: true, code: true, name: true },
        orderBy: { displayOrder: 'asc' }
      }),
      this.prisma.plantAuditLog.findMany({
        where: { companyId },
        distinct: ['action'],
        select: { action: true },
        orderBy: { action: 'asc' }
      }),
      includeSystem
        ? this.prisma.auditLog.findMany({
            where: systemWhere,
            include: {
              user: { select: { id: true, fullName: true, username: true, role: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: fetchLimit
          })
        : Promise.resolve([]),
      includePlant
        ? this.prisma.plantAuditLog.findMany({
            where: plantWhere,
            include: {
              user: { select: { id: true, fullName: true, username: true, role: true } },
              plant: { select: { id: true, code: true, name: true } },
              tank: { select: { id: true, name: true, equipmentCode: true } },
              lot: { select: { id: true, manufacturingOrder: true, materialCode: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: fetchLimit
          })
        : Promise.resolve([]),
      includeSystem ? this.prisma.auditLog.count({ where: systemWhere }) : Promise.resolve(0),
      includePlant ? this.prisma.plantAuditLog.count({ where: plantWhere }) : Promise.resolve(0),
      this.prisma.auditLog.findMany({
        where: { companyId, createdAt: dateFilter },
        select: { createdAt: true }
      }),
      this.prisma.plantAuditLog.findMany({
        where: { companyId, createdAt: dateFilter },
        select: { createdAt: true }
      }),
      this.prisma.auditLog.findMany({
        where: { companyId, entityType: 'AUTH', action: 'LOGIN', createdAt: dateFilter },
        select: { metadata: true }
      })
    ]);

    const lastLoginByUser = new Map<string, Date>();
    const loginCountByUser = new Map<string, number>();
    for (const event of loginEvents) {
      if (!event.userId || loginResult(event.metadata) !== 'SUCCESS') continue;
      loginCountByUser.set(event.userId, (loginCountByUser.get(event.userId) ?? 0) + 1);
      if (!lastLoginByUser.has(event.userId)) lastLoginByUser.set(event.userId, event.createdAt);
    }

    const lastActivityByUser = new Map<string, Date>();
    for (const activity of [...systemActivity, ...plantActivity]) {
      if (!activity.userId || !activity._max.createdAt) continue;
      const previous = lastActivityByUser.get(activity.userId);
      if (!previous || activity._max.createdAt > previous) {
        lastActivityByUser.set(activity.userId, activity._max.createdAt);
      }
    }

    const now = new Date();
    const usersWithAccess = users.map((user) => {
      const lastLoginAt = lastLoginByUser.get(user.id) ?? null;
      return {
        ...user,
        lastLoginAt,
        daysSinceLogin: lastLoginAt
          ? Math.max(0, Math.floor((now.getTime() - lastLoginAt.getTime()) / 86_400_000))
          : null,
        loginCount: loginCountByUser.get(user.id) ?? 0,
        lastActivityAt: lastActivityByUser.get(user.id) ?? null
      };
    });

    const mappedSystemRows = systemRows.map((event) => ({
      id: event.id,
      source: 'SYSTEM' as const,
      createdAt: event.createdAt,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      reason: null,
      actor: event.user,
      plant: null,
      tank: null,
      lot: null,
      before: redactAuditValue(event.before),
      after: redactAuditValue(event.after),
      metadata: redactAuditValue(event.metadata)
    }));
    const mappedPlantRows = plantRows.map((event) => ({
      id: event.id,
      source: 'PLANT' as const,
      createdAt: event.createdAt,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      reason: event.reason,
      actor: event.user,
      plant: event.plant,
      tank: event.tank,
      lot: event.lot,
      before: redactAuditValue(event.before),
      after: redactAuditValue(event.after),
      metadata: null
    }));
    const items = [...mappedSystemRows, ...mappedPlantRows]
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(skip, skip + filters.limit);
    const total = systemTotal + plantTotal;

    const activityCounts = new Map<string, number>();
    for (const event of [...systemDates, ...plantDates]) {
      const date = dayKey(event.createdAt);
      activityCounts.set(date, (activityCounts.get(date) ?? 0) + 1);
    }

    const securityEvents = securityLogins.filter(
      (event) => loginResult(event.metadata) !== 'SUCCESS'
    ).length;

    return {
      generatedAt: now,
      period: { from: filters.from, to: filters.to },
      summary: {
        usersTotal: users.length,
        activeUsers: users.filter((user) => user.isActive).length,
        disabledUsers: users.filter((user) => !user.isActive).length,
        neverLoggedIn: usersWithAccess.filter((user) => !user.lastLoginAt).length,
        inactive30Days: usersWithAccess.filter(
          (user) => user.isActive && (user.daysSinceLogin === null || user.daysSinceLogin >= 30)
        ).length,
        lockedUsers: users.filter((user) => Boolean(user.lockedUntil && user.lockedUntil > now))
          .length,
        pendingFailedAttempts: users.reduce(
          (totalAttempts, user) => totalAttempts + user.failedLoginAttempts,
          0
        ),
        eventsInPeriod: systemDates.length + plantDates.length,
        systemEventsInPeriod: systemDates.length,
        plantEventsInPeriod: plantDates.length,
        securityEventsInPeriod: securityEvents
      },
      activityByDay: [...activityCounts.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, count]) => ({ date, count })),
      users: usersWithAccess,
      activity: {
        items,
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.max(Math.ceil(total / filters.limit), 1)
      },
      catalog: {
        users: users.map(({ id, fullName, username }) => ({ id, fullName, username })),
        plants,
        actions: [
          ...new Set([
            ...Object.values(AuditActionType),
            ...plantActions.map(({ action }) => action)
          ])
        ].sort()
      }
    };
  }
}
