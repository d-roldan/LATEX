import { IsOptional, IsString } from 'class-validator';

export class RejectQualityControlDto {
  @IsString()
  reworkStageId!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
