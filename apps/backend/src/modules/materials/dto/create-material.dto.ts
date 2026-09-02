import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateMaterialDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsString()
  @MaxLength(30)
  unit!: string;

  @IsNumber()
  @Min(0)
  unitCost!: number;

  @IsNumber()
  @Min(0)
  stock!: number;
}
