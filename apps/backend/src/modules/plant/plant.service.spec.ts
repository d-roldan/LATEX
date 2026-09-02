import { UnauthorizedException } from '@nestjs/common';
import { PlantService } from './plant.service';

describe('PlantService telemetry', () => {
  const prisma = {
    tank: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'tank-101', companyId: 'company-1', number: 101, name: 'TK101', capacityKg: null,
          scaleKey: 'TK101', state: 'VACIO', version: 0, activeLot: null
        }
      ])
    }
  } as any;
  const config = {
    get: jest.fn((key: string) => key === 'NODE_RED_API_KEY' ? 'integration-secret' : key === 'SYSTEM_OWNER_COMPANY_ID' ? 'company-1' : undefined)
  } as any;

  it('keeps weight readings in memory and marks the response as non-persistent', async () => {
    const service = new PlantService(prisma, config);
    const result = service.ingestWeights('integration-secret', 'company-1', {
      readings: [{ scaleKey: 'TK101', grossKg: 5070.125 }]
    });
    const tanks = await service.tanks('company-1');

    expect(result.persisted).toBe(false);
    expect(tanks[0].telemetry.grossKg).toBe(5070.125);
    expect(tanks[0].telemetry.online).toBe(true);
  });

  it('rejects a batch with an invalid integration key', () => {
    const service = new PlantService(prisma, config);
    expect(() => service.ingestWeights('wrong-key', 'company-1', {
      readings: [{ scaleKey: 'TK101', grossKg: 100 }]
    })).toThrow(UnauthorizedException);
  });
});
