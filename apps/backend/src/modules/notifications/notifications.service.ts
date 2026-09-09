import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma, UserRole } from '@prisma/client';
import { JwtUser } from '../../common/auth/jwt-user.interface';
import { PrismaService } from '../../prisma/prisma.service';

export type PlantSector = 'FABRICACION' | 'LABORATORIO' | 'ENVASADO';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: JwtUser, requestedLimit = 30, plantCode?: string) {
    const limit = Number.isFinite(requestedLimit) ? requestedLimit : 30;
    const take = Math.min(Math.max(Math.trunc(limit), 1), 50);
    const where = await this.visibleTo(user, plantCode);
    const [items, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take }),
      this.prisma.notification.count({ where: { ...where, readAt: null } })
    ]);
    return { items, unreadCount };
  }

  async markRead(user: JwtUser, id: string) {
    const result = await this.prisma.notification.updateMany({
      where: { companyId: user.companyId, userId: user.sub, id, readAt: null },
      data: { readAt: new Date() }
    });
    return { updated: result.count };
  }

  async markAllRead(user: JwtUser, plantCode?: string) {
    const visible = await this.visibleTo(user, plantCode);
    const result = await this.prisma.notification.updateMany({
      where: { ...visible, readAt: null },
      data: { readAt: new Date() }
    });
    return { updated: result.count };
  }

  async notifyTankAction(
    client: Prisma.TransactionClient | PrismaService,
    input: {
      companyId: string;
      actorUserId: string;
      tankId: string;
      targetSector: PlantSector;
      title: string;
      message: string;
    }
  ) {
    const tank = await client.tank.findUniqueOrThrow({ where: { id: input.tankId }, select: { plantId: true } });
    const recipients = await client.user.findMany({
      where: {
        companyId: input.companyId,
        isActive: true,
        id: { not: input.actorUserId },
        role: { in: [input.targetSector as UserRole, UserRole.ADMIN] }
        ,plantAccesses: { some: { plantId: tank.plantId } }
      },
      select: { id: true }
    });
    if (!recipients.length) return { created: 0 };

    const result = await client.notification.createMany({
      data: recipients.map(({ id }) => ({
        companyId: input.companyId,
        userId: id,
        type: NotificationType.TANK_ACTION_REQUIRED,
        title: input.title,
        message: input.message,
        tankId: input.tankId,
        plantId: tank.plantId,
        targetSector: input.targetSector
      }))
    });
    return { created: result.count };
  }

  private async visibleTo(user: JwtUser, plantCode?: string): Promise<Prisma.NotificationWhereInput> {
    const sector = (['FABRICACION', 'LABORATORIO', 'ENVASADO'] as string[]).includes(user.role)
      ? user.role
      : '__NO_SECTOR__';
    return {
      companyId: user.companyId,
      userId: user.sub,
      type: NotificationType.TANK_ACTION_REQUIRED,
      plant: plantCode ? { code: plantCode.toUpperCase(), userAccesses: { some: { userId: user.sub } } } : { userAccesses: { some: { userId: user.sub } } },
      ...(user.role === 'ADMIN' ? {} : { targetSector: sector })
    };
  }
}
