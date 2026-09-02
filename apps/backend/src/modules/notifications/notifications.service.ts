import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { JwtUser } from '../../common/auth/jwt-user.interface';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: JwtUser, limit = 30) {
    const take = Math.min(Math.max(limit, 1), 50);
    const [items, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { companyId: user.companyId, userId: user.sub },
        orderBy: { createdAt: 'desc' },
        take
      }),
      this.prisma.notification.count({
        where: { companyId: user.companyId, userId: user.sub, readAt: null }
      })
    ]);
    return { items, unreadCount };
  }

  async markAllRead(user: JwtUser) {
    const result = await this.prisma.notification.updateMany({
      where: { companyId: user.companyId, userId: user.sub, readAt: null },
      data: { readAt: new Date() }
    });
    return { updated: result.count };
  }

  async notifyStageAssigned(
    client: Prisma.TransactionClient | PrismaService,
    input: {
      companyId: string;
      userId: string;
      orderId: string;
      orderStageId: string;
      orderCode: string;
      stageName: string;
    }
  ) {
    return client.notification.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        type: NotificationType.STAGE_ASSIGNED,
        title: 'Nueva etapa asignada',
        message: `${input.orderCode} · ${input.stageName}`,
        orderId: input.orderId,
        orderStageId: input.orderStageId
      }
    });
  }

  async notifyStageCompleted(input: {
    companyId: string;
    operatorName: string;
    orderId: string;
    orderStageId: string;
    orderCode: string;
    stageName: string;
  }) {
    const recipients = await this.prisma.user.findMany({
      where: {
        companyId: input.companyId,
        isActive: true,
        role: { in: ['DUENO', 'ADMIN', 'SUPERVISOR'] }
      },
      select: { id: true }
    });
    if (!recipients.length) return;

    await this.prisma.notification.createMany({
      data: recipients.map(recipient => ({
        companyId: input.companyId,
        userId: recipient.id,
        type: NotificationType.STAGE_COMPLETED,
        title: 'Etapa completada',
        message: `${input.operatorName} completó ${input.stageName} en ${input.orderCode}`,
        orderId: input.orderId,
        orderStageId: input.orderStageId
      }))
    });
  }

  async notifyQualityControlPending(input: {
    companyId: string;
    orderId: string;
    orderStageId: string;
    orderCode: string;
    stageName: string;
  }) {
    const recipients = await this.prisma.user.findMany({
      where: {
        companyId: input.companyId,
        isActive: true,
        role: { in: ['DUENO', 'SUPERVISOR', 'ADMIN'] }
      },
      select: { id: true }
    });
    if (!recipients.length) return;

    await this.prisma.notification.createMany({
      data: recipients.map(recipient => ({
        companyId: input.companyId,
        userId: recipient.id,
        type: NotificationType.QUALITY_CONTROL_PENDING,
        title: 'Control de calidad pendiente',
        message: `${input.orderCode} está lista para revisión de calidad`,
        orderId: input.orderId,
        orderStageId: input.orderStageId
      }))
    });
  }

  async notifyQualityControlRejected(input: {
    companyId: string;
    userId: string;
    orderId: string;
    orderStageId: string;
    orderCode: string;
    stageName: string;
    note?: string;
  }) {
    await this.prisma.notification.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        type: NotificationType.QUALITY_CONTROL_REJECTED,
        title: 'Control de calidad rechazado',
        message: `${input.orderCode}: revisar ${input.stageName}${input.note ? ' — ' + input.note : ''}`,
        orderId: input.orderId,
        orderStageId: input.orderStageId
      }
    });
  }
}
