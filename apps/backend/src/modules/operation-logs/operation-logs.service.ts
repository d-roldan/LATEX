import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtUser } from '../../common/auth/jwt-user.interface';

@Injectable()
export class OperationLogsService {
  constructor(private readonly prisma: PrismaService) {}

  getStatus() {
    return { module: 'operation-logs', status: 'ready' };
  }

  async findAll(user: JwtUser, orderId?: string, from?: string, to?: string) {
    const where: Prisma.OperationLogWhereInput = {
      companyId: user.companyId,
      orderId
    };

    if (from || to) {
      where.eventAt = {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(to) : undefined
      };
    }

    if (user.role === 'OPERARIO') {
      where.userId = user.sub;
    }

    return this.prisma.operationLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            role: true
          }
        },
        resource: true,
        order: {
          select: {
            id: true,
            code: true,
            title: true,
            productionStatus: true
          }
        }
      },
      orderBy: { eventAt: 'desc' }
    });
  }

  async findByOrder(user: JwtUser, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        companyId: user.companyId
      },
      include: {
        assignments: {
          where: {
            userId: user.sub,
            unassignedAt: null
          }
        }
      }
    });

    if (!order) {
      throw new ForbiddenException('No tenes acceso a esta orden');
    }

    if (user.role === 'OPERARIO' && order.assignments.length === 0) {
      throw new ForbiddenException('No tenes acceso a esta orden');
    }

    return this.prisma.operationLog.findMany({
      where: {
        companyId: user.companyId,
        orderId
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            role: true
          }
        },
        resource: true
      },
      orderBy: { eventAt: 'asc' }
    });
  }
}
