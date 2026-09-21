import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CorrectQualityAdjustmentDto, FinishPackagingDto, PackagingDto, QualityDecisionDto, ServiceDto } from './plant.dto';

describe('PackagingDto', () => {
  const validDto = () =>
    Object.assign(new PackagingDto(), {
      version: 1,
      packagingOrder: '123456',
      materialCode: '4321',
      line: 'A',
      format: '4 L',
      dispenser: 'A',
      filter: '1',
      description: 'Látex interior blanco'
    });

  it('acepta órdenes de envasado de 6 dígitos con descripción', async () => {
    await expect(validate(validDto())).resolves.toHaveLength(0);
  });

  it('acepta órdenes de envasado de 8 dígitos', async () => {
    const dto = validDto();
    dto.packagingOrder = '12345678';

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rechaza órdenes de envasado que no tengan 6 u 8 dígitos', async () => {
    const dto = validDto();
    dto.packagingOrder = '1234567';

    expect(await validate(dto)).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'packagingOrder' })])
    );
  });

  it('acepta materiales de envasado de 5 dígitos', async () => {
    const dto = validDto();
    dto.materialCode = '12345';

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rechaza materiales de envasado que no tengan 4 o 5 dígitos', async () => {
    const dto = validDto();
    dto.materialCode = '123456';

    expect(await validate(dto)).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'materialCode' })])
    );
  });

  it('elimina espacios accidentales del material de envasado', async () => {
    const dto = plainToInstance(PackagingDto, { ...validDto(), materialCode: ' 43 21 ' });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.materialCode).toBe('4321');
  });

  it('requiere una descripción de envasado', async () => {
    const dto = validDto() as Partial<PackagingDto>;
    delete dto.description;

    expect(await validate(dto as object)).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'description' })])
    );
  });

  it.each(['dispenser', 'filter'] as const)('requiere el campo %s', async (field) => {
    const dto = validDto() as Partial<PackagingDto>;
    delete dto[field];

    expect(await validate(dto as object)).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: field })])
    );
  });
});

describe('FinishPackagingDto', () => {
  it('permite finalizar sin cargar kilos ni unidades manualmente', async () => {
    const dto = Object.assign(new FinishPackagingDto(), { version: 1 });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});

describe('ServiceDto', () => {
  it.each(['Mantenimiento', 'Lavado'])('acepta el motivo %s', async (reason) => {
    const dto = Object.assign(new ServiceDto(), { version: 1, reason });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rechaza motivos distintos de Mantenimiento o Lavado', async () => {
    const dto = Object.assign(new ServiceDto(), { version: 1, reason: 'Otro' });

    expect(await validate(dto)).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'reason' })])
    );
  });

  it('requiere un motivo', async () => {
    const dto = Object.assign(new ServiceDto(), { version: 1 });

    expect(await validate(dto)).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'reason' })])
    );
  });
});

describe('QualityDecisionDto adjustments', () => {
  const adjustmentDto = (adjustments?: Array<{ materialCode: string; quantityKg: number }>) =>
    plainToInstance(QualityDecisionDto, {
      version: 1,
      result: 'AJUSTE',
      employeeNumber: '123456',
      adjustmentReasons: ['Corrección de fórmula', 'Ajuste de viscosidad'],
      adjustments
    });

  it('acepta todos los materiales y cantidades válidos del ajuste', async () => {
    const dto = adjustmentDto([
      { materialCode: '1010', quantityKg: 25.5 },
      { materialCode: '202020', quantityKg: 1.125 }
    ]);

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('requiere al menos un material cuando el resultado es AJUSTE', async () => {
    expect(await validate(adjustmentDto())).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'adjustments' })])
    );
  });

  it('acepta uno o más motivos cuando el resultado es AJUSTE', async () => {
    const dto = adjustmentDto([{ materialCode: '1010', quantityKg: 25.5 }]);

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('requiere al menos un motivo cuando el resultado es AJUSTE', async () => {
    const dto = adjustmentDto([{ materialCode: '1010', quantityKg: 25.5 }]);
    dto.adjustmentReasons = [];

    expect(await validate(dto)).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'adjustmentReasons' })])
    );
  });

  it('rechaza materiales no numéricos o cantidades no positivas', async () => {
    const errors = await validate(adjustmentDto([{ materialCode: 'MAT-A', quantityKg: 0 }]));

    expect(errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'adjustments' })])
    );
  });
});

describe('CorrectQualityAdjustmentDto', () => {
  const validDto = () => plainToInstance(CorrectQualityAdjustmentDto, {
    version: 4,
    adjustmentReasons: ['Viscosidad', 'Color'],
    adjustments: [
      { materialCode: '1010', quantityKg: 12.5 },
      { materialCode: '2020', quantityKg: 3.125 }
    ]
  });

  it('acepta corregir varios motivos y materiales', async () => {
    await expect(validate(validDto())).resolves.toHaveLength(0);
  });

  it('requiere al menos un motivo y un material', async () => {
    const dto = validDto();
    dto.adjustmentReasons = [];
    dto.adjustments = [];

    const errors = await validate(dto);
    expect(errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ property: 'adjustmentReasons' }),
      expect.objectContaining({ property: 'adjustments' })
    ]));
  });
});
