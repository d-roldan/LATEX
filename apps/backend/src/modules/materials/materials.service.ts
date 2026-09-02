import {
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';

@Injectable()
export class MaterialsService {
  constructor(private readonly prisma: PrismaService) {}

  getStatus() {
    return { module: 'materials', status: 'ready' };
  }

  async findAll(companyId: string, search?: string, includeSensitive = true) {
    const where: Prisma.MaterialWhereInput = {
      companyId,
      isActive: true
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (!includeSensitive) {
      return this.prisma.material.findMany({
        where,
        select: { id: true, name: true, category: true, unit: true, stock: true, isActive: true },
        orderBy: { name: 'asc' }
      });
    }

    return this.prisma.material.findMany({
      where,
      include: {
        movements: {
          take: 8,
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { name: 'asc' }
    });
  }

  async create(companyId: string, dto: CreateMaterialDto) {
    return this.prisma.material.create({
      data: {
        companyId,
        ...dto,
        movements: {
          create: {
            companyId,
            type: 'ENTRADA',
            quantity: dto.stock,
            unitCost: dto.unitCost,
            note: 'Stock inicial'
          }
        }
      }
    });
  }

  async update(companyId: string, id: string, dto: UpdateMaterialDto) {
    await this.ensureExists(companyId, id);

    return this.prisma.material.update({
      where: { id },
      data: dto
    });
  }

  async adjustStock(companyId: string, id: string, dto: AdjustStockDto) {
    const material = await this.ensureExists(companyId, id);

    const updatedStock = Number(material.stock) + dto.quantity;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.material.update({
        where: { id },
        data: { stock: updatedStock }
      });

      await tx.materialMovement.create({
        data: {
          companyId,
          materialId: id,
          type: 'AJUSTE',
          quantity: dto.quantity,
          unitCost: dto.unitCost,
          note: dto.note
        }
      });

      return updated;
    });
  }

  async remove(companyId: string, id: string) {
    await this.ensureExists(companyId, id);

    return this.prisma.material.update({
      where: { id },
      data: { isActive: false }
    });
  }

  private async ensureExists(companyId: string, id: string) {
    const item = await this.prisma.material.findFirst({
      where: {
        id,
        companyId,
        isActive: true
      }
    });

    if (!item) {
      throw new NotFoundException('Material no encontrado');
    }

    return item;
  }
}

