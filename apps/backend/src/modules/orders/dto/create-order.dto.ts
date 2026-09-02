import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';
import { CommercialStatus } from '@prisma/client';

export class OrderItemInputDto {
  @IsString()
  description!: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsString()
  unit!: string;

  @IsNumber()
  @Min(0)
  estimatedUnitCost!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedHoursMin?: number;
}

export class CostingHourInputDto {
  @IsString()
  label!: string;

  @IsNumber()
  @Min(0)
  hours!: number;

  @IsNumber()
  @Min(0)
  ratePerHour!: number;
}

export class StageAssignmentInputDto {
  @IsString()
  stageCode!: string;

  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  userIds!: string[];
}

export class CreateOrderDto {
  @IsIn(['quotation', 'direct'])
  type!: 'quotation' | 'direct';

  @IsString()
  clientId!: string;

  @IsString()
  @MaxLength(160)
  title!: string;

  @IsString()
  @MaxLength(2000)
  description!: string;

  @IsInt()
  @Min(0)
  estimatedTimeMin!: number;

  @IsNumber()
  @Min(0)
  estimatedCost!: number;

  @IsOptional()
  @IsString()
  purchaseOrderNumber?: string;

  // ── Campos comerciales (presupuesto) ──
  @IsOptional()
  @IsString()
  estimatedMaterials?: string;

  @IsOptional()
  @IsEnum(CommercialStatus)
  commercialStatus?: CommercialStatus;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  deliveryTimeDays?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  @ArrayMaxSize(100)
  items?: OrderItemInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CostingHourInputDto)
  @ArrayMaxSize(50)
  costingHours?: CostingHourInputDto[];

  // ── Campos de producción (OP directa) ──
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  priority?: number;

  @IsOptional()
  @IsDateString()
  plannedDate?: string;

  @IsOptional()
  @IsDateString()
  commitmentDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ['http', 'https'], require_protocol: true })
  dashboardUrl?: string;

  @IsOptional()
  @IsString()
  cabinModelRevisionId?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StageAssignmentInputDto)
  @ArrayMaxSize(50)
  stageAssignments?: StageAssignmentInputDto[];
}
