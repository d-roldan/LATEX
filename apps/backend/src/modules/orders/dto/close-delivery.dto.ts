import { IsDateString, IsOptional, IsString, MaxLength, IsBoolean } from 'class-validator';

export class CloseDeliveryDto {
  @IsOptional()
  @IsDateString()
  deliveredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  deliveryChecklist?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  deliveryNote?: string;

  @IsOptional()
  @IsBoolean()
  isSigned?: boolean;
}
