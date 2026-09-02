import { IsEmail, IsEnum, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @IsEmail()
  @MaxLength(120)
  email!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(40)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'username solo puede contener letras, numeros, puntos, guiones y guiones bajos'
  })
  username!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password!: string;

  @IsEnum(UserRole)
  role!: UserRole;
}
