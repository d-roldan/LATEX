import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import * as bcrypt from 'bcrypt';
import { Prisma, UserRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { JwtUser } from '../../common/auth/jwt-user.interface';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  getStatus() {
    return { module: 'users', status: 'ready' };
  }

  private assertCanManageTarget(
    target: { id: string; isProtected: boolean; isSystemOwner: boolean },
    actor?: JwtUser
  ) {
    if (!target.isProtected && !target.isSystemOwner) {
      return;
    }

    if (actor?.isSystemOwner && actor.sub !== target.id) {
      return;
    }

    throw new BadRequestException(
      'Este usuario de seguridad no se puede modificar desde la gestion normal'
    );
  }

  private async ensureOperatorResource(
    companyId: string,
    fullName: string,
    isActive = true,
    previousFullName?: string,
    linkedUserId?: string
  ) {
    const name = fullName.trim();
    const previousName = previousFullName?.trim();
    if (!name) return;

    const status = isActive ? 'DISPONIBLE' : 'FUERA_DE_LINEA';

    if (previousName && previousName !== name) {
      const previousResource = await this.prisma.resource.findFirst({
        where: { companyId, type: 'HUMANO', name: previousName }
      });

      if (previousResource) {
        return this.prisma.resource.update({
          where: { id: previousResource.id },
          data: { name, isActive, status, linkedUserId }
        });
      }
    }

    const existing = await this.prisma.resource.findFirst({
      where: { companyId, type: 'HUMANO', name }
    });

    if (existing) {
      return this.prisma.resource.update({
        where: { id: existing.id },
        data: {
          isActive,
          linkedUserId,
          status: existing.status === 'OCUPADO' && isActive ? existing.status : status
        }
      });
    }

    return this.prisma.resource.create({
      data: {
        companyId,
        type: 'HUMANO',
        name,
        sector: 'Operarios',
        status,
        isActive,
        notes: 'Recurso humano creado automaticamente desde usuarios',
        linkedUserId
      }
    });
  }

  private async deactivateOperatorResource(companyId: string, fullName: string) {
    const name = fullName.trim();
    if (!name) return;

    await this.prisma.resource.updateMany({
      where: { companyId, type: 'HUMANO', name },
      data: { isActive: false, status: 'FUERA_DE_LINEA' }
    });
  }

  private normalizeUsername(username: string) {
    return username.trim().toLowerCase();
  }

  async findAll(companyId: string, actor: JwtUser, role?: string, active?: string) {
    return this.prisma.user.findMany({
      where: {
        companyId,
        role: role && role in UserRole ? (role as UserRole) : undefined,
        isActive: active === undefined ? undefined : active === 'true',
        isSystemOwner: actor.isSystemOwner ? undefined : false
      },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        isProtected: actor.isSystemOwner,
        isSystemOwner: actor.isSystemOwner,
        createdAt: true,
        plantAccesses: {
          select: {
            plant: { select: { id: true, code: true, name: true } }
          },
          orderBy: { plant: { displayOrder: 'asc' } }
        }
      },
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }]
    });
  }

  async availablePlants(companyId: string) {
    return this.prisma.plant.findMany({
      where: { companyId, isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }]
    });
  }

  async create(companyId: string, dto: CreateUserDto, actorUserId?: string) {
    if (
      !['FABRICACION', 'LABORATORIO', 'ENVASADO', 'MONITOREO', 'JEFATURA', 'ADMIN'].includes(
        dto.role
      )
    ) {
      throw new BadRequestException('Rol no habilitado para la planta');
    }
    const username = this.normalizeUsername(dto.username);
    const existing = await this.prisma.user.findFirst({
      where: {
        companyId,
        OR: [{ email: dto.email.toLowerCase() }, { username }]
      }
    });

    if (existing) {
      throw new BadRequestException(
        existing.email === dto.email.toLowerCase()
          ? 'Ya existe un usuario con ese email'
          : 'Ya existe un usuario con ese nombre de usuario'
      );
    }

    const availablePlants = await this.prisma.plant.findMany({
      where: { companyId, isActive: true, id: { in: dto.plantIds } },
      select: { id: true }
    });

    if (availablePlants.length !== dto.plantIds.length) {
      throw new BadRequestException('Una o más plantas no existen o no pertenecen a la empresa');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const created = await this.prisma.user.create({
      data: {
        companyId,
        email: dto.email.toLowerCase(),
        username,
        fullName: dto.fullName,
        role: dto.role,
        passwordHash,
        plantAccesses: {
          create: dto.plantIds.map((plantId) => ({ plantId }))
        }
      },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        plantAccesses: {
          select: {
            plant: { select: { id: true, code: true, name: true } }
          }
        }
      }
    });

    await this.auditService.log({
      companyId,
      userId: actorUserId,
      entityType: 'USER',
      entityId: created.id,
      action: 'CREATE',
      after: created as unknown as Prisma.InputJsonValue
    });

    if (created.role === 'OPERARIO') {
      await this.ensureOperatorResource(
        companyId,
        created.fullName,
        created.isActive,
        undefined,
        created.id
      );
    }

    return created;
  }

  async toggleActive(companyId: string, id: string, actorUserId?: string, actor?: JwtUser) {
    const user = await this.prisma.user.findFirst({ where: { id, companyId } });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    this.assertCanManageTarget(user, actor);

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive, sessionVersion: { increment: 1 } },
      select: {
        id: true,
        fullName: true,
        role: true,
        isActive: true
      }
    });

    await this.auditService.log({
      companyId,
      userId: actorUserId,
      entityType: 'USER',
      entityId: id,
      action: 'UPDATE',
      before: { isActive: user.isActive } as unknown as Prisma.InputJsonValue,
      after: { isActive: updated.isActive } as unknown as Prisma.InputJsonValue
    });

    if (user.role === 'OPERARIO') {
      await this.ensureOperatorResource(
        companyId,
        updated.fullName,
        updated.isActive,
        undefined,
        updated.id
      );
    }

    return updated;
  }

  async updateRole(
    companyId: string,
    id: string,
    role: UserRole,
    actorUserId?: string,
    actor?: JwtUser
  ) {
    const user = await this.prisma.user.findFirst({ where: { id, companyId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    this.assertCanManageTarget(user, actor);

    if (
      !['FABRICACION', 'LABORATORIO', 'ENVASADO', 'MONITOREO', 'JEFATURA', 'ADMIN'].includes(role)
    ) {
      throw new BadRequestException(
        'Solo se permiten perfiles FABRICACION, LABORATORIO, ENVASADO, MONITOREO, JEFATURA o ADMIN'
      );
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { role, sessionVersion: { increment: 1 } },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true
      }
    });

    await this.auditService.log({
      companyId,
      userId: actorUserId,
      entityType: 'USER',
      entityId: id,
      action: 'ROLE_CHANGE',
      before: { role: user.role } as unknown as Prisma.InputJsonValue,
      after: { role: updated.role } as unknown as Prisma.InputJsonValue
    });

    if (updated.role === 'OPERARIO') {
      await this.ensureOperatorResource(
        companyId,
        updated.fullName,
        updated.isActive,
        undefined,
        updated.id
      );
    } else if (user.role === 'OPERARIO') {
      await this.deactivateOperatorResource(companyId, user.fullName);
    }

    return updated;
  }

  async updateProfile(
    companyId: string,
    id: string,
    dto: UpdateUserProfileDto,
    actorUserId?: string,
    actor?: JwtUser
  ) {
    const user = await this.prisma.user.findFirst({ where: { id, companyId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    this.assertCanManageTarget(user, actor);

    if (dto.email && dto.email.toLowerCase() !== user.email) {
      const existing = await this.prisma.user.findFirst({
        where: { companyId, email: dto.email.toLowerCase() }
      });
      if (existing) {
        throw new BadRequestException('Ya existe un usuario con ese email');
      }
    }

    const username = dto.username ? this.normalizeUsername(dto.username) : undefined;
    if (username && username !== user.username) {
      const existing = await this.prisma.user.findFirst({
        where: { companyId, username }
      });
      if (existing) {
        throw new BadRequestException('Ya existe un usuario con ese nombre de usuario');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        fullName: dto.fullName ?? undefined,
        email: dto.email ? dto.email.toLowerCase() : undefined,
        username
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        username: true,
        role: true,
        isActive: true
      }
    });

    await this.auditService.log({
      companyId,
      userId: actorUserId,
      entityType: 'USER',
      entityId: id,
      action: 'UPDATE',
      before: {
        fullName: user.fullName,
        email: user.email,
        username: user.username
      } as unknown as Prisma.InputJsonValue,
      after: {
        fullName: updated.fullName,
        email: updated.email,
        username: updated.username
      } as unknown as Prisma.InputJsonValue
    });

    if (user.role === 'OPERARIO') {
      await this.ensureOperatorResource(
        companyId,
        updated.fullName,
        updated.isActive,
        user.fullName,
        updated.id
      );
    }

    return updated;
  }

  async updatePlants(
    companyId: string,
    id: string,
    plantIds: string[],
    actorUserId?: string,
    actor?: JwtUser
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id, companyId },
      include: {
        plantAccesses: {
          select: { plantId: true }
        }
      }
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    this.assertCanManageTarget(user, actor);

    const availablePlants = await this.prisma.plant.findMany({
      where: { companyId, isActive: true, id: { in: plantIds } },
      select: { id: true }
    });

    if (availablePlants.length !== plantIds.length) {
      throw new BadRequestException('Una o más plantas no existen o no pertenecen a la empresa');
    }

    const previousPlantIds = user.plantAccesses.map((access) => access.plantId);
    const currentPlantIds = new Set(previousPlantIds);
    const requestedPlantIds = new Set(plantIds);
    const plantIdsToAdd = plantIds.filter((plantId) => !currentPlantIds.has(plantId));
    const plantIdsToRemove = previousPlantIds.filter((plantId) => !requestedPlantIds.has(plantId));

    await this.prisma.$transaction(async (tx) => {
      if (plantIdsToRemove.length > 0) {
        await tx.userPlantAccess.deleteMany({
          where: { userId: id, plantId: { in: plantIdsToRemove } }
        });
      }

      if (plantIdsToAdd.length > 0) {
        await tx.userPlantAccess.createMany({
          data: plantIdsToAdd.map((plantId) => ({ userId: id, plantId })),
          skipDuplicates: true
        });
      }
    });

    await this.auditService.log({
      companyId,
      userId: actorUserId,
      entityType: 'USER',
      entityId: id,
      action: 'ASSIGN',
      before: { plantIds: previousPlantIds } as unknown as Prisma.InputJsonValue,
      after: { plantIds } as unknown as Prisma.InputJsonValue
    });

    return { id, plantIds };
  }

  async updatePassword(
    companyId: string,
    id: string,
    password: string,
    actorUserId?: string,
    actor?: JwtUser
  ) {
    const user = await this.prisma.user.findFirst({ where: { id, companyId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    this.assertCanManageTarget(user, actor);

    const passwordHash = await bcrypt.hash(password, 10);

    const updated = await this.prisma.user.update({
      where: { id },
      data: { passwordHash, sessionVersion: { increment: 1 } },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true
      }
    });

    await this.auditService.log({
      companyId,
      userId: actorUserId,
      entityType: 'USER',
      entityId: id,
      action: 'PASSWORD_CHANGE',
      metadata: {
        message: 'Password reseteada por gestion de recursos'
      } as unknown as Prisma.InputJsonValue
    });

    return updated;
  }

  async remove(companyId: string, id: string, actorUserId?: string, actor?: JwtUser) {
    const user = await this.prisma.user.findFirst({ where: { id, companyId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    this.assertCanManageTarget(user, actor);

    await this.auditService.log({
      companyId,
      userId: actorUserId,
      entityType: 'USER',
      entityId: id,
      action: 'DELETE',
      before: {
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive
      } as unknown as Prisma.InputJsonValue
    });

    try {
      const deleted = await this.prisma.user.delete({
        where: { id },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isActive: true
        }
      });

      if (user.role === 'OPERARIO') {
        await this.deactivateOperatorResource(companyId, user.fullName);
      }

      return deleted;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code !== 'P2003') {
        throw error;
      }

      const deactivated = await this.prisma.user.update({
        where: { id },
        data: { isActive: false },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isActive: true
        }
      });

      if (user.role === 'OPERARIO') {
        await this.deactivateOperatorResource(companyId, user.fullName);
      }

      return deactivated;
    }
  }
}
