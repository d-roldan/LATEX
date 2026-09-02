import { IsOptional, IsString } from 'class-validator';

export class UpdateAssignmentDto {
  @IsOptional()
  @IsString()
  resourceId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  orderStageId?: string;
}
