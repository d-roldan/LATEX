import { NotFoundException } from '@nestjs/common';
import { PlantScopedController } from './plant.controller';

describe('PlantScopedController history summary', () => {
  const user = { sub: 'user-1', companyId: 'company-1', role: 'JEFATURA' } as any;

  it('resuelve la planta autorizada antes de consultar el resumen', async () => {
    const service = {
      assertPlantAccess: jest.fn().mockResolvedValue({ id: 'plant-1' }),
      historySummary: jest.fn().mockResolvedValue({ total: 0, rows: [] })
    };
    const controller = new PlantScopedController(service as any, {} as any);

    await controller.historySummary(
      user,
      'LATEX',
      'tank-1',
      'AJUSTE',
      '2026-10-01',
      '2026-10-31',
      'color',
      'adjustments',
      'desc',
      '0',
      '50'
    );

    expect(service.assertPlantAccess).toHaveBeenCalledWith(
      'company-1',
      'user-1',
      'LATEX',
      'tank-1'
    );
    expect(service.historySummary).toHaveBeenCalledWith(
      'company-1',
      'plant-1',
      expect.objectContaining({ tankId: 'tank-1', sortBy: 'adjustments' })
    );
  });

  it('no consulta datos cuando la planta no está autorizada', async () => {
    const service = {
      assertPlantAccess: jest.fn().mockRejectedValue(new NotFoundException()),
      historySummary: jest.fn()
    };
    const controller = new PlantScopedController(service as any, {} as any);

    await expect(controller.historySummary(user, 'AJENA')).rejects.toThrow(NotFoundException);
    expect(service.historySummary).not.toHaveBeenCalled();
  });
});
