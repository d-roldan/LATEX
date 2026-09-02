import { IsEnum, IsOptional, IsString } from 'class-validator';
import { OperationEventType } from '@prisma/client';

export class AddEventDto {
  @IsEnum(OperationEventType)
  eventType!: OperationEventType;

  @IsOptional()
  @IsString()
  resourceId?: string;

  @IsOptional()
  @IsString()
  pauseReason?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
