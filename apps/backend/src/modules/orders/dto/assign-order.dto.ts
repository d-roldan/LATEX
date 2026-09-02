import { IsOptional, IsString } from 'class-validator';

export class AssignOrderDto {
  @IsString()
  resourceId!: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  orderStageId?: string;
}
