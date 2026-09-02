import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditActionType, AuditEntityType } from '@prisma/client';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { JwtUser } from '../../common/auth/jwt-user.interface';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditLogsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles('DUENO', 'ADMIN')
  async findAll(
    @CurrentUser() user: JwtUser,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    const take = Math.min(Math.max(Number(limit ?? 50), 1), 100);
    const currentPage = Math.max(Number(page ?? 1), 1);
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    const validFrom = fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate : undefined;
    const validTo = toDate && !Number.isNaN(toDate.getTime()) ? toDate : undefined;

    const where = {
      companyId: user.companyId,
      entityType:
        entityType && entityType in AuditEntityType
          ? (entityType as AuditEntityType)
          : undefined,
      action: action && action in AuditActionType ? (action as AuditActionType) : undefined,
      createdAt: validFrom || validTo ? {
        gte: validFrom,
        lt: validTo
      } : undefined
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              role: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (currentPage - 1) * take,
        take
      }),
      this.prisma.auditLog.count({ where })
    ]);

    return {
      items,
      total,
      page: currentPage,
      limit: take,
      totalPages: Math.max(Math.ceil(total / take), 1)
    };
  }
}
