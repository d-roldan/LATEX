import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateAttachmentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  fileName!: string;
}
