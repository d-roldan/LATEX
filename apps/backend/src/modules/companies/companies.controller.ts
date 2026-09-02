import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtUser } from '../../common/auth/jwt-user.interface';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';

@Controller('companies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompaniesController {
  constructor(private readonly service: CompaniesService) {}

  @Get('status')
  status() {
    return this.service.getStatus();
  }

  @Get('me')
  me(@CurrentUser() user: JwtUser) {
    return this.service.me(user.companyId);
  }

  @Get('settings')
  settings(@CurrentUser() user: JwtUser) {
    return this.service.getSettings(user.companyId);
  }

  @Patch('settings')
  @Roles('DUENO', 'ADMIN')
  updateSettings(@CurrentUser() user: JwtUser, @Body() dto: UpdateCompanySettingsDto) {
    return this.service.updateSettings(user, dto);
  }

  @Get('access-matrix')
  accessMatrix() {
    return this.service.getAccessMatrix();
  }
}
