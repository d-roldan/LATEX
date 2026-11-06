import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { JwtUser } from '../../common/auth/jwt-user.interface';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { ReportingService } from './reporting.service';
import { ReportingLaboratoryService } from './reporting-laboratory.service';
import { ReportingProductionService } from './reporting-production.service';

@Controller('reporting')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MONITOREO', 'JEFATURA', 'ADMIN')
export class ReportingController {
  constructor(
    private readonly service: ReportingService,
    private readonly laboratory: ReportingLaboratoryService,
    private readonly production: ReportingProductionService
  ) {}

  @Get('capabilities')
  @Roles('LABORATORIO', 'MONITOREO', 'JEFATURA', 'ADMIN')
  capabilities(@CurrentUser() user: JwtUser) {
    return this.service.capabilities(user);
  }

  @Get('laboratory')
  @Roles('LABORATORIO', 'MONITOREO', 'JEFATURA', 'ADMIN')
  laboratoryDashboard(
    @CurrentUser() user: JwtUser,
    @Query('month') month?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('plantIds') plantIds?: string
  ) {
    return this.laboratory.dashboard(user, { month, from, to, plantIds });
  }

  @Get('laboratory/adjustments')
  @Roles('LABORATORIO', 'MONITOREO', 'JEFATURA', 'ADMIN')
  laboratoryAdjustments(
    @CurrentUser() user: JwtUser,
    @Query('month') month?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('plantIds') plantIds?: string,
    @Query('materialCode') materialCode?: string,
    @Query('lotId') lotId?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string
  ) {
    return this.laboratory.adjustments(user, {
      month,
      from,
      to,
      plantIds,
      materialCode,
      lotId,
      offset,
      limit
    });
  }

  @Get('laboratory/lots/:lotId')
  @Roles('LABORATORIO', 'MONITOREO', 'JEFATURA', 'ADMIN')
  laboratoryLot(@CurrentUser() user: JwtUser, @Param('lotId') lotId: string) {
    return this.laboratory.lotDetail(user, lotId);
  }

  @Get('overview')
  overview(
    @CurrentUser() user: JwtUser,
    @Query('month') month?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('plantIds') plantIds?: string
  ) {
    return this.service.overview(user, { month, from, to, plantIds });
  }

  @Get('production')
  productionDashboard(
    @CurrentUser() user: JwtUser,
    @Query('month') month?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('plantIds') plantIds?: string
  ) {
    return this.production.dashboard(user, { month, from, to, plantIds });
  }

  @Get('orders')
  orders(
    @CurrentUser() user: JwtUser,
    @Query('month') month?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('plantIds') plantIds?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string
  ) {
    return this.service.orders(user, { month, from, to, plantIds, offset, limit });
  }
}
