import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator';

export class StartManufacturingDto {
  @Matches(/^\d{8}$/) manufacturingOrder!: string;
  @Matches(/^\d{6}$/) materialCode!: string;
  @IsString() @MaxLength(180) description!: string;
  @IsInt() @Min(0) version!: number;
}

export class VersionedActionDto {
  @IsInt() @Min(0) version!: number;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class QualityDecisionDto extends VersionedActionDto {
  @IsIn(['APROBADO', 'AJUSTE', 'RECHAZADO_RECUPERAR', 'RECHAZADO_DESTRUIR']) result!: string;
  @Matches(/^\d{6}$/) employeeNumber!: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) specificWeight?: number;
  @IsOptional() @IsString() @MaxLength(180) recoveryAction?: string;
}

export class PackagingDto extends VersionedActionDto {
  @Matches(/^\d{8}$/) packagingOrder!: string;
  @IsString() @MaxLength(80) line!: string;
  @IsString() @MaxLength(40) format!: string;
}

export class CorrectPackagingDto extends PackagingDto {
  @IsString() @MaxLength(300) reason!: string;
}

export class ServiceDto extends VersionedActionDto {
  @IsString() @MaxLength(180) reason!: string;
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
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100)
  @ValidateNested({ each: true }) @Type(() => WeightReadingDto)
  readings!: WeightReadingDto[];
}
