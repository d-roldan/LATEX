import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ApproveOrderDto {
  @IsOptional()
  @IsDateString()
  commitmentDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  priority?: number;

  @IsOptional()
  @IsString()
  cabinModelRevisionId?: string;
}
