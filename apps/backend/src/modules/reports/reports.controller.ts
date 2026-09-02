import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtUser } from '../../common/auth/jwt-user.interface';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DUENO', 'SUPERVISOR', 'ADMIN')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('status')
  status() {
    return this.service.getStatus();
  }

  @Get('dashboard')
  dashboard(
    @CurrentUser() user: JwtUser,
    @Query('months') months?: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    const monthsCount = months ? parseInt(months, 10) : undefined;
    return this.service.dashboard(user, monthsCount, from, to);
  }

  @Get('productivity')
  productivity(
    @CurrentUser() user: JwtUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('clientId') clientId?: string,
    @Query('operatorId') operatorId?: string,
    @Query('status') status?: string
  ) {
    return this.service.productivity(user.companyId, from, to, clientId, operatorId, status);
  }

  @Get('disal-analytics')
  rarAnalytics(
    @CurrentUser() user: JwtUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('modelId') modelId?: string,
    @Query('sector') sector?: string,
    @Query('operatorId') operatorId?: string
  ) {
    return this.service.rarAnalytics(user.companyId, { from, to, modelId, sector, operatorId });
  }
}
