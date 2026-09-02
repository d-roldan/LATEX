import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ResourceStatus, ResourceType } from '@prisma/client';

export class CreateResourceDto {
  @IsEnum(ResourceType)
  type!: ResourceType;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sector?: string;

  @IsOptional()
  @IsEnum(ResourceStatus)
  status?: ResourceStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
