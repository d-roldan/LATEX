import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { Prisma, ResourceStatus, ResourceType } from '@prisma/client';

@Injectable()
export class ResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  getStatus() {
    return { module: 'resources', status: 'ready' };
  }

  async findAll(companyId: string, type?: string, status?: string, search?: string) {
    const where: Prisma.ResourceWhereInput = {
      companyId,
      isActive: true,
      type: type && type in ResourceType ? (type as ResourceType) : undefined,
      status: status && status in ResourceStatus ? (status as ResourceStatus) : undefined
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sector: { contains: search, mode: 'insensitive' } }
      ];
    }

    return this.prisma.resource.findMany({
      where,
      orderBy: [{ type: 'asc' }, { name: 'asc' }]
    });
  }

  async create(companyId: string, dto: CreateResourceDto) {
    return this.prisma.resource.create({
      data: {
        companyId,
        ...dto
      }
    });
  }

  async update(companyId: string, id: string, dto: UpdateResourceDto) {
    await this.ensureExists(companyId, id);

    return this.prisma.resource.update({
      where: { id },
      data: dto
    });
  }

  async remove(companyId: string, id: string) {
    await this.ensureExists(companyId, id);

    return this.prisma.resource.update({
      where: { id },
      data: { isActive: false, status: 'FUERA_DE_LINEA' }
    });
  }

  private async ensureExists(companyId: string, id: string) {
    const item = await this.prisma.resource.findFirst({
      where: {
        id,
        companyId,
        isActive: true
      }
    });

    if (!item) {
      throw new NotFoundException('Recurso no encontrado');
    }

    return item;
  }
}

