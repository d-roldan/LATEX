import { ArrayNotEmpty, ArrayUnique, IsArray, IsString } from 'class-validator';

export class UpdateUserPlantsDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'Debe seleccionar al menos una planta' })
  @ArrayUnique({ message: 'No se pueden repetir plantas' })
  @IsString({ each: true })
  plantIds!: string[];
}
