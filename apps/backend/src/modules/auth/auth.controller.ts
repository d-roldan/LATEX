import { Patch } from '@nestjs/common';
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtUser } from '../../common/auth/jwt-user.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Post('login')
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // Max 5 intentos por minuto por IP
  login(@Body() dto: LoginDto) {
    return this.service.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtUser) {
    return this.service.me(user.sub, user.companyId);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout() {
    return { success: true };
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(@CurrentUser() user: JwtUser, @Body() dto: ChangePasswordDto) {
    return this.service.changePassword(user.sub, user.companyId, dto.oldPassword, dto.newPassword);
  }

  @Get('status')
  status() {
    return this.service.getStatus();
  }
}
