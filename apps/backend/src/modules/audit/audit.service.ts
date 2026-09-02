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
}
