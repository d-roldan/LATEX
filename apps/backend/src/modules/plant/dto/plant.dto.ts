import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsISO8601,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested
} from 'class-validator';

export class StartManufacturingDto {
  @Matches(/^\d{8}$/) manufacturingOrder!: string;
  @Matches(/^\d{6}$/) materialCode!: string;
  @IsString() @MaxLength(180) description!: string;
  @IsInt() @Min(0) version!: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) plannedQuantityKg?: number;
  @IsOptional() @IsIn(['BAJA', 'NORMAL', 'ALTA', 'URGENTE']) priority?: string;
  @IsOptional() @IsString() @MaxLength(40) shift?: string;
  @IsOptional() @IsISO8601() scheduledAt?: string;
}

export class VersionedActionDto {
  @IsInt() @Min(0) version!: number;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class QualityAdjustmentItemDto {
  @Matches(/^\d{1,20}$/, { message: 'El número de material debe contener sólo dígitos' })
  materialCode!: string;
  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) quantityKg!: number;
}

export class QualityDecisionDto extends VersionedActionDto {
  @IsIn(['APROBADO', 'AJUSTE', 'RECHAZADO_RECUPERAR', 'RECHAZADO_DESTRUIR']) result!: string;
  @Matches(/^\d{6}$/) employeeNumber!: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) specificWeight?: number;
  @IsOptional() @IsString() @MaxLength(180) recoveryAction?: string;
  @ValidateIf((dto: QualityDecisionDto) => dto.result === 'AJUSTE')
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20)
  @IsString({ each: true }) @IsNotEmpty({ each: true }) @MaxLength(180, { each: true })
  adjustmentReasons?: string[];
  @ValidateIf((dto: QualityDecisionDto) => dto.result === 'AJUSTE')
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100)
  @ValidateNested({ each: true }) @Type(() => QualityAdjustmentItemDto)
  adjustments?: QualityAdjustmentItemDto[];
}

export class CorrectQualityAdjustmentDto {
  @IsInt() @Min(0) version!: number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20)
  @IsString({ each: true }) @IsNotEmpty({ each: true }) @MaxLength(180, { each: true })
  adjustmentReasons!: string[];
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100)
  @ValidateNested({ each: true }) @Type(() => QualityAdjustmentItemDto)
  adjustments!: QualityAdjustmentItemDto[];
}

export class PackagingDto extends VersionedActionDto {
  @Matches(/^\d{6}(?:\d{2})?$/, {
    message: 'La orden de envasado debe tener 6 u 8 dígitos'
  })
  packagingOrder!: string;
  @Transform(({ value }) => typeof value === 'string' ? value.replace(/\s+/g, '') : value)
  @Matches(/^\d{4,5}$/, { message: 'El material de envasado debe tener 4 o 5 dígitos' })
  materialCode!: string;
  @IsString() @MaxLength(80) line!: string;
  @IsString() @MaxLength(40) format!: string;
  @IsString() @MaxLength(180) description!: string;
}

export class FinishPackagingDto extends VersionedActionDto {
  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) producedKg?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) wasteKg?: number;
  @IsOptional() @IsInt() @Min(0) producedUnits?: number;
}

export class DailyClosureDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class StageTargetsDto {
  @IsInt() @Min(1) @Max(10080) fabricando!: number;
  @IsInt() @Min(1) @Max(10080) laboratorio!: number;
  @IsInt() @Min(1) @Max(10080) ajuste!: number;
  @IsInt() @Min(1) @Max(10080) rechazado!: number;
  @IsInt() @Min(1) @Max(10080) aprobado!: number;
  @IsInt() @Min(1) @Max(10080) envasando!: number;
  @IsInt() @Min(1) @Max(10080) fueraDeServicio!: number;
}

export class CorrectPackagingDto extends PackagingDto {
  @IsString() @MaxLength(300) reason!: string;
}

export class ServiceDto {
  @IsInt() @Min(0) version!: number;
  @IsIn(['Mantenimiento', 'Lavado'], {
    message: 'El motivo debe ser Mantenimiento o Lavado'
  })
  reason!: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class CorrectLotDto extends VersionedActionDto {
  @IsOptional() @Matches(/^\d{8}$/) manufacturingOrder?: string;
  @IsOptional() @Matches(/^\d{6}$/) materialCode?: string;
  @IsOptional() @IsString() @MaxLength(180) description?: string;
  @IsString() @MaxLength(300) reason!: string;
}

export class WeightReadingDto {
  @IsString() @MaxLength(80) scaleKey!: string;
  @IsNumber({ maxDecimalPlaces: 3 }) @Min(-1000) @Max(100000) grossKg!: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(-1000) @Max(100000) netKg?: number;
  @IsOptional() @IsString() @MaxLength(40) measuredAt?: string;
}

export class WeightBatchDto {
  @IsOptional() @IsString() @MaxLength(80) source?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100)
  @ValidateNested({ each: true }) @Type(() => WeightReadingDto)
  readings!: WeightReadingDto[];
}
