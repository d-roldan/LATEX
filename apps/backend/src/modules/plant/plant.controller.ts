import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { JwtUser } from '../../common/auth/jwt-user.interface';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { CorrectLotDto, CorrectPackagingDto, PackagingDto, QualityDecisionDto, ServiceDto, StartManufacturingDto, VersionedActionDto, WeightBatchDto } from './dto/plant.dto';
import { PlantService } from './plant.service';

@Controller('plant')
export class PlantController {
  constructor(private readonly service: PlantService) {}

  @Post('telemetry/weights')
  weights(@Headers('x-node-red-key') key: string | undefined, @Headers('x-company-id') companyId: string | undefined, @Body() dto: WeightBatchDto) {
    return this.service.ingestWeights(key, companyId, dto);
  }
}

@Controller('plant')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlantProtectedController {
  constructor(private readonly service: PlantService) {}

  @Get('config') @Roles('FABRICACION', 'LABORATORIO', 'ENVASADO', 'MONITOREO', 'ADMIN')
  config(@CurrentUser() user: JwtUser) { return this.service.getConfig(user.companyId); }

  @Get('tanks') @Roles('FABRICACION', 'LABORATORIO', 'ENVASADO', 'MONITOREO', 'ADMIN')
  tanks(@CurrentUser() user: JwtUser) { return this.service.tanks(user.companyId); }

  @Post('tanks/:id/manufacturing') @Roles('FABRICACION', 'ADMIN')
  start(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: StartManufacturingDto) { return this.service.start(user.companyId, id, user, dto); }

  @Post('tanks/:id/send-to-lab') @Roles('FABRICACION', 'ADMIN')
  sendToLab(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: VersionedActionDto) { return this.service.sendToLab(user.companyId, id, user, dto); }

  @Post('tanks/:id/quality') @Roles('LABORATORIO', 'ADMIN')
  quality(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: QualityDecisionDto) { return this.service.quality(user.companyId, id, user, dto); }

  @Post('tanks/:id/packaging') @Roles('ENVASADO', 'ADMIN')
  packaging(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: PackagingDto) { return this.service.startPackaging(user.companyId, id, user, dto); }

  @Post('tanks/:id/packaging/new-order') @Roles('ENVASADO', 'ADMIN')
  newOrder(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: PackagingDto) { return this.service.newPackagingOrder(user.companyId, id, user, dto); }

  @Patch('tanks/:id/packaging/current') @Roles('ENVASADO', 'ADMIN')
  correctOrder(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: CorrectPackagingDto) { return this.service.correctPackaging(user.companyId, id, user, dto); }

  @Post('tanks/:id/packaging/finish') @Roles('ENVASADO', 'ADMIN')
  finish(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: VersionedActionDto) { return this.service.finishPackaging(user.companyId, id, user, dto); }

  @Post('tanks/:id/empty-rejected') @Roles('FABRICACION', 'ADMIN')
  emptyRejected(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: VersionedActionDto) { return this.service.emptyRejected(user.companyId, id, user, dto); }

  @Post('tanks/:id/service-out') @Roles('FABRICACION', 'ADMIN')
  serviceOut(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: ServiceDto) { return this.service.serviceOut(user.companyId, id, user, dto); }

  @Post('tanks/:id/service-in') @Roles('FABRICACION', 'ADMIN')
  serviceIn(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: VersionedActionDto) { return this.service.serviceIn(user.companyId, id, user, dto); }

  @Patch('tanks/:id/lot') @Roles('FABRICACION', 'ADMIN')
  correctLot(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: CorrectLotDto) { return this.service.correctLot(user.companyId, id, user, dto); }

  @Get('history/states') @Roles('MONITOREO', 'ADMIN')
  history(@CurrentUser() user: JwtUser, @Query('tankId') tankId?: string, @Query('state') state?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.history(user.companyId, tankId, state, from, to);
  }

  @Get('history/audit') @Roles('ADMIN')
  audit(@CurrentUser() user: JwtUser, @Query('tankId') tankId?: string) { return this.service.auditHistory(user.companyId, tankId); }
}
