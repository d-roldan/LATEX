import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PlantIntegrationAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async authenticate(plantCode: string, source: string, apiKey: string | undefined) {
    if (!apiKey) throw new UnauthorizedException('Clave de integración inválida');

    const candidates = await this.prisma.plantIntegration.findMany({
      where: {
        source,
        isActive: true,
        plant: { code: plantCode.toUpperCase(), isActive: true }
      },
      include: { plant: true }
    });
    const supplied = createHash('sha256').update(apiKey).digest();
    const matches = candidates.filter((candidate) => {
      const stored = Buffer.from(candidate.keyHash, 'hex');
      return stored.length === supplied.length && timingSafeEqual(stored, supplied);
    });

    if (matches.length !== 1) {
      throw new UnauthorizedException('Clave de integración inválida');
    }
    return matches[0];
  }
}
