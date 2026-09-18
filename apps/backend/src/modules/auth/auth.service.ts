import {
  Injectable,
  HttpException,
  HttpStatus,
  UnauthorizedException,
  NotFoundException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { JwtUser } from '../../common/auth/jwt-user.interface';
import { AuditService } from '../audit/audit.service';
import { hasExpiredLoginLock, LOGIN_LOCKOUT_MS, maxFailedLoginAttempts } from './login-lockout';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService
  ) {}

  async login(dto: LoginDto) {
    const identifier = dto.identifier.trim().toLowerCase();
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        company: {
          isActive: true
        },
        OR: [
          { email: { equals: identifier, mode: 'insensitive' } },
          { username: { equals: identifier, mode: 'insensitive' } },
          { fullName: { equals: dto.identifier.trim(), mode: 'insensitive' } }
        ]
      },
      include: {
        company: true
      }
    });

    if (users.length > 1) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    const user = users[0];

    if (!user) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      const remainingMinutes = Math.max(
        1,
        Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60000)
      );
      await this.auditService.log({
        companyId: user.companyId,
        userId: user.id,
        entityType: 'AUTH',
        entityId: user.id,
        action: 'LOGIN',
        metadata: { result: 'REJECTED_LOCKED', remainingMinutes }
      });
      throw new HttpException(
        `Demasiados intentos fallidos. La cuenta está bloqueada temporalmente. Intentá nuevamente en ${remainingMinutes} minuto${remainingMinutes === 1 ? '' : 's'}.`,
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    // Un bloqueo vencido inicia una ventana nueva. Los intentos fallidos que
    // todavía no alcanzaron el límite deben conservarse hasta un login válido.
    if (hasExpiredLoginLock(user.lockedUntil, now)) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null }
      });
    }

    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordOk) {
      const updated = await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: { increment: 1 } },
        select: { failedLoginAttempts: true }
      });
      const maxAttempts = maxFailedLoginAttempts(user.role);

      if (updated.failedLoginAttempts >= maxAttempts) {
        const lockedUntil = new Date(Date.now() + LOGIN_LOCKOUT_MS);
        await this.prisma.user.update({
          where: { id: user.id },
          data: { lockedUntil }
        });
        await this.auditService.log({
          companyId: user.companyId,
          userId: user.id,
          entityType: 'AUTH',
          entityId: user.id,
          action: 'LOGIN',
          metadata: { result: 'BLOCKED', failedAttempts: updated.failedLoginAttempts, lockedUntil }
        });
        throw new HttpException(
          'Demasiados intentos fallidos. La cuenta quedó bloqueada durante 15 minutos.',
          HttpStatus.TOO_MANY_REQUESTS
        );
      }

      await this.auditService.log({
        companyId: user.companyId,
        userId: user.id,
        entityType: 'AUTH',
        entityId: user.id,
        action: 'LOGIN',
        metadata: { result: 'FAILED', failedAttempts: updated.failedLoginAttempts }
      });

      throw new UnauthorizedException('Credenciales invalidas');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null }
    });

    const payload: JwtUser = {
      sub: user.id,
      companyId: user.companyId,
      role: user.role,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      isProtected: user.isProtected,
      isSystemOwner: user.isSystemOwner,
      sessionVersion: user.sessionVersion
    };
    const jwtSecret = this.configService.get<string>('JWT_SECRET');

    if (!jwtSecret) {
      throw new UnauthorizedException('JWT_SECRET no configurado');
    }

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: jwtSecret,
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '8h')
    });

    await this.auditService.log({
      companyId: user.companyId,
      userId: user.id,
      entityType: 'AUTH',
      entityId: user.id,
      action: 'LOGIN',
      metadata: {
        email: user.email,
        result: 'SUCCESS'
      }
    });

    return {
      accessToken,
      user: {
        id: user.id,
        companyId: user.companyId,
        fullName: user.fullName,
        email: user.email,
        username: user.username,
        role: user.role,
        companyName: user.company.name,
        isProtected: user.isProtected,
        isSystemOwner: user.isSystemOwner
      }
    };
  }

  async me(userId: string, companyId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        companyId,
        isActive: true
      },
      include: {
        company: true
      }
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return {
      id: user.id,
      companyId: user.companyId,
      fullName: user.fullName,
      email: user.email,
      username: user.username,
      role: user.role,
      companyName: user.company.name,
      isProtected: user.isProtected,
      isSystemOwner: user.isSystemOwner
    };
  }

  async changePassword(
    userId: string,
    companyId: string,
    oldPassword: string,
    newPassword: string
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, companyId, isActive: true }
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const passwordOk = await bcrypt.compare(oldPassword, user.passwordHash);

    if (!passwordOk) {
      throw new UnauthorizedException('La contraseña actual es incorrecta');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, sessionVersion: { increment: 1 } }
    });

    await this.auditService.log({
      companyId,
      userId,
      entityType: 'AUTH',
      entityId: userId,
      action: 'UPDATE',
      metadata: { action: 'PASSWORD_CHANGE_SELF' }
    });

    return { success: true, message: 'Contraseña actualizada. Volvé a iniciar sesión.' };
  }

  getStatus() {
    return { module: 'auth', status: 'ready' };
  }
}
