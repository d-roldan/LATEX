import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  NotFoundException
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtUser } from '../../common/auth/jwt-user.interface';
import { RolesGuard } from '../../common/auth/roles.guard';
import { ReportingController } from './reporting.controller';
import { ReportingLaboratoryService } from './reporting-laboratory.service';

const user: JwtUser = {
  sub: 'user-1',
  companyId: 'company-1',
  role: 'LABORATORIO',
  email: 'lab@example.test',
  username: 'lab',
  fullName: 'Lab',
  sessionVersion: 0
};

describe('ReportingLaboratoryService authorization', () => {
  const prisma = {
    productionLot: { findFirst: jest.fn() },
    laboratorySample: { findMany: jest.fn() }
  };
  const reporting = { scope: jest.fn() };
  const service = new ReportingLaboratoryService(prisma as never, reporting as never);

  beforeEach(() => {
    jest.clearAllMocks();
    reporting.scope.mockResolvedValue([{ id: 'plant-allowed', code: 'LATEX', name: 'Látex' }]);
  });

  it('rechaza un identificador inválido antes de consultar datos', async () => {
    await expect(service.lotDetail(user, 'bad/id')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.productionLot.findFirst).not.toHaveBeenCalled();
  });

  it('restringe el lote por empresa y plantas autorizadas', async () => {
    prisma.productionLot.findFirst.mockResolvedValue(null);
    await expect(service.lotDetail(user, 'lot-other-plant')).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(prisma.productionLot.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 'company-1',
          plantId: { in: ['plant-allowed'] }
        })
      })
    );
    expect(prisma.laboratorySample.findMany).not.toHaveBeenCalled();
  });
});

describe('Permisos de lectura de Reportería', () => {
  const guard = new RolesGuard(new Reflector());
  const contextFor = (handler: keyof ReportingController) =>
    ({
      getHandler: () => ReportingController.prototype[handler],
      getClass: () => ReportingController,
      switchToHttp: () => ({ getRequest: () => ({ user }) })
    }) as unknown as ExecutionContext;

  it('permite Laboratorio y detalle de OF al rol LABORATORIO', () => {
    expect(guard.canActivate(contextFor('laboratoryDashboard'))).toBe(true);
    expect(guard.canActivate(contextFor('laboratoryAdjustments'))).toBe(true);
    expect(guard.canActivate(contextFor('laboratoryLot'))).toBe(true);
  });

  it('mantiene el resumen general fuera del alcance de LABORATORIO', () => {
    expect(() => guard.canActivate(contextFor('overview'))).toThrow(ForbiddenException);
  });
});
