import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateBy,
  ValidateNested
} from 'class-validator';
import { INJECTION_SIM_SOURCE, INJECTION_SOURCE } from '../injection-machines.config';

export class InjectionTechnicalCycleDto {
  @IsInt() @Min(0) shot_number!: number;
  @IsISO8601() timestamp!: string;
  @IsOptional() @IsNumber() @Min(0) cycle_time?: number | null;
  @IsOptional() @IsString() @MaxLength(100) mold_name?: string | null;
  @IsOptional() @IsInt() @Min(0) cavity?: number | null;
  @IsOptional() @IsInt() @Min(0) ngmark?: number | null;
  @IsOptional() @IsNumber() injection_time?: number | null;
  @IsOptional() @IsNumber() filling_time?: number | null;
  @IsOptional() @IsNumber() max_injection_pressure?: number | null;
  @IsOptional() @IsNumber() max_injection_speed?: number | null;
  @IsOptional() @IsNumber() switch_over_position?: number | null;
  @IsOptional() @IsNumber() max_switch_over_pressure?: number | null;
  @IsOptional() @IsNumber() cushion_position?: number | null;
  @IsOptional() @IsNumber() plasticizing_time?: number | null;
  @IsOptional() @IsNumber() plasticizing_position?: number | null;
  @IsOptional() @IsNumber() average_screw_rpm?: number | null;
  @IsOptional() @IsNumber() max_screw_rpm?: number | null;
  @IsOptional() @IsNumber() average_back_pressure?: number | null;
  @IsOptional() @IsNumber() max_back_pressure?: number | null;
  @IsOptional() @IsNumber() clamp_close_time?: number | null;
  @IsOptional() @IsNumber() clamp_open_time?: number | null;
  @IsOptional() @IsNumber() clamp_open_position?: number | null;
  @IsOptional() @IsNumber() resin_weight?: number | null;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ArrayMinSize(7)
  @ValidateBy({
    name: 'nullableTemperatures',
    validator: {
      validate: (value: unknown) =>
        Array.isArray(value) &&
        value.every((item) => item === null || (typeof item === 'number' && Number.isFinite(item)))
    }
  })
  barrel_temperatures?: (number | null)[] | null;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ArrayMinSize(12)
  @ValidateBy({
    name: 'nullableTemperatures',
    validator: {
      validate: (value: unknown) =>
        Array.isArray(value) &&
        value.every((item) => item === null || (typeof item === 'number' && Number.isFinite(item)))
    }
  })
  mold_temperatures?: (number | null)[] | null;
  @IsOptional() @IsNumber() hopper_temperature?: number | null;
}

export class InjectionMachineReadingDto {
  @IsString() @MaxLength(45) machine_ip!: string;
  @IsOptional() @IsString() @MaxLength(20) equipment_code?: string;
  @IsOptional() @IsBoolean() simulated?: boolean;
  @IsOptional() @IsString() @MaxLength(50) modelo?: string | null;
  @IsOptional() @IsString() @MaxLength(100) machine_name_cms?: string | null;
  @IsISO8601() cms_timestamp!: string;
  @IsOptional() @IsNumber() @Min(0) @Max(31536000) cms_age_seconds?: number | null;
  @IsOptional() @IsBoolean() cms_row_fresh?: boolean | null;
  @IsOptional() @IsString() @MaxLength(50) adquisicion_industrial_fresca?: string | null;
  @IsOptional() @IsInt() @Min(-1000000000) @Max(1000000000) operation_status_code?: number | null;
  @IsOptional() @IsString() @MaxLength(80) operation_status_text?: string | null;
  @IsOptional() @IsInt() @Min(-1000000000) @Max(1000000000) motor_status_code?: number | null;
  @IsOptional() @IsString() @MaxLength(80) motor_status_text?: string | null;
  @IsOptional() @IsInt() @Min(-1000000000) @Max(1000000000) heater_status_code?: number | null;
  @IsOptional() @IsString() @MaxLength(80) heater_status_text?: string | null;
  @IsOptional() @IsInt() @Min(-1000000000) @Max(1000000000) alarm_status_code?: number | null;
  @IsOptional() @IsNumber() @Min(0) @Max(86400) cycle_time_current?: number | null;
  @IsOptional() @IsNumber() @Min(0) @Max(86400) cycle_time_before?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(1000000) production_time_hour?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(59) production_time_min?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(1000000000) current_quantity?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(1000000000) total_quantity?: number | null;
  @IsOptional() @IsNumber() @Min(0) @Max(1000000) avg_quantity_per_hour?: number | null;
  @IsOptional() @IsInt() @Min(-1000000000) @Max(1000000000) delta_contador_observado?:
    | number
    | null;
  @IsOptional() @IsString() @MaxLength(80) tipo_cambio_contador?: string | null;
  @IsOptional() @IsString() @MaxLength(80) actividad_inferida?: string | null;
  @IsOptional() @IsISO8601() ultimo_incremento_detectado?: string | null;
  @IsOptional()
  @ValidateNested()
  @Type(() => InjectionTechnicalCycleDto)
  ultimo_ciclo_tecnico?: InjectionTechnicalCycleDto | null;
}

export class InjectionMachineBatchDto {
  @IsIn([INJECTION_SOURCE, INJECTION_SIM_SOURCE]) source!:
    | typeof INJECTION_SOURCE
    | typeof INJECTION_SIM_SOURCE;
  @IsOptional() @IsIn(['SIMULATION']) mode?: 'SIMULATION';
  @IsOptional() @IsBoolean() simulated?: boolean;
  @IsIn([1]) schemaVersion!: 1;
  @IsISO8601() fecha_recepcion_nodered!: string;
  @IsOptional() @IsInt() @Min(0) @Max(1000) cantidad_filas_sql?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1000) cantidad_maquinas_frescas_cms?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(120000) duracion_consulta_ms?: number;
  @IsOptional() @IsString() @MaxLength(500) aviso?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => InjectionMachineReadingDto)
  maquinas!: InjectionMachineReadingDto[];
}
