import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { OperationEventType, Prisma, CommercialStatus, ProductionStatus, OrderStageStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtUser } from '../../common/auth/jwt-user.interface';
import { CreateOrderDto, OrderItemInputDto, CostingHourInputDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { AssignOrderDto } from './dto/assign-order.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { UpdateProductionStatusDto } from './dto/update-production-status.dto';
import { UpdateCommercialStatusDto } from './dto/update-commercial-status.dto';
import { ApproveOrderDto } from './dto/approve-order.dto';
import { AddConsumptionDto } from './dto/add-consumption.dto';
import { UpdateConsumptionDto } from './dto/update-consumption.dto';
import { AddEventDto } from './dto/add-event.dto';
import { CloseDeliveryDto } from './dto/close-delivery.dto';
import { UpdateAttachmentDto } from './dto/update-attachment.dto';
import { AuditService } from '../audit/audit.service';
import { DEFAULT_COMPANY_SETTINGS } from '../companies/companies.constants';
import { UpdateStageStatusDto } from './dto/update-stage-status.dto';
import { StageCommentDto } from './dto/stage-comment.dto';
import { RejectQualityControlDto } from './dto/reject-quality-control.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { resolve, sep } from 'path';
import { stat } from 'fs/promises';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService
  ) {}

  private isUserActivelyAssigned(
    order: { assignments: Array<{ userId: string | null; unassignedAt: Date | null }> },
    userId: string
  ) {
    return order.assignments.some(
      (assignment) => assignment.userId === userId && assignment.unassignedAt === null
    );
  }

  getStatus() {
    return { module: 'orders', status: 'ready' };
  }

  // Auto-generacion de codigo
  async generateCode(companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `DISAL-${year}-`;

    const lastOrder = await this.prisma.order.findFirst({
      where: { companyId, code: { startsWith: prefix } },
      orderBy: { code: 'desc' },
      select: { code: true }
    });

    const lastSeq = lastOrder ? parseInt(lastOrder.code.replace(prefix, ''), 10) : 0;
    return `${prefix}${String(lastSeq + 1).padStart(4, '0')}`;
  }

  // Stats
  async getStats(companyId: string) {
    const all = await this.prisma.order.findMany({
      where: { companyId },
      select: {
        commercialStatus: true,
        productionStatus: true,
        validUntil: true,
        createdAt: true
      }
    });

    const now = new Date();
    const commercial = { BORRADOR: 0, ENVIADO: 0, APROBADO: 0, RECHAZADO: 0, VENCIDO: 0 };
    const production = {
      PENDIENTE: 0,
      PLANIFICADA: 0,
      EN_PROCESO: 0,
      PAUSADA: 0,
      FINALIZADA: 0,
      ENTREGADA: 0,
      CANCELADA: 0,
      RETRABAJO: 0
    };
    let pendingQuotations = 0;

    for (const o of all) {
      if (o.commercialStatus && o.commercialStatus in commercial) {
        commercial[o.commercialStatus as keyof typeof commercial]++;
      }
      if (o.productionStatus && o.productionStatus in production) {
        production[o.productionStatus as keyof typeof production]++;
      }
      // Presupuestos pendientes: en fase comercial sin produccion
      if (
        o.commercialStatus &&
        ['BORRADOR', 'ENVIADO'].includes(o.commercialStatus) &&
        !o.productionStatus
      ) {
        pendingQuotations++;
      }
      // Auto-vencimiento display
      if (
        o.validUntil &&
        new Date(o.validUntil) < now &&
        o.commercialStatus !== 'APROBADO' &&
        o.commercialStatus !== 'VENCIDO' &&
        o.commercialStatus !== 'RECHAZADO'
      ) {
        commercial.VENCIDO++;
      }
    }

    return {
      total: all.length,
      commercial,
      production,
      pendingQuotations
    };
  }

  // Find all
  async findAll(
    user: JwtUser,
    filters: {
      commercialStatus?: string;
      productionStatus?: string;
      clientId?: string;
      search?: string;
      tab?: string;
      noPurchaseOrder?: boolean;
      assignedToMe?: boolean;
    }
  ) {
    const where: Prisma.OrderWhereInput = { companyId: user.companyId };

    if (filters.clientId) where.clientId = filters.clientId;

    if (filters.commercialStatus && filters.commercialStatus in CommercialStatus) {
      where.commercialStatus = filters.commercialStatus as CommercialStatus;
    }
    if (filters.productionStatus && filters.productionStatus in ProductionStatus) {
      where.productionStatus = filters.productionStatus as ProductionStatus;
    }

    if (filters.search) {
      where.OR = [
        { code: { contains: filters.search, mode: 'insensitive' } },
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { purchaseOrderNumber: { contains: filters.search, mode: 'insensitive' } },
        { client: { name: { contains: filters.search, mode: 'insensitive' } } }
      ];
    }

    // Tab filters
    if (filters.tab === 'quotations') {
      where.commercialStatus = { not: null };
      where.productionStatus = null;
    } else if (filters.tab === 'production') {
      where.productionStatus = {
        notIn: ['ENTREGADA', 'CANCELADA']
      };
    } else if (filters.tab === 'closed') {
      where.OR = [
        { productionStatus: { in: ['ENTREGADA', 'CANCELADA'] } },
        {
          commercialStatus: { in: ['RECHAZADO', 'VENCIDO'] },
          productionStatus: null
        }
      ];
    } else if (filters.tab === 'noPurchaseOrder') {
      where.OR = [{ purchaseOrderNumber: null }, { purchaseOrderNumber: '' }];
    }

    if (filters.noPurchaseOrder) {
      where.OR = [{ purchaseOrderNumber: null }, { purchaseOrderNumber: '' }];
    }

    if (user.role === 'OPERARIO' || filters.assignedToMe) {
      where.assignments = {
        some: {
          userId: user.sub,
          unassignedAt: null
        }
      };
    }

    const orderBy: Prisma.OrderOrderByWithRelationInput[] = filters.tab
      ? [{ priority: 'desc' }, { createdAt: 'desc' }]
      : [{ createdAt: 'desc' }];

    const orders = await this.prisma.order.findMany({
      where,
      include: {
        client: true,
        createdByUser: { select: { id: true, fullName: true, role: true } },
        items: { orderBy: { position: 'asc' } },
        costingHours: { orderBy: { position: 'asc' } },
        assignments: {
          where: { unassignedAt: null },
          include: {
            resource: true,
            user: { select: { id: true, fullName: true, role: true } }
          }
        },
        attachments: {
          where: user.role === 'OPERARIO' ? { isInternal: false } : undefined,
          orderBy: { uploadedAt: 'desc' }
        },
        materialConsumptions: true,
        operationLogs: { orderBy: { eventAt: 'desc' }, take: 12 }
        ,
        stages: {
          orderBy: { position: 'asc' },
          include: {
            dependencies: { include: { dependsOnStage: true } },
            assignments: {
              where: { unassignedAt: null },
              include: { user: { select: { id: true, fullName: true } }, resource: true }
            }
          }
        },
        cabinModelRevision: { include: { cabinModel: true } }
      },
      orderBy
    });
    return user.role === 'OPERARIO'
      ? orders.map((order) => this.sanitizeOrderForOperator(order))
      : orders;
  }

  // Find one
  async findOne(user: JwtUser, id: string) {
    const item = await this.prisma.order.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        client: true,
        createdByUser: { select: { id: true, fullName: true, role: true } },
        items: { orderBy: { position: 'asc' } },
        costingHours: { orderBy: { position: 'asc' } },
        assignments: {
          orderBy: { assignedAt: 'asc' },
          include: {
            resource: true,
            user: { select: { id: true, fullName: true, role: true } },
            assignedByUser: { select: { id: true, fullName: true, role: true } },
            orderStage: { select: { id: true, code: true, name: true } }
          }
        },
        operationLogs: {
          include: {
            user: { select: { id: true, fullName: true, role: true } },
            resource: true,
            orderStage: { select: { id: true, code: true, name: true } }
          },
          orderBy: { eventAt: 'asc' }
        },
        materialConsumptions: {
          include: {
            material: true,
            createdByUser: { select: { id: true, fullName: true } }
          },
          orderBy: { consumedAt: 'asc' }
        },
        attachments: {
          where: user.role === 'OPERARIO' ? { isInternal: false } : undefined,
          orderBy: { uploadedAt: 'desc' }
        },
        stages: {
          orderBy: { position: 'asc' },
          include: {
            dependencies: { include: { dependsOnStage: true } },
            assignments: {
              where: { unassignedAt: null },
              include: { user: { select: { id: true, fullName: true, role: true } }, resource: true }
            },
            workSessions: {
              orderBy: { startedAt: 'desc' },
              take: 20,
              include: {
                user: { select: { id: true, fullName: true, role: true } },
                resource: { select: { id: true, name: true } }
              }
            }
          }
        },
        cabinModelRevision: { include: { cabinModel: true } }
      }
    });

    if (!item) {
      throw new NotFoundException('Orden no encontrada');
    }

    if (user.role === 'OPERARIO') {
      const assigned = this.isUserActivelyAssigned(item, user.sub);
      if (!assigned) {
        throw new ForbiddenException('No tenes acceso a esta orden');
      }
    }

    return user.role === 'OPERARIO' ? this.sanitizeOrderForOperator(item) : item;
  }

  // Create
  async create(user: JwtUser, dto: CreateOrderDto) {
    await this.ensureClient(user.companyId, dto.clientId);
    if (dto.cabinModelRevisionId) {
      await this.ensureCabinModelRevision(user.companyId, dto.cabinModelRevisionId);
    }
    const code = await this.generateCode(user.companyId);

    const isQuotation = dto.type === 'quotation';

    const created = await this.prisma.order.create({
      data: {
        companyId: user.companyId,
        clientId: dto.clientId,
        createdByUserId: user.sub,
        code,
        title: dto.title,
        description: dto.description,
        purchaseOrderNumber: dto.purchaseOrderNumber ?? null,
        estimatedTimeMin: dto.estimatedTimeMin,
        estimatedCost: dto.estimatedCost,
        estimatedMaterials: dto.estimatedMaterials ?? null,
        // Fase comercial
        commercialStatus: isQuotation ? (dto.commercialStatus ?? 'BORRADOR') : null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        deliveryTimeDays: dto.deliveryTimeDays ?? null,
        // Fase produccion
        productionStatus: isQuotation ? null : 'PENDIENTE',
        priority: dto.priority ?? 3,
        plannedDate: dto.plannedDate ? new Date(dto.plannedDate) : null,
        commitmentDate: dto.commitmentDate ? new Date(dto.commitmentDate) : null,
        notes: dto.notes ?? null,
        dashboardUrl: dto.dashboardUrl ?? null,
        cabinModelRevisionId: dto.cabinModelRevisionId ?? null,
        serialNumber: dto.serialNumber ?? null,
        // Items y costeo (solo si se proveen)
        items: dto.items?.length
          ? { create: this.mapItems(dto.items) }
          : undefined,
        costingHours: dto.costingHours?.length
          ? { create: this.mapCostingHours(dto.costingHours) }
          : undefined
      },
      include: {
        items: { orderBy: { position: 'asc' } },
        costingHours: { orderBy: { position: 'asc' } },
        client: true,
        attachments: true
      }
    });

    // Las etapas se preparan también para presupuestos, pero permanecen ocultas
    // hasta la aprobación. Así la conversión conserva modelo y responsables.
    if (dto.cabinModelRevisionId) {
      await this.instantiateStages(user, created.id, dto.cabinModelRevisionId, dto.stageAssignments ?? []);
    }

    // Si es una OP directa, crear log de creación.
    if (!isQuotation) {
      await this.prisma.operationLog.create({
        data: {
          companyId: user.companyId,
          orderId: created.id,
          userId: user.sub,
          eventType: OperationEventType.OT_CREADA,
          eventAt: new Date(),
          note: `Orden ${created.code} creada (OP directa)`
        }
      });
    }

    await this.auditService.log({
      companyId: user.companyId,
      userId: user.sub,
      entityType: 'ORDER',
      entityId: created.id,
      action: 'CREATE',
      after: {
        code: created.code,
        type: dto.type,
        commercialStatus: created.commercialStatus,
        productionStatus: created.productionStatus
      } as unknown as Prisma.InputJsonValue
    });

    return created;
  }

  private async instantiateStages(
    user: JwtUser,
    orderId: string,
    revisionId: string,
    requestedAssignments: Array<{ stageCode: string; userIds: string[] }>
  ) {
    const revision = await this.prisma.cabinModelRevision.findFirst({
      where: { id: revisionId, cabinModel: { companyId: user.companyId }, isActive: true },
      include: {
        stages: {
          orderBy: { position: 'asc' },
          include: { dependencies: true }
        }
      }
    });
    if (!revision) throw new BadRequestException('Modelo de casilla no encontrado');

    const order = await this.ensureOrder(user.companyId, orderId);
    const stageMap = new Map<string, { id: string; name: string }>();
    for (const template of revision.stages) {
      const stage = await this.prisma.orderStage.create({
        data: {
          companyId: user.companyId,
          orderId,
          templateId: template.id,
          code: template.code,
          name: template.name,
          sector: template.sector,
          position: template.position,
          status: template.dependencies.length === 0 ? 'DISPONIBLE' : 'BLOQUEADA',
          estimatedTimeMin: template.estimatedTimeMin,
          weight: template.weight,
          isMandatory: template.isMandatory,
          isQualityGate: template.isQualityGate,
          isDeliveryGate: template.isDeliveryGate
        }
      });
      stageMap.set(template.code, stage);
    }

    for (const template of revision.stages) {
      const stage = stageMap.get(template.code)!;
      for (const dependency of template.dependencies) {
        const prerequisite = revision.stages.find((item) => item.id === dependency.dependsOnStageId);
        if (!prerequisite) continue;
        await this.prisma.orderStageDependency.create({
          data: {
            stageId: stage.id,
            dependsOnStageId: stageMap.get(prerequisite.code)!.id
          }
        });
      }
    }

    for (const request of requestedAssignments) {
      const stage = stageMap.get(request.stageCode);
      if (!stage) continue;
      for (const userId of Array.from(new Set(request.userIds))) {
        const assignedUser = await this.prisma.user.findFirst({
          where: { id: userId, companyId: user.companyId, isActive: true }
        });
        if (!assignedUser) continue;
        let resource = await this.prisma.resource.findFirst({
          where: { companyId: user.companyId, linkedUserId: userId }
        });
        if (!resource) {
          resource = await this.prisma.resource.create({
            data: {
              companyId: user.companyId,
              linkedUserId: userId,
              type: 'HUMANO',
              name: assignedUser.fullName,
              sector: 'Producción',
              status: 'DISPONIBLE'
            }
          });
        }
        await this.prisma.orderAssignment.create({
          data: {
            companyId: user.companyId,
            orderId,
            orderStageId: stage.id,
            resourceId: resource.id,
            userId,
            assignedByUserId: user.sub
          }
        });
        if (assignedUser.role === 'OPERARIO') {
          await this.notificationsService.notifyStageAssigned(this.prisma, {
            companyId: user.companyId,
            userId,
            orderId,
            orderStageId: stage.id,
            orderCode: order.code,
            stageName: stage.name
          });
        }
      }
    }
  }

  async updateStageStatus(
    user: JwtUser,
    orderId: string,
    stageId: string,
    dto: UpdateStageStatusDto
  ) {
    const stage = await this.prisma.orderStage.findFirst({
      where: { id: stageId, orderId, companyId: user.companyId },
      include: {
        order: { select: { code: true } },
        dependencies: { include: { dependsOnStage: true } },
        assignments: { where: { unassignedAt: null } }
      }
    });
    if (!stage) throw new NotFoundException('Etapa no encontrada');
    if (user.role === 'OPERARIO' && !stage.assignments.some((item) => item.userId === user.sub)) {
      throw new ForbiddenException('No estás asignado a esta etapa');
    }
    if (stage.isQualityGate && user.role === 'OPERARIO') {
      throw new ForbiddenException('El control de calidad no puede ser operado por un operario');
    }
    if (stage.isDeliveryGate && dto.status === 'COMPLETADA') {
      throw new BadRequestException('La etapa de entrega se cierra desde "Cerrar entrega", no como un cambio de estado directo');
    }
    if (
      ['EN_PROCESO', 'COMPLETADA'].includes(dto.status) &&
      stage.dependencies.some((item) => item.dependsOnStage.status !== 'COMPLETADA')
    ) {
      throw new BadRequestException('La etapa todavía tiene dependencias pendientes');
    }

    const now = new Date();
    if (dto.status === 'EN_PROCESO') {
      const activeSession = await this.prisma.stageWorkSession.findFirst({
        where: { companyId: user.companyId, userId: user.sub, endedAt: null }
      });
      if (activeSession && activeSession.orderStageId !== stage.id) {
        throw new BadRequestException('Ya tenés otra etapa con cronómetro activo');
      }
      if (!activeSession) {
        const assignment = stage.assignments.find((item) => item.userId === user.sub);
        await this.prisma.stageWorkSession.create({
          data: {
            companyId: user.companyId,
            orderStageId: stage.id,
            userId: user.sub,
            resourceId: assignment?.resourceId,
            startedAt: now,
            note: dto.note
          }
        });
      }
    }
    if (['PAUSADA', 'COMPLETADA', 'RETRABAJO'].includes(dto.status)) {
      await this.prisma.stageWorkSession.updateMany({
        where: { companyId: user.companyId, orderStageId: stage.id, userId: user.sub, endedAt: null },
        data: { endedAt: now }
      });
    }

    await this.prisma.orderStage.update({
      where: { id: stage.id },
      data: {
        status: dto.status,
        progressPct: dto.status === 'COMPLETADA' ? 100 : (dto.progressPct ?? stage.progressPct),
        startedAt: dto.status === 'EN_PROCESO' ? (stage.startedAt ?? now) : stage.startedAt,
        finishedAt: dto.status === 'COMPLETADA' ? now : null,
        pauseReason: dto.pauseReason ?? null,
        notes: dto.note ?? stage.notes
      }
    });

    const eventType = dto.status === 'EN_PROCESO'
      ? (stage.status === 'PAUSADA' ? OperationEventType.REANUDACION : OperationEventType.INICIO)
      : dto.status === 'PAUSADA'
        ? OperationEventType.PAUSA
        : dto.status === 'COMPLETADA'
          ? OperationEventType.FINALIZACION
          : OperationEventType.CAMBIO_ESTADO;
    await this.prisma.operationLog.create({
      data: {
        companyId: user.companyId,
        orderId,
        orderStageId: stage.id,
        userId: user.sub,
        resourceId: stage.assignments.find((item) => item.userId === user.sub)?.resourceId,
        eventType,
        eventAt: now,
        pauseReason: dto.pauseReason,
        note: dto.note ?? `${stage.name}: ${stage.status} → ${dto.status}`
      }
    });

    if (
      user.role === 'OPERARIO'
      && dto.status === 'COMPLETADA'
      && stage.status !== 'COMPLETADA'
    ) {
      await this.notificationsService.notifyStageCompleted({
        companyId: user.companyId,
        operatorName: user.fullName,
        orderId,
        orderStageId: stage.id,
        orderCode: stage.order.code,
        stageName: stage.name
      });
    }

    await this.releaseStagesAndRecalculate(orderId);
    return this.findOne(user, orderId);
  }

  // Rechazo de control de calidad: reabre la etapa con el defecto y todo lo que dependa de ella,
  // incluida la propia etapa de calidad, que vuelve a quedar bloqueada.
  async rejectQualityControl(
    user: JwtUser,
    orderId: string,
    stageId: string,
    dto: RejectQualityControlDto
  ) {
    const order = await this.ensureOrder(user.companyId, orderId);

    const stage = await this.prisma.orderStage.findFirst({
      where: { id: stageId, orderId, companyId: user.companyId }
    });
    if (!stage) throw new NotFoundException('Etapa no encontrada');
    if (!stage.isQualityGate) {
      throw new BadRequestException('Esta acción solo aplica sobre la etapa de control de calidad');
    }
    if (!['DISPONIBLE', 'EN_PROCESO', 'PAUSADA'].includes(stage.status)) {
      throw new BadRequestException('El control de calidad no está en revisión');
    }

    const reworkStage = await this.prisma.orderStage.findFirst({
      where: { id: dto.reworkStageId, orderId, companyId: user.companyId }
    });
    if (!reworkStage) throw new NotFoundException('Etapa a reabrir no encontrada');
    if (reworkStage.id === stage.id) {
      throw new BadRequestException('Elegí una etapa anterior para reabrir, no el control de calidad');
    }

    const allStages = await this.prisma.orderStage.findMany({
      where: { orderId },
      include: { dependencies: true }
    });

    // Etapas que dependen (directa o indirectamente) de la etapa a reabrir: hay que re-bloquearlas.
    const dependentsOf = (rootId: string): Set<string> => {
      const result = new Set<string>();
      let frontier = [rootId];
      while (frontier.length) {
        const next: string[] = [];
        for (const item of allStages) {
          if (result.has(item.id)) continue;
          if (item.dependencies.some((dep) => frontier.includes(dep.dependsOnStageId))) {
            result.add(item.id);
            next.push(item.id);
          }
        }
        frontier = next;
      }
      return result;
    };

    const toRelock = dependentsOf(reworkStage.id);
    toRelock.add(stage.id);

    await this.prisma.$transaction(async (tx) => {
      await tx.orderStage.update({
        where: { id: reworkStage.id },
        data: { status: 'RETRABAJO', finishedAt: null }
      });
      for (const id of toRelock) {
        await tx.orderStage.update({
          where: { id },
          data: { status: 'BLOQUEADA', finishedAt: null }
        });
      }
      await tx.operationLog.create({
        data: {
          companyId: user.companyId,
          orderId,
          orderStageId: reworkStage.id,
          userId: user.sub,
          eventType: OperationEventType.CAMBIO_ESTADO,
          eventAt: new Date(),
          note: `Control de calidad rechazado: se reabre ${reworkStage.name}${dto.note ? ' — ' + dto.note : ''}`
        }
      });
    });

    const reworkAssignees = await this.prisma.orderAssignment.findMany({
      where: { orderId, orderStageId: reworkStage.id, unassignedAt: null, userId: { not: null } },
      select: { userId: true }
    });
    for (const assignee of reworkAssignees) {
      if (!assignee.userId) continue;
      await this.notificationsService.notifyQualityControlRejected({
        companyId: user.companyId,
        userId: assignee.userId,
        orderId,
        orderStageId: reworkStage.id,
        orderCode: order.code,
        stageName: reworkStage.name,
        note: dto.note
      });
    }

    await this.auditService.log({
      companyId: user.companyId,
      userId: user.sub,
      entityType: 'ORDER',
      entityId: orderId,
      action: 'STATUS_CHANGE',
      before: { stageId: stage.id, status: stage.status } as unknown as Prisma.InputJsonValue,
      after: { reworkStageId: reworkStage.id, note: dto.note ?? null } as unknown as Prisma.InputJsonValue
    });

    await this.releaseStagesAndRecalculate(orderId);
    return this.findOne(user, orderId);
  }

  private async ensureStageCommentAccess(user: JwtUser, orderId: string, stageId: string) {
    const stage = await this.prisma.orderStage.findFirst({
      where: { id: stageId, orderId, companyId: user.companyId },
      include: { assignments: { where: { unassignedAt: null } } }
    });
    if (!stage) throw new NotFoundException('Etapa no encontrada');
    if (user.role === 'OPERARIO' && !stage.assignments.some((item) => item.userId === user.sub)) {
      throw new ForbiddenException('No estás asignado a esta etapa');
    }
    return stage;
  }

  async listStageComments(user: JwtUser, orderId: string, stageId: string) {
    await this.ensureStageCommentAccess(user, orderId, stageId);
    return this.prisma.stageComment.findMany({
      where: { companyId: user.companyId, orderId, orderStageId: stageId },
      include: { author: { select: { id: true, fullName: true, role: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  async addStageComment(user: JwtUser, orderId: string, stageId: string, dto: StageCommentDto) {
    await this.ensureStageCommentAccess(user, orderId, stageId);
    const content = dto.content.trim();
    if (!content) throw new BadRequestException('El comentario no puede estar vacío');
    return this.prisma.stageComment.create({
      data: {
        companyId: user.companyId,
        orderId,
        orderStageId: stageId,
        authorId: user.sub,
        content
      },
      include: { author: { select: { id: true, fullName: true, role: true } } }
    });
  }

  async updateStageComment(
    user: JwtUser,
    orderId: string,
    stageId: string,
    commentId: string,
    dto: StageCommentDto
  ) {
    await this.ensureStageCommentAccess(user, orderId, stageId);
    const comment = await this.prisma.stageComment.findFirst({
      where: { id: commentId, companyId: user.companyId, orderId, orderStageId: stageId }
    });
    if (!comment) throw new NotFoundException('Comentario no encontrado');
    if (user.role === 'OPERARIO' && comment.authorId !== user.sub) {
      throw new ForbiddenException('Solo podés editar tus propios comentarios');
    }
    const content = dto.content.trim();
    if (!content) throw new BadRequestException('El comentario no puede estar vacío');
    return this.prisma.stageComment.update({
      where: { id: comment.id },
      data: { content },
      include: { author: { select: { id: true, fullName: true, role: true } } }
    });
  }

  async removeStageComment(user: JwtUser, orderId: string, stageId: string, commentId: string) {
    await this.ensureStageCommentAccess(user, orderId, stageId);
    const comment = await this.prisma.stageComment.findFirst({
      where: { id: commentId, companyId: user.companyId, orderId, orderStageId: stageId }
    });
    if (!comment) throw new NotFoundException('Comentario no encontrado');
    if (user.role === 'OPERARIO' && comment.authorId !== user.sub) {
      throw new ForbiddenException('Solo podés borrar tus propios comentarios');
    }
    await this.prisma.stageComment.delete({ where: { id: comment.id } });
    return { message: 'Comentario eliminado' };
  }

  private async releaseStagesAndRecalculate(orderId: string) {
    const stages = await this.prisma.orderStage.findMany({
      where: { orderId },
      include: { dependencies: { include: { dependsOnStage: true } } }
    });
    const newlyUnlockedQualityGates: typeof stages = [];
    for (const stage of stages) {
      if (
        stage.status === OrderStageStatus.BLOQUEADA &&
        stage.dependencies.every((item) => item.dependsOnStage.status === OrderStageStatus.COMPLETADA)
      ) {
        await this.prisma.orderStage.update({
          where: { id: stage.id },
          data: { status: OrderStageStatus.DISPONIBLE }
        });
        stage.status = OrderStageStatus.DISPONIBLE;
        if (stage.isQualityGate) newlyUnlockedQualityGates.push(stage);
      }
    }
    const totalWeight = stages.reduce((sum, stage) => sum + Number(stage.weight), 0) || 1;
    const progress = Math.round(
      stages.reduce((sum, stage) => sum + Number(stage.weight) * stage.progressPct, 0) / totalWeight
    );
    // La etapa de entrega es el cierre formal (checklist + firma) y se completa desde closeDelivery,
    // no cuenta para "FINALIZADA" -> ese estado significa "listo para cerrar la entrega".
    const mandatory = stages.filter((stage) => stage.isMandatory && !stage.isDeliveryGate);
    const allComplete = mandatory.length > 0 && mandatory.every((stage) => stage.status === 'COMPLETADA');
    const anyActive = stages.some((stage) => ['EN_PROCESO', 'RETRABAJO'].includes(stage.status));
    const anyPaused = stages.some((stage) => stage.status === 'PAUSADA');
    const productionStatus: ProductionStatus = allComplete
      ? 'FINALIZADA'
      : anyActive
        ? 'EN_PROCESO'
        : anyPaused
          ? 'PAUSADA'
          : 'PLANIFICADA';
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        progressPct: progress,
        productionStatus,
        finishedAt: allComplete ? new Date() : null
      }
    });

    if (newlyUnlockedQualityGates.length) {
      const order = await this.prisma.order.findUnique({ where: { id: orderId }, select: { code: true, companyId: true } });
      if (order) {
        for (const stage of newlyUnlockedQualityGates) {
          await this.notificationsService.notifyQualityControlPending({
            companyId: order.companyId,
            orderId,
            orderStageId: stage.id,
            orderCode: order.code,
            stageName: stage.name
          });
        }
      }
    }
  }

  // Update
  async update(user: JwtUser, id: string, dto: UpdateOrderDto) {
    const previous = await this.ensureOrder(user.companyId, id);
    if (dto.clientId) await this.ensureClient(user.companyId, dto.clientId);

    // En DISAL el presupuesto puede ajustarse mientras la casilla sigue en producción.
    // La información comercial queda bloqueada recién al cerrar definitivamente la orden.
    const isClosed = Boolean(previous.closedAt) || ['ENTREGADA', 'CANCELADA'].includes(previous.productionStatus ?? '');
    const commercialFields = ['validUntil', 'deliveryTimeDays', 'estimatedMaterials', 'items', 'costingHours'];
    if (isClosed) {
      for (const field of commercialFields) {
        if ((dto as any)[field] !== undefined) {
          throw new BadRequestException(
            `No se puede editar "${field}" porque la orden ya esta cerrada`
          );
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        await tx.orderItem.deleteMany({ where: { orderId: id } });
      }
      if (dto.costingHours) {
        await tx.orderCostingHour.deleteMany({ where: { orderId: id } });
      }

      const updated = await tx.order.update({
        where: { id },
        data: {
          clientId: dto.clientId,
          title: dto.title,
          description: dto.description,
          purchaseOrderNumber: dto.purchaseOrderNumber,
          estimatedTimeMin: dto.estimatedTimeMin,
          estimatedCost: dto.estimatedCost,
          estimatedMaterials: dto.estimatedMaterials,
          commercialStatus: previous.commercialStatus ?? (
            dto.items !== undefined || dto.costingHours !== undefined
              ? CommercialStatus.BORRADOR
              : undefined
          ),
          validUntil:
            dto.validUntil !== undefined
              ? dto.validUntil
                ? new Date(dto.validUntil)
                : null
              : undefined,
          deliveryTimeDays:
            dto.deliveryTimeDays !== undefined ? (dto.deliveryTimeDays ?? null) : undefined,
          priority: dto.priority,
          plannedDate: dto.plannedDate ? new Date(dto.plannedDate) : undefined,
          commitmentDate: dto.commitmentDate ? new Date(dto.commitmentDate) : undefined,
          notes: dto.notes,
          dashboardUrl: dto.dashboardUrl,
          items: dto.items ? { create: this.mapItems(dto.items) } : undefined,
          costingHours: dto.costingHours
            ? { create: this.mapCostingHours(dto.costingHours) }
            : undefined
        },
        include: {
          items: { orderBy: { position: 'asc' } },
          costingHours: { orderBy: { position: 'asc' } },
          client: true
        }
      });

      await this.auditService.log({
        companyId: user.companyId,
        userId: user.sub,
        entityType: 'ORDER',
        entityId: id,
        action: 'UPDATE',
        before: { code: previous.code, title: previous.title } as unknown as Prisma.InputJsonValue,
        after: { code: updated.code, title: updated.title } as unknown as Prisma.InputJsonValue
      });

      return updated;
    });
  }

  // Update commercial status
  async updateCommercialStatus(user: JwtUser, id: string, dto: UpdateCommercialStatusDto) {
    const order = await this.ensureOrder(user.companyId, id);

    if (!order.commercialStatus) {
      throw new BadRequestException('Esta orden no tiene fase comercial');
    }

    if (dto.status === 'APROBADO' && order.commercialStatus !== 'APROBADO') {
      const itemCount = await this.prisma.orderItem.count({ where: { orderId: id } });
      if (itemCount === 0) {
        throw new BadRequestException('No podes aprobar un presupuesto sin items');
      }
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        commercialStatus: dto.status,
        approvedAt: dto.status === 'APROBADO' ? new Date() : null
      }
    });

    await this.auditService.log({
      companyId: user.companyId,
      userId: user.sub,
      entityType: 'ORDER',
      entityId: id,
      action: 'STATUS_CHANGE',
      before: { commercialStatus: order.commercialStatus } as unknown as Prisma.InputJsonValue,
      after: { commercialStatus: updated.commercialStatus } as unknown as Prisma.InputJsonValue
    });

    return updated;
  }

  // Approve -> activa produccion
  async approve(user: JwtUser, id: string, dto: ApproveOrderDto) {
    const order = await this.prisma.order.findFirst({
      where: { id, companyId: user.companyId },
      include: { items: true, stages: true }
    });

    if (!order) throw new NotFoundException('Orden no encontrada');

    if (!order.commercialStatus) {
      throw new BadRequestException('Esta orden no tiene fase comercial para aprobar');
    }

    if (order.items.length === 0) {
      throw new BadRequestException('No podes aprobar un presupuesto sin items');
    }

    if (order.validUntil && new Date(order.validUntil) < new Date()) {
      throw new BadRequestException('Presupuesto vencido - no se puede aprobar');
    }

    const cabinModelRevisionId = order.cabinModelRevisionId ?? dto.cabinModelRevisionId;
    if (!cabinModelRevisionId) {
      throw new BadRequestException('Seleccioná un modelo de casilla antes de aprobar el presupuesto');
    }

    if (!order.productionStatus && !dto.commitmentDate) {
      throw new BadRequestException('Ingresá la fecha compromiso antes de activar la producción');
    }

    if (order.stages.length === 0) {
      await this.instantiateStages(user, order.id, cabinModelRevisionId, []);
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        commercialStatus: 'APROBADO',
        approvedAt: new Date(),
        productionStatus: order.productionStatus ?? 'PENDIENTE',
        cabinModelRevisionId,
        priority: dto.priority ?? 3,
        commitmentDate: dto.commitmentDate ? new Date(dto.commitmentDate) : order.commitmentDate
      }
    });

    if (!order.productionStatus) {
      await this.prisma.operationLog.create({
        data: {
          companyId: user.companyId,
          orderId: id,
          userId: user.sub,
          eventType: OperationEventType.OT_CREADA,
          eventAt: new Date(),
          note: `Presupuesto aprobado -> orden ${order.code} pasa a produccion`
        }
      });
    }

    await this.auditService.log({
      companyId: user.companyId,
      userId: user.sub,
      entityType: 'ORDER',
      entityId: id,
      action: 'STATUS_CHANGE',
      before: {
        commercialStatus: order.commercialStatus,
        productionStatus: order.productionStatus
      } as unknown as Prisma.InputJsonValue,
      after: {
        commercialStatus: updated.commercialStatus,
        productionStatus: updated.productionStatus
      } as unknown as Prisma.InputJsonValue,
      metadata: { action: 'approve' } as unknown as Prisma.InputJsonValue
    });

    return this.findOne(user, id);
  }

  // Update production status
  async changeProductionStatus(user: JwtUser, id: string, dto: UpdateProductionStatusDto) {
    const order = await this.findOne(user, id);

    if (!order.productionStatus) {
      throw new BadRequestException('Esta orden no esta en fase de produccion');
    }

    if (user.role === 'OPERARIO') {
      if (!this.isUserActivelyAssigned(order, user.sub)) {
        throw new ForbiddenException('No estas asignado a esta orden');
      }
      const allowed: ProductionStatus[] = ['EN_PROCESO', 'PAUSADA', 'FINALIZADA', 'RETRABAJO'];
      if (!allowed.includes(dto.status)) {
        throw new ForbiddenException('No podes cambiar la orden a ese estado');
      }
    }

    const now = new Date();
    const data: Prisma.OrderUpdateInput = { productionStatus: dto.status };

    if (dto.status === 'EN_PROCESO' && !order.startedAt) data.startedAt = now;
    if (dto.status === 'FINALIZADA') data.finishedAt = now;
    if (dto.status === 'ENTREGADA') data.deliveredAt = now;

    const updated = await this.prisma.order.update({ where: { id }, data });

    await this.prisma.operationLog.create({
      data: {
        companyId: user.companyId,
        orderId: id,
        userId: user.sub,
        eventType: OperationEventType.CAMBIO_ESTADO,
        eventAt: now,
        note: dto.note ?? `Estado ${order.productionStatus} -> ${dto.status}`
      }
    });

    await this.auditService.log({
      companyId: user.companyId,
      userId: user.sub,
      entityType: 'ORDER',
      entityId: id,
      action: 'STATUS_CHANGE',
      before: { productionStatus: order.productionStatus } as unknown as Prisma.InputJsonValue,
      after: { productionStatus: updated.productionStatus } as unknown as Prisma.InputJsonValue
    });

    return updated;
  }

  // Assign
  async assign(user: JwtUser, orderId: string, dto: AssignOrderDto) {
    const order = await this.ensureOrder(user.companyId, orderId);

    const resource = await this.prisma.resource.findFirst({
      where: { id: dto.resourceId, companyId: user.companyId, isActive: true }
    });
    if (!resource) throw new NotFoundException('Recurso no encontrado');
    if (dto.userId) await this.ensureAssignableUser(user.companyId, dto.userId);

    const stage = dto.orderStageId
      ? await this.prisma.orderStage.findFirst({
          where: { id: dto.orderStageId, orderId, companyId: user.companyId }
        })
      : null;
    if (dto.orderStageId && !stage) throw new NotFoundException('Etapa no encontrada');

    if (stage?.isQualityGate || stage?.isDeliveryGate) {
      throw new BadRequestException('Esta etapa la gestiona directamente el dueño/supervisor y no admite asignación de responsables');
    }

    const duplicate = await this.prisma.orderAssignment.findFirst({
      where: {
        orderId,
        companyId: user.companyId,
        orderStageId: dto.orderStageId ?? null,
        resourceId: dto.resourceId,
        userId: dto.userId ?? null,
        unassignedAt: null
      }
    });
    if (duplicate) throw new BadRequestException('El responsable ya está asignado a esta etapa');

    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.orderAssignment.create({
        data: {
          companyId: user.companyId,
          orderId,
          orderStageId: dto.orderStageId ?? null,
          resourceId: dto.resourceId,
          userId: dto.userId ?? null,
          assignedByUserId: user.sub
        },
        include: {
          resource: true,
          user: { select: { id: true, fullName: true, email: true, username: true, role: true, isActive: true } },
          orderStage: true
        }
      });

      await tx.resource.update({
        where: { id: dto.resourceId },
        data: { status: 'OCUPADO' }
      });

      await tx.operationLog.create({
        data: {
          companyId: user.companyId,
          orderId,
          orderStageId: dto.orderStageId,
          userId: user.sub,
          resourceId: dto.resourceId,
          eventType: OperationEventType.ASIGNADO,
          eventAt: new Date(),
          note: stage ? `Responsable asignado a ${stage.name}` : `Asignación en ${order.code}`
        }
      });

      await this.auditService.log({
        companyId: user.companyId,
        userId: user.sub,
        entityType: 'ORDER',
        entityId: orderId,
        action: 'ASSIGN',
        metadata: {
          resourceId: dto.resourceId,
          userId: dto.userId ?? null,
          orderStageId: dto.orderStageId ?? null
        } as unknown as Prisma.InputJsonValue
      });

      if (assignment.user?.role === 'OPERARIO' && assignment.orderStage) {
        await this.notificationsService.notifyStageAssigned(tx, {
          companyId: user.companyId,
          userId: assignment.user.id,
          orderId,
          orderStageId: assignment.orderStage.id,
          orderCode: order.code,
          stageName: assignment.orderStage.name
        });
      }

      return assignment;
    });
  }


  async updateAssignment(user: JwtUser, orderId: string, assignmentId: string, dto: UpdateAssignmentDto) {
    await this.ensureOrder(user.companyId, orderId);

    const assignment = await this.prisma.orderAssignment.findFirst({
      where: { id: assignmentId, orderId, companyId: user.companyId, unassignedAt: null }
    });
    if (!assignment) throw new NotFoundException('Asignacion no encontrada');

    const nextResourceId = dto.resourceId || assignment.resourceId;
    const resource = await this.prisma.resource.findFirst({
      where: { id: nextResourceId, companyId: user.companyId, isActive: true }
    });
    if (!resource) throw new NotFoundException('Recurso no encontrado');
    if (dto.userId) await this.ensureAssignableUser(user.companyId, dto.userId);

    if (dto.orderStageId) {
      const stage = await this.prisma.orderStage.findFirst({
        where: { id: dto.orderStageId, orderId, companyId: user.companyId }
      });
      if (!stage) throw new NotFoundException('Etapa no encontrada');
      if (stage.isQualityGate || stage.isDeliveryGate) {
        throw new BadRequestException('Esta etapa la gestiona directamente el dueño/supervisor y no admite asignación de responsables');
      }
    }

    const updated = await this.prisma.orderAssignment.update({
      where: { id: assignment.id },
      data: {
        resourceId: nextResourceId,
        userId: dto.userId === undefined ? assignment.userId : dto.userId || null,
        orderStageId: dto.orderStageId ?? assignment.orderStageId
      },
      include: {
        resource: true,
        user: { select: { id: true, fullName: true, email: true, username: true, role: true, isActive: true } },
        orderStage: true
      }
    });

    await this.prisma.operationLog.create({
      data: {
        companyId: user.companyId,
        orderId,
        orderStageId: updated.orderStageId,
        userId: user.sub,
        resourceId: updated.resourceId,
        eventType: OperationEventType.ASIGNADO,
        eventAt: new Date(),
        note: updated.orderStage
          ? `Responsable actualizado en ${updated.orderStage.name}`
          : 'Asignación general actualizada'
      }
    });

    await this.auditService.log({
      companyId: user.companyId,
      userId: user.sub,
      entityType: 'ORDER',
      entityId: orderId,
      action: 'ASSIGN',
      before: {
        resourceId: assignment.resourceId,
        userId: assignment.userId,
        orderStageId: assignment.orderStageId
      } as unknown as Prisma.InputJsonValue,
      after: {
        resourceId: updated.resourceId,
        userId: updated.userId,
        orderStageId: updated.orderStageId
      } as unknown as Prisma.InputJsonValue
    });

    if (
      updated.user?.role === 'OPERARIO'
      && updated.orderStage
      && (
        updated.userId !== assignment.userId
        || updated.orderStageId !== assignment.orderStageId
      )
    ) {
      await this.notificationsService.notifyStageAssigned(this.prisma, {
        companyId: user.companyId,
        userId: updated.user.id,
        orderId,
        orderStageId: updated.orderStage.id,
        orderCode: (await this.ensureOrder(user.companyId, orderId)).code,
        stageName: updated.orderStage.name
      });
    }

    return updated;
  }

  async removeAssignment(user: JwtUser, orderId: string, assignmentId: string) {
    await this.ensureOrder(user.companyId, orderId);

    const assignment = await this.prisma.orderAssignment.findFirst({
      where: { id: assignmentId, orderId, companyId: user.companyId, unassignedAt: null }
    });
    if (!assignment) throw new NotFoundException('Asignacion no encontrada');

    const updated = await this.prisma.orderAssignment.update({
      where: { id: assignment.id },
      data: { unassignedAt: new Date() }
    });

    await this.prisma.operationLog.create({
      data: {
        companyId: user.companyId,
        orderId,
        orderStageId: assignment.orderStageId,
        userId: user.sub,
        resourceId: assignment.resourceId,
        eventType: OperationEventType.ASIGNADO,
        eventAt: new Date(),
        note: 'Responsable quitado de la etapa'
      }
    });

    await this.auditService.log({
      companyId: user.companyId,
      userId: user.sub,
      entityType: 'ORDER',
      entityId: orderId,
      action: 'ASSIGN',
      before: {
        resourceId: assignment.resourceId,
        userId: assignment.userId
      } as unknown as Prisma.InputJsonValue,
      after: { unassignedAt: updated.unassignedAt } as unknown as Prisma.InputJsonValue
    });

    return { message: 'Asignacion eliminada' };
  }
  // Add event
  private static readonly MANUAL_FLOW_EVENTS = new Set<OperationEventType>([
    OperationEventType.INICIO,
    OperationEventType.PAUSA,
    OperationEventType.REANUDACION,
    OperationEventType.FINALIZACION
  ]);

  async addEvent(user: JwtUser, id: string, dto: AddEventDto) {
    const order = await this.findOne(user, id);

    if (user.role === 'OPERARIO' && !this.isUserActivelyAssigned(order, user.sub)) {
      throw new ForbiddenException('No estas asignado a esta orden');
    }

    // El estado de la orden se deriva de sus etapas (ver releaseStagesAndRecalculate).
    // Un gestor no puede forzar inicio/pausa/reanudación/finalización a mano.
    if (user.role !== 'OPERARIO' && OrdersService.MANUAL_FLOW_EVENTS.has(dto.eventType)) {
      throw new ForbiddenException(
        'El estado de la orden se calcula a partir de sus etapas. Trabajá las etapas correspondientes en vez de forzar el estado.'
      );
    }

    if (
      dto.eventType === OperationEventType.INICIO ||
      dto.eventType === OperationEventType.REANUDACION
    ) {
      await this.prisma.order.update({
        where: { id },
        data: {
          productionStatus: 'EN_PROCESO',
          startedAt: order.startedAt ?? new Date()
        }
      });
    }

    if (dto.eventType === OperationEventType.PAUSA) {
      await this.prisma.order.update({
        where: { id },
        data: { productionStatus: 'PAUSADA' }
      });
    }

    return this.prisma.operationLog.create({
      data: {
        companyId: user.companyId,
        orderId: id,
        resourceId: dto.resourceId,
        userId: user.sub,
        eventType: dto.eventType,
        eventAt: new Date(),
        pauseReason: dto.pauseReason,
        note: dto.note
      }
    });
  }

  // Add consumption
  async addConsumption(user: JwtUser, id: string, dto: AddConsumptionDto) {
    const order = await this.findOne(user, id);

    const stage = dto.orderStageId
      ? order.stages.find((item) => item.id === dto.orderStageId)
      : null;
    if (dto.orderStageId && !stage) {
      throw new BadRequestException('La etapa no pertenece a esta orden');
    }
    if (user.role === 'OPERARIO') {
      if (!stage) {
        throw new BadRequestException('Selecciona la etapa en la que consumiste el material');
      }
      const assignedToStage = stage.assignments.some(
        (assignment) => assignment.userId === user.sub && assignment.unassignedAt === null
      );
      if (!assignedToStage) {
        throw new ForbiddenException('No estas asignado a esta etapa');
      }
      if (['BLOQUEADA', 'COMPLETADA', 'CANCELADA'].includes(stage.status)) {
        throw new BadRequestException('No se pueden registrar consumos en esta etapa');
      }
    }

    const material = await this.prisma.material.findFirst({
      where: { id: dto.materialId, companyId: user.companyId, isActive: true }
    });
    if (!material) throw new NotFoundException('Material no encontrado');
    if (Number(material.stock) < dto.quantity) {
      throw new BadRequestException('Stock insuficiente');
    }

    return this.prisma.$transaction(async (tx) => {
      const consumption = await tx.materialConsumption.create({
        data: {
          companyId: user.companyId,
          orderId: id,
          materialId: material.id,
          createdByUserId: user.sub,
          quantity: dto.quantity,
          unitCostSnapshot: Number(material.unitCost),
          note: dto.note,
          orderStageId: stage?.id
        }
      });

      await tx.material.update({
        where: { id: material.id },
        data: { stock: Number(material.stock) - dto.quantity }
      });

      await tx.materialMovement.create({
        data: {
          companyId: user.companyId,
          materialId: material.id,
          type: 'CONSUMO',
          quantity: -Math.abs(dto.quantity),
          unitCost: Number(material.unitCost),
          note: `Consumo en ${order.code}`
        }
      });

      await tx.operationLog.create({
        data: {
          companyId: user.companyId,
          orderId: id,
          userId: user.sub,
          orderStageId: stage?.id,
          eventType: OperationEventType.MATERIAL_CONSUMIDO,
          eventAt: new Date(),
          note: `${dto.quantity} ${material.unit} de ${material.name}`
        }
      });

      await this.auditService.log({
        companyId: user.companyId,
        userId: user.sub,
        entityType: 'ORDER',
        entityId: id,
        action: 'UPDATE',
        metadata: {
          consumption: { materialId: material.id, quantity: dto.quantity }
        } as unknown as Prisma.InputJsonValue
      });

      return consumption;
    });
  }


  async updateConsumption(user: JwtUser, orderId: string, consumptionId: string, dto: UpdateConsumptionDto) {
    const order = await this.findOne(user, orderId);

    if (user.role === 'OPERARIO' && !this.isUserActivelyAssigned(order, user.sub)) {
      throw new ForbiddenException('No estas asignado a esta orden');
    }

    const consumption = await this.prisma.materialConsumption.findFirst({
      where: { id: consumptionId, orderId, companyId: user.companyId },
      include: { material: true }
    });
    if (!consumption) throw new NotFoundException('Consumo no encontrado');
    if (user.role === 'OPERARIO' && consumption.createdByUserId !== user.sub) {
      throw new ForbiddenException('Solo podes modificar consumos registrados por vos');
    }

    const nextMaterialId = dto.materialId || consumption.materialId;
    const nextQuantity = dto.quantity ?? Number(consumption.quantity);
    const nextMaterial = await this.prisma.material.findFirst({
      where: { id: nextMaterialId, companyId: user.companyId, isActive: true }
    });
    if (!nextMaterial) throw new NotFoundException('Material no encontrado');

    return this.prisma.$transaction(async (tx) => {
      if (nextMaterialId === consumption.materialId) {
        const delta = nextQuantity - Number(consumption.quantity);
        if (delta > 0 && Number(nextMaterial.stock) < delta) {
          throw new BadRequestException('Stock insuficiente');
        }
        if (delta !== 0) {
          await tx.material.update({
            where: { id: nextMaterial.id },
            data: { stock: Number(nextMaterial.stock) - delta }
          });
        }
      } else {
        if (Number(nextMaterial.stock) < nextQuantity) {
          throw new BadRequestException('Stock insuficiente');
        }
        await tx.material.update({
          where: { id: consumption.materialId },
          data: { stock: Number(consumption.material.stock) + Number(consumption.quantity) }
        });
        await tx.material.update({
          where: { id: nextMaterial.id },
          data: { stock: Number(nextMaterial.stock) - nextQuantity }
        });
      }

      const updated = await tx.materialConsumption.update({
        where: { id: consumption.id },
        data: {
          materialId: nextMaterial.id,
          quantity: nextQuantity,
          unitCostSnapshot: Number(nextMaterial.unitCost),
          note: dto.note === undefined ? consumption.note : dto.note || null
        },
        include: {
          material: true,
          createdByUser: { select: { id: true, fullName: true, role: true } }
        }
      });

      await tx.materialMovement.create({
        data: {
          companyId: user.companyId,
          materialId: nextMaterial.id,
          type: 'AJUSTE',
          quantity: 0,
          unitCost: Number(nextMaterial.unitCost),
          note: `Ajuste de consumo en ${order.code}`
        }
      });

      await this.auditService.log({
        companyId: user.companyId,
        userId: user.sub,
        entityType: 'ORDER',
        entityId: orderId,
        action: 'UPDATE',
        before: {
          materialId: consumption.materialId,
          quantity: Number(consumption.quantity),
          note: consumption.note
        } as unknown as Prisma.InputJsonValue,
        after: {
          materialId: updated.materialId,
          quantity: Number(updated.quantity),
          note: updated.note
        } as unknown as Prisma.InputJsonValue
      });

      return updated;
    });
  }

  async removeConsumption(user: JwtUser, orderId: string, consumptionId: string) {
    const order = await this.findOne(user, orderId);

    if (user.role === 'OPERARIO' && !this.isUserActivelyAssigned(order, user.sub)) {
      throw new ForbiddenException('No estas asignado a esta orden');
    }

    const consumption = await this.prisma.materialConsumption.findFirst({
      where: { id: consumptionId, orderId, companyId: user.companyId },
      include: { material: true }
    });
    if (!consumption) throw new NotFoundException('Consumo no encontrado');
    if (user.role === 'OPERARIO' && consumption.createdByUserId !== user.sub) {
      throw new ForbiddenException('Solo podes eliminar consumos registrados por vos');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.material.update({
        where: { id: consumption.materialId },
        data: { stock: Number(consumption.material.stock) + Number(consumption.quantity) }
      });
      await tx.materialMovement.create({
        data: {
          companyId: user.companyId,
          materialId: consumption.materialId,
          type: 'AJUSTE',
          quantity: Number(consumption.quantity),
          unitCost: Number(consumption.unitCostSnapshot),
          note: `Reversion de consumo en ${order.code}`
        }
      });
      await tx.materialConsumption.delete({ where: { id: consumption.id } });
    });

    await this.auditService.log({
      companyId: user.companyId,
      userId: user.sub,
      entityType: 'ORDER',
      entityId: orderId,
      action: 'UPDATE',
      before: {
        materialId: consumption.materialId,
        quantity: Number(consumption.quantity)
      } as unknown as Prisma.InputJsonValue,
      after: { removedConsumptionId: consumption.id } as unknown as Prisma.InputJsonValue
    });

    return { message: 'Consumo eliminado' };
  }
  // Close delivery
  async closeDelivery(user: JwtUser, id: string, dto: CloseDeliveryDto) {
    const order = await this.findOne(user, id);

    if (!order.productionStatus || !['FINALIZADA', 'ENTREGADA'].includes(order.productionStatus)) {
      throw new BadRequestException('Solo se puede cerrar entrega sobre una orden finalizada');
    }

    const settings = await this.getCompanySettings(user.companyId);
    if (settings.requireDeliveryChecklist && !dto.deliveryChecklist?.trim()) {
      throw new BadRequestException('Debes completar checklist de entrega para cerrar la orden');
    }

    const deliveredAt = dto.deliveredAt ? new Date(dto.deliveredAt) : new Date();

    const deliveryStage = await this.prisma.orderStage.findFirst({
      where: { orderId: id, isDeliveryGate: true }
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      if (deliveryStage && deliveryStage.status !== 'COMPLETADA') {
        await tx.orderStage.update({
          where: { id: deliveryStage.id },
          data: { status: 'COMPLETADA', progressPct: 100, finishedAt: deliveredAt }
        });
      }
      return tx.order.update({
        where: { id },
        data: {
          productionStatus: 'ENTREGADA',
          deliveredAt,
          closedAt: new Date(),
          closedByUserId: user.sub,
          deliveryChecklist: dto.deliveryChecklist?.trim() || null,
          deliveryNote: dto.deliveryNote?.trim() || null,
          isSigned: dto.isSigned === true || (dto.isSigned as any) === 'true'
        }
      });
    });

    await this.prisma.operationLog.create({
      data: {
        companyId: user.companyId,
        orderId: id,
        userId: user.sub,
        eventType: OperationEventType.CAMBIO_ESTADO,
        eventAt: new Date(),
        note: `Cierre de entrega registrado. ${order.productionStatus} -> ENTREGADA`
      }
    });

    await this.auditService.log({
      companyId: user.companyId,
      userId: user.sub,
      entityType: 'ORDER',
      entityId: id,
      action: 'DELIVERY_CLOSE',
      before: {
        productionStatus: order.productionStatus,
        deliveredAt: order.deliveredAt
      } as unknown as Prisma.InputJsonValue,
      after: {
        productionStatus: updated.productionStatus,
        deliveredAt: updated.deliveredAt
      } as unknown as Prisma.InputJsonValue
    });

    return updated;
  }

  // Attachments
  async addAttachment(
    companyId: string,
    orderId: string,
    file: { filename: string; originalname: string; mimetype: string; size: number },
    actorUserId: string,
    isInternal = false
  ) {
    await this.ensureOrder(companyId, orderId);

    const attachment = await this.prisma.orderAttachment.create({
      data: {
        orderId,
        fileName: file.originalname,
        fileUrl: `secure:${file.filename}`,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        isInternal
      }
    });

    await this.auditService.log({
      companyId,
      userId: actorUserId,
      entityType: 'ORDER',
      entityId: orderId,
      action: 'UPDATE',
      after: {
        attachment: attachment.fileName,
        visibility: attachment.isInternal ? 'INTERNAL' : 'OPERATORS'
      } as unknown as Prisma.InputJsonValue
    });

    return attachment;
  }

  private attachmentFileCandidates(fileUrl: string) {
    const isSecure = fileUrl.startsWith('secure:');
    const storedName = isSecure
      ? fileUrl.slice('secure:'.length)
      : fileUrl.replace(/^[/\\]*uploads[/\\]/, '');
    const roots = isSecure
      ? [resolve(process.cwd(), 'data/uploads')]
      : [
          resolve(process.cwd(), 'public/uploads'),
          // Las instalaciones anteriores guardaban /uploads en el mismo volumen
          // que ahora se monta como almacenamiento privado.
          resolve(process.cwd(), 'data/uploads')
        ];

    return roots.map((root) => {
      const absolutePath = resolve(root, storedName);
      if (!storedName || !absolutePath.startsWith(`${root}${sep}`)) {
        throw new BadRequestException('Ruta de adjunto inválida');
      }
      return absolutePath;
    });
  }

  async getAttachmentFile(user: JwtUser, orderId: string, attachmentId: string) {
    await this.findOne(user, orderId);
    const attachment = await this.prisma.orderAttachment.findFirst({
      where: { id: attachmentId, orderId }
    });
    if (!attachment || (user.role === 'OPERARIO' && attachment.isInternal)) {
      throw new NotFoundException('Adjunto no encontrado');
    }

    let absolutePath: string | undefined;
    for (const candidate of this.attachmentFileCandidates(attachment.fileUrl)) {
      try {
        const fileStats = await stat(candidate);
        if (fileStats.isFile()) {
          absolutePath = candidate;
          break;
        }
      } catch {}
    }
    if (!absolutePath) {
      throw new NotFoundException('El archivo adjunto no está disponible');
    }
    return { ...attachment, absolutePath };
  }

  async removeAttachment(companyId: string, orderId: string, attachmentId: string, actorUserId: string) {
    await this.ensureOrder(companyId, orderId);

    const attachment = await this.prisma.orderAttachment.findFirst({
      where: { id: attachmentId, orderId }
    });

    if (!attachment) throw new NotFoundException('Adjunto no encontrado');

    // Try to delete file from disk
    try {
      const { unlink } = require('fs/promises');
      for (const filePath of this.attachmentFileCandidates(attachment.fileUrl)) {
        try {
          await unlink(filePath);
          break;
        } catch (error: any) {
          if (error?.code !== 'ENOENT') throw error;
        }
      }
    } catch (e) {}

    await this.prisma.orderAttachment.delete({ where: { id: attachmentId } });

    await this.auditService.log({
      companyId,
      userId: actorUserId,
      entityType: 'ORDER',
      entityId: orderId,
      action: 'UPDATE',
      after: { removedAttachment: attachment.fileName } as unknown as Prisma.InputJsonValue
    });

    return { message: 'Adjunto eliminado' };
  }

  async updateAttachment(
    companyId: string,
    orderId: string,
    attachmentId: string,
    dto: UpdateAttachmentDto,
    actorUserId: string
  ) {
    await this.ensureOrder(companyId, orderId);

    const attachment = await this.prisma.orderAttachment.findFirst({
      where: { id: attachmentId, orderId }
    });
    if (!attachment) throw new NotFoundException('Adjunto no encontrado');

    const updated = await this.prisma.orderAttachment.update({
      where: { id: attachmentId },
      data: { fileName: dto.fileName.trim() }
    });

    await this.auditService.log({
      companyId,
      userId: actorUserId,
      entityType: 'ORDER',
      entityId: orderId,
      action: 'UPDATE',
      before: { attachment: attachment.fileName } as unknown as Prisma.InputJsonValue,
      after: { attachment: updated.fileName } as unknown as Prisma.InputJsonValue
    });

    return updated;
  }

  // Remove
  async remove(user: JwtUser, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        materialConsumptions: true,
        assignments: { where: { unassignedAt: null }, select: { resourceId: true } }
      }
    });

    if (!order) throw new NotFoundException('Orden no encontrada');

    if (order.productionStatus === 'EN_PROCESO') {
      throw new BadRequestException('No se puede eliminar una orden en proceso. Primero pausala o cancelala.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Revert material consumptions
      for (const consumption of order.materialConsumptions) {
        const material = await tx.material.findFirst({
          where: { id: consumption.materialId, companyId: user.companyId }
        });
        if (!material) continue;

        const qty = Number(consumption.quantity);
        await tx.material.update({
          where: { id: material.id },
          data: { stock: Number(material.stock) + qty }
        });
        await tx.materialMovement.create({
          data: {
            companyId: user.companyId,
            materialId: material.id,
            type: 'AJUSTE',
            quantity: qty,
            unitCost: Number(consumption.unitCostSnapshot),
            note: `Reversion por eliminacion de ${order.code}`
          }
        });
      }

      const resourceIds = Array.from(new Set(order.assignments.map((a) => a.resourceId)));
      await tx.order.delete({ where: { id } });

      for (const resourceId of resourceIds) {
        const active = await tx.orderAssignment.count({
          where: { companyId: user.companyId, resourceId, unassignedAt: null }
        });
        if (active === 0) {
          await tx.resource.updateMany({
            where: { id: resourceId, companyId: user.companyId },
            data: { status: 'DISPONIBLE' }
          });
        }
      }

      await this.auditService.log({
        companyId: user.companyId,
        userId: user.sub,
        entityType: 'ORDER',
        entityId: id,
        action: 'DELETE',
        before: { code: order.code, productionStatus: order.productionStatus } as unknown as Prisma.InputJsonValue
      });

      return { message: 'Orden eliminada correctamente' };
    });
  }

  // Helpers
  private async ensureOrder(companyId: string, id: string) {
    const order = await this.prisma.order.findFirst({ where: { id, companyId } });
    if (!order) throw new NotFoundException('Orden no encontrada');
    return order;
  }

  private async ensureClient(companyId: string, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, companyId, isActive: true },
      select: { id: true }
    });
    if (!client) throw new BadRequestException('Cliente no encontrado para esta empresa');
    return client;
  }

  private async ensureCabinModelRevision(companyId: string, id: string) {
    const revision = await this.prisma.cabinModelRevision.findFirst({
      where: { id, isActive: true, cabinModel: { companyId, isActive: true } },
      select: { id: true }
    });
    if (!revision) throw new BadRequestException('Modelo de casilla no encontrado para esta empresa');
    return revision;
  }

  private async ensureAssignableUser(companyId: string, id: string) {
    const assignedUser = await this.prisma.user.findFirst({
      where: { id, companyId, isActive: true },
      select: { id: true }
    });
    if (!assignedUser) throw new BadRequestException('Usuario no encontrado para esta empresa');
    return assignedUser;
  }

  private sanitizeOrderForOperator<T extends Record<string, any>>(order: T) {
    const {
      estimatedCost,
      estimatedMaterials,
      items,
      costingHours,
      dashboardUrl,
      ...safeOrder
    } = order;
    return {
      ...safeOrder,
      client: order.client ? { id: order.client.id, name: order.client.name } : order.client,
      materialConsumptions: order.materialConsumptions?.map((consumption: Record<string, any>) => {
        const { unitCostSnapshot, material, ...safeConsumption } = consumption;
        return {
          ...safeConsumption,
          material: material
            ? { id: material.id, name: material.name, unit: material.unit }
            : material
        };
      })
    };
  }

  private async getCompanySettings(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { settings: true }
    });
    if (!company?.settings || typeof company.settings !== 'object') {
      return DEFAULT_COMPANY_SETTINGS;
    }
    return {
      ...DEFAULT_COMPANY_SETTINGS,
      ...(company.settings as Partial<typeof DEFAULT_COMPANY_SETTINGS>)
    };
  }

  private mapItems(items: OrderItemInputDto[]) {
    return items.map((item, index) => ({
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      estimatedUnitCost: item.estimatedUnitCost,
      estimatedHoursMin: item.estimatedHoursMin,
      position: index
    }));
  }

  private mapCostingHours(hours: CostingHourInputDto[]) {
    return hours.map((h, index) => ({
      label: h.label,
      hours: h.hours,
      ratePerHour: h.ratePerHour,
      position: index
    }));
  }
}
