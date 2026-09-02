import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ProductionStatus } from '@prisma/client';

export class UpdateProductionStatusDto {
  @IsEnum(ProductionStatus)
  status!: ProductionStatus;

  @IsOptional()
  @IsString()
  note?: string;
}
