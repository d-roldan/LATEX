import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  identifier!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password!: string;
}
