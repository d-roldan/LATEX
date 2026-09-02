import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AdjustStockDto {
  @IsNumber()
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitCost!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
