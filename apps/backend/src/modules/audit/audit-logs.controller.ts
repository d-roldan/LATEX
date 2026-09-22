import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Query,
  UseGuards
} from '@nestjs/common';
import { AuditActionType, AuditEntityType } from '@prisma/client';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { JwtUser } from '../../common/auth/jwt-user.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from './audit.service';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditLogsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  private assertSystemOwner(user: JwtUser) {
    if (!user.isSystemOwner) {
      throw new ForbiddenException(
        'La auditoría integral está disponible sólo para el Super Usuario'
      );
    }
  }

  @Get('dashboard/users/:userId/activity')
  @Roles('ADMIN')
  userActivity(
    @CurrentUser() user: JwtUser,
    @Param('userId') userId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    this.assertSystemOwner(user);
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 30 * 86_400_000);
    const parsedFrom = from ? new Date(from) : defaultFrom;
    const parsedTo = to ? new Date(to) : now;
    const validFrom = Number.isNaN(parsedFrom.getTime()) ? defaultFrom : parsedFrom;
    const validTo = Number.isNaN(parsedTo.getTime()) ? now : parsedTo;
    const requestedPage = Number(page ?? 1);
    const currentPage = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const pageSize = Number(limit) === 50 ? 50 : 25;

    if (validFrom > validTo) {
      throw new BadRequestException('La fecha desde no puede ser posterior a la fecha hasta');
    }

    return this.auditService.userActivity(
      user.companyId,
      userId,
      validFrom,
      validTo,
      currentPage,
      pageSize
    );
  }

  @Get('dashboard')
  @Roles('ADMIN')
  dashboard(
    @CurrentUser() user: JwtUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('source') source?: string,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('plantId') plantId?: string,
    @Query('search') search?: string
  ) {
    this.assertSystemOwner(user);
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 30 * 86_400_000);
    const parsedFrom = from ? new Date(from) : defaultFrom;
    const parsedTo = to ? new Date(to) : now;
    const validFrom = Number.isNaN(parsedFrom.getTime()) ? defaultFrom : parsedFrom;
    const validTo = Number.isNaN(parsedTo.getTime()) ? now : parsedTo;
    const requestedPage = Number(page ?? 1);
    const requestedLimit = Number(limit ?? 25);
    const currentPage = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const take =
      Number.isInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(Math.max(requestedLimit, 10), 100)
        : 25;

    if (validFrom > validTo) {
      throw new BadRequestException('La fecha desde no puede ser posterior a la fecha hasta');
    }

    return this.auditService.dashboard(user.companyId, {
      from: validFrom,
      to: validTo,
      page: currentPage,
      limit: take,
      source: source === 'SYSTEM' || source === 'PLANT' ? source : undefined,
      action: action?.trim() || undefined,
      userId: userId?.trim() || undefined,
      plantId: plantId?.trim() || undefined,
      search: search?.trim() || undefined
    });
  }

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
    this.assertSystemOwner(user);
    const take = Math.min(Math.max(Number(limit ?? 50), 1), 100);
    const currentPage = Math.max(Number(page ?? 1), 1);
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    const validFrom = fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate : undefined;
    const validTo = toDate && !Number.isNaN(toDate.getTime()) ? toDate : undefined;

    const where = {
      companyId: user.companyId,
      entityType:
        entityType && entityType in AuditEntityType ? (entityType as AuditEntityType) : undefined,
      action: action && action in AuditActionType ? (action as AuditActionType) : undefined,
      createdAt:
        validFrom || validTo
          ? {
              gte: validFrom,
              lt: validTo
            }
          : undefined
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
