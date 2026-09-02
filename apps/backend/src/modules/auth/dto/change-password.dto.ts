import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MaxLength(72)
  oldPassword!: string;

  @IsString()
  @MinLength(6, { message: 'La nueva contraseña debe tener al menos 6 caracteres' })
  @MaxLength(72)
  newPassword!: string;
}
