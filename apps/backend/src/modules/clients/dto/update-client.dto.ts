import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateClientContactDto, CreateClientDto } from './create-client.dto';

export class UpdateClientContactDto extends CreateClientContactDto {
  @IsOptional()
  @IsString()
  id?: string;
}

class UpdateClientBaseDto extends PartialType(OmitType(CreateClientDto, ['contacts'] as const)) {}

export class UpdateClientDto extends UpdateClientBaseDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateClientContactDto)
  contacts?: UpdateClientContactDto[];
}
