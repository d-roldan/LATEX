import { IsEmail, IsOptional, IsString, MaxLength, ValidateNested, IsArray } from 'class-validator';
import { Transform, Type } from 'class-transformer';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export class CreateClientContactDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(emptyToUndefined)
  role?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  @Transform(emptyToUndefined)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(emptyToUndefined)
  phone?: string;
}

export class CreateClientDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(emptyToUndefined)
  cuit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(emptyToUndefined)
  industry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(emptyToUndefined)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  @Transform(emptyToUndefined)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  @Transform(emptyToUndefined)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(emptyToUndefined)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateClientContactDto)
  contacts?: CreateClientContactDto[];
}
