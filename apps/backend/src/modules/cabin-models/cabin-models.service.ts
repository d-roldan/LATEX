import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CabinModelsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId: string) {
    return this.prisma.cabinModel.findMany({
      where: { companyId, isActive: true },
      include: {
        revisions: {
          where: { isActive: true },
          include: {
            stages: {
              orderBy: { position: 'asc' },
              include: {
                dependencies: {
                  include: {
                    dependsOnStage: { select: { id: true, code: true, name: true } }
                  }
                }
              }
            }
          },
          orderBy: [{ isDefault: 'desc' }, { version: 'desc' }]
        }
      },
      orderBy: { code: 'asc' }
    });
  }
}
