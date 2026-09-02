import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateConsumptionDto {
  @IsOptional()
  @IsString()
  materialId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.001)
  quantity?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
