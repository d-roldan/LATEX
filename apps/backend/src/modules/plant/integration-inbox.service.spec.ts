import { BadRequestException } from '@nestjs/common';
import { IntegrationInboxService } from './integration-inbox.service';

describe('IntegrationInboxService', () => {
  const integration = {
    id: 'integration-1', companyId: 'company-1', plantId: 'plant-latex', source: 'scada-latex'
  };
  const dto = {
    source: 'scada-latex',
    events: [{
      eventId: 'plc-000042', eventType: 'BATCH_STEP_COMPLETED',
      occurredAt: '2026-09-20T15:30:00.000Z', sequence: '42', payload: { step: 3 }
    }]
  };

  it('persiste eventos con identidad de planta y confirma duplicados sin recrearlos', async () => {
    const prisma = { integrationInbox: { createMany: jest.fn().mockResolvedValue({ count: 0 }) } } as any;
    const auth = { authenticate: jest.fn().mockResolvedValue(integration) } as any;
    const service = new IntegrationInboxService(prisma, auth);

    await expect(service.receive('LATEX', 'secret', dto)).resolves.toMatchObject({
      accepted: 0, duplicates: 1, persisted: true, status: 'RECEIVED'
    });
    expect(auth.authenticate).toHaveBeenCalledWith('LATEX', 'scada-latex', 'secret');
    expect(prisma.integrationInbox.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [expect.objectContaining({
        companyId: 'company-1', plantId: 'plant-latex', integrationId: 'integration-1',
        source: 'scada-latex', eventId: 'plc-000042', eventType: 'BATCH_STEP_COMPLETED',
        occurredAt: new Date('2026-09-20T15:30:00.000Z')
      })]
    }));
  });

  it('rechaza eventId repetidos dentro del mismo lote antes de autenticarse', async () => {
    const prisma = { integrationInbox: { createMany: jest.fn() } } as any;
    const auth = { authenticate: jest.fn() } as any;
    const service = new IntegrationInboxService(prisma, auth);

    await expect(service.receive('LATEX', 'secret', {
      source: 'scada-latex', events: [dto.events[0], dto.events[0]]
    })).rejects.toThrow(BadRequestException);
    expect(auth.authenticate).not.toHaveBeenCalled();
    expect(prisma.integrationInbox.createMany).not.toHaveBeenCalled();
  });
});
