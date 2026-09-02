import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { OrderStageStatus } from '@prisma/client';

export class UpdateStageStatusDto {
  @IsEnum(OrderStageStatus)
  status!: OrderStageStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progressPct?: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  pauseReason?: string;
}
