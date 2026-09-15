import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PackagingDto } from './plant.dto';

describe('PackagingDto', () => {
  const validDto = () =>
    Object.assign(new PackagingDto(), {
      version: 1,
      packagingOrder: '123456',
      materialCode: '4321',
      line: 'A',
      format: '4 L',
      description: 'Látex interior blanco'
    });

  it('acepta órdenes de envasado de 6 dígitos con descripción', async () => {
    await expect(validate(validDto())).resolves.toHaveLength(0);
  });

  it('rechaza órdenes de envasado que no tengan 6 dígitos', async () => {
    const dto = validDto();
    dto.packagingOrder = '12345678';

    expect(await validate(dto)).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'packagingOrder' })])
    );
  });

  it('rechaza materiales de envasado que no tengan 4 dígitos', async () => {
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
});
