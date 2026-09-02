import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
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
import { OrderItemInputDto, CostingHourInputDto } from './create-order.dto';

export class UpdateOrderDto {
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedTimeMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedCost?: number;

  @IsOptional()
  @IsString()
  purchaseOrderNumber?: string;

  @IsOptional()
  @IsString()
  estimatedMaterials?: string;

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

  @IsOptional()
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
}
