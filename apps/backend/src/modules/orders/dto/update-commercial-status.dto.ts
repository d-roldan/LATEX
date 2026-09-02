import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CommercialStatus } from '@prisma/client';

export class UpdateCommercialStatusDto {
  @IsEnum(CommercialStatus)
  status!: CommercialStatus;

  @IsOptional()
  @IsString()
  note?: string;
}
