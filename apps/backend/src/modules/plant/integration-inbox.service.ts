import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IndustrialEventBatchDto } from './dto/integration-event.dto';
import { PlantIntegrationAuthService } from './plant-integration-auth.service';

@Injectable()
export class IntegrationInboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationAuth: PlantIntegrationAuthService
  ) {}

  async receive(
    plantCode: string,
    apiKey: string | undefined,
    dto: IndustrialEventBatchDto
  ) {
    const uniqueIds = new Set(dto.events.map((event) => event.eventId));
    if (uniqueIds.size !== dto.events.length) {
      throw new BadRequestException('El lote contiene eventId repetidos');
    }

    const integration = await this.integrationAuth.authenticate(plantCode, dto.source, apiKey);
    const receivedAt = new Date();
    const result = await this.prisma.integrationInbox.createMany({
      data: dto.events.map((event) => ({
        companyId: integration.companyId,
        plantId: integration.plantId,
        integrationId: integration.id,
        source: integration.source,
        eventId: event.eventId,
        eventType: event.eventType,
        occurredAt: new Date(event.occurredAt),
        sequence: event.sequence,
        payload: {
          source: dto.source,
          eventId: event.eventId,
          eventType: event.eventType,
          occurredAt: event.occurredAt,
          ...(event.sequence ? { sequence: event.sequence } : {}),
          payload: event.payload
        } as Prisma.InputJsonValue,
        receivedAt
      })),
      skipDuplicates: true
    });

    return {
      accepted: result.count,
      duplicates: dto.events.length - result.count,
      receivedAt: receivedAt.toISOString(),
      persisted: true,
      status: 'RECEIVED'
    };
  }
}
