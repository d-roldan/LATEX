import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AddConsumptionDto {
  @IsString()
  materialId!: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  orderStageId?: string;
}
