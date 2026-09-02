import { IsString, MaxLength, MinLength } from 'class-validator';

export class StageCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}
