import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CorrectQualityAdjustmentDto,
  CreatePackagingPlanningCardDto,
  CreatePlanningCardDto,
  FinishPackagingDto,
  PackagingSpeedBatchDto,
  PackagingDto,
  QualityDecisionDto,
  ServiceDto,
  WeightBatchDto
} from './plant.dto';

describe('WeightBatchDto', () => {
  it('acepta pesos y velocidades juntos', async () => {
    const dto = plainToInstance(WeightBatchDto, {
      readings: [{ scaleKey: 'TK101', grossKg: 5070.125 }],
      speeds: [{ line: 'DEVREE', containersPerMinute: 42 }]
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rechaza una velocidad inválida en el lote de pesos', async () => {
    const dto = plainToInstance(WeightBatchDto, {
      readings: [{ scaleKey: 'TK101', grossKg: 5070.125 }],
      speeds: [{ line: 'C', containersPerMinute: -1 }]
    });
    expect(await validate(dto)).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'speeds' })])
    );
  });
});

describe('PackagingSpeedBatchDto', () => {
  it('acepta una única velocidad cero para Devree', async () => {
    const dto = plainToInstance(PackagingSpeedBatchDto, {
      readings: [{ line: 'DEVREE', containersPerMinute: 0 }]
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('acepta velocidad cero en envases por minuto para la línea A', async () => {
    const dto = plainToInstance(PackagingSpeedBatchDto, {
      readings: [{ line: 'A', containersPerMinute: 0 }]
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rechaza líneas desconocidas y velocidades negativas', async () => {
    const dto = plainToInstance(PackagingSpeedBatchDto, {
      readings: [{ line: 'C', containersPerMinute: -1 }]
    });
    expect(await validate(dto)).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'readings' })])
    );
  });
});

describe('CreatePackagingPlanningCardDto', () => {
  it('acepta tanque, dosificadora, filtro e indicaciones válidas', async () => {
    const dto = plainToInstance(CreatePackagingPlanningCardDto, {
      tankId: 'tank-107',
      dispenser: 'B',
      filter: 'RECIRCULACION',
      hooked: true,
      notes: 'Filtro 1 y lavado de manifold'
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rechaza dosificadoras distintas de A o B', async () => {
    const dto = plainToInstance(CreatePackagingPlanningCardDto, {
      tankId: 'tank-107',
      dispenser: 'C',
      filter: '1'
    });

    expect(await validate(dto)).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'dispenser' })])
    );
  });

  it('rechaza filtros que no pertenecen a la planificación de envasado', async () => {
    const dto = plainToInstance(CreatePackagingPlanningCardDto, {
      tankId: 'tank-107',
      dispenser: 'A',
      filter: '6'
    });

    expect(await validate(dto)).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'filter' })])
    );
  });
});

describe('CreatePlanningCardDto', () => {
  it('acepta una tarjeta con OF, material, descripción y tanque válidos', async () => {
    const dto = plainToInstance(CreatePlanningCardDto, {
      manufacturingOrder: '26100101',
      materialCode: '600101',
      description: 'Látex interior blanco',
      tankId: 'tank-101'
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rechaza OF y material con longitudes inválidas', async () => {
    const dto = plainToInstance(CreatePlanningCardDto, {
      manufacturingOrder: '1234',
      materialCode: '6001',
      description: 'Látex',
      tankId: 'tank-101'
    });

    const errors = await validate(dto);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'manufacturingOrder' }),
        expect.objectContaining({ property: 'materialCode' })
      ])
    );
  });
});

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

  it('delega al servicio los campos que dependen de la planta', async () => {
    const dto = validDto() as Partial<PackagingDto>;
    delete dto.description;
    delete dto.dispenser;
    delete dto.filter;

    await expect(validate(dto as object)).resolves.toHaveLength(0);
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

  it('permite agitación o recirculación sin materiales, pero exige materiales con otros motivos', async () => {
    const dto = adjustmentDto();
    dto.adjustmentReasons = ['Agitación/Recirculación'];
    await expect(validate(dto)).resolves.toHaveLength(0);
    dto.adjustmentReasons.push('Viscosidad');
    expect(await validate(dto)).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'adjustments' })])
    );
  });

  it('valida los materiales informados aunque el único motivo sea agitación o recirculación', async () => {
    const dto = adjustmentDto([{ materialCode: 'MAT-A', quantityKg: 0 }]);
    dto.adjustmentReasons = ['Agitación/Recirculación'];

    expect(await validate(dto)).toEqual(
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
  const validDto = () =>
    plainToInstance(CorrectQualityAdjustmentDto, {
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
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'adjustmentReasons' }),
        expect.objectContaining({ property: 'adjustments' })
      ])
    );
  });

  it('permite corregir una solicitud a agitación o recirculación sin materiales', async () => {
    const dto = validDto();
    dto.adjustmentReasons = ['Agitación/Recirculación'];
    dto.adjustments = undefined;
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rechaza materiales inválidos al corregir una agitación o recirculación', async () => {
    const dto = validDto();
    dto.adjustmentReasons = ['Agitación/Recirculación'];
    dto.adjustments = [{ materialCode: 'MAT-A', quantityKg: 0 }];

    expect(await validate(dto)).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'adjustments' })])
    );
  });
});
