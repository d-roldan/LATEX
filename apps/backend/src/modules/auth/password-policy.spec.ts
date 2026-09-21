import { UserRole } from '@prisma/client';
import { validateSync } from 'class-validator';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UpdateUserPasswordDto } from '../users/dto/update-user-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

describe('password validation policy', () => {
  it('accepts a six-character password in every password entry flow', () => {
    const createUser = Object.assign(new CreateUserDto(), {
      email: 'usuario@disal.local',
      username: 'usuario.prueba',
      fullName: 'Usuario Prueba',
      password: '123456',
      role: UserRole.OPERARIO,
      plantIds: ['plant-1']
    });
    const resetPassword = Object.assign(new UpdateUserPasswordDto(), { password: '123456' });
    const changePassword = Object.assign(new ChangePasswordDto(), {
      oldPassword: 'anterior',
      newPassword: '123456'
    });

    expect(validateSync(createUser)).toHaveLength(0);
    expect(validateSync(resetPassword)).toHaveLength(0);
    expect(validateSync(changePassword)).toHaveLength(0);
  });

  it('rejects passwords shorter than six characters', () => {
    const resetPassword = Object.assign(new UpdateUserPasswordDto(), { password: '12345' });
    const changePassword = Object.assign(new ChangePasswordDto(), {
      oldPassword: 'anterior',
      newPassword: '12345'
    });

    expect(validateSync(resetPassword).some((error) => error.property === 'password')).toBe(true);
    expect(validateSync(changePassword).some((error) => error.property === 'newPassword')).toBe(
      true
    );
  });
});
