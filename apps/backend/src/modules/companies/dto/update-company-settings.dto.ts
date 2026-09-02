import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateCompanySettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  warningTimeDeviationPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  criticalTimeDeviationPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  warningCostDeviationPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  criticalCostDeviationPct?: number;

  @IsOptional()
  @IsBoolean()
  requireDeliveryChecklist?: boolean;

  @IsOptional()
  @IsString()
  workOrderCodePrefix?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  defaultWorkOrderPriority?: number;
}
