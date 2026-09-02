import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { JwtUser } from './jwt-user.interface';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly jwtService = new JwtService();

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: JwtUser;
    }>();

    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token ausente o invalido');
    }

    const token = authHeader.slice(7);
    const secret = this.configService.get<string>('JWT_SECRET');

    if (!secret) {
      throw new UnauthorizedException('JWT_SECRET no configurado');
    }

    try {
      const payload = this.jwtService.verify<JwtUser>(token, {
        secret
      });

      const activeUser = await this.prisma.user.findFirst({
        where: {
          id: payload.sub,
          companyId: payload.companyId,
          isActive: true,
          company: { isActive: true }
        },
        select: { sessionVersion: true, role: true, isProtected: true, isSystemOwner: true }
      });
      if (!activeUser || activeUser.sessionVersion !== payload.sessionVersion) {
        throw new UnauthorizedException('La sesión fue revocada');
      }

      payload.role = activeUser.role;
      payload.isProtected = activeUser.isProtected;
      payload.isSystemOwner = activeUser.isSystemOwner;

      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Sesion expirada o token invalido');
    }
  }
}
