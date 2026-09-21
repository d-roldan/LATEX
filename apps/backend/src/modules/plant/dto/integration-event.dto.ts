import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested
} from 'class-validator';

export class IndustrialEventDto {
  @IsString()
  @MaxLength(120)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, {
    message: 'eventId contiene caracteres no permitidos'
  })
  eventId!: string;

  @IsString()
  @MaxLength(80)
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message: 'eventType debe usar mayúsculas, números y guiones bajos'
  })
  eventType!: string;

  @IsISO8601({}, { message: 'occurredAt debe ser un instante ISO 8601 válido' })
  occurredAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^\d+$/, { message: 'sequence debe contener sólo dígitos' })
  sequence?: string;

  @IsObject()
  payload!: Record<string, unknown>;
}

export class IndustrialEventBatchDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(80)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, {
    message: 'source contiene caracteres no permitidos'
  })
  source!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => IndustrialEventDto)
  events!: IndustrialEventDto[];
}
