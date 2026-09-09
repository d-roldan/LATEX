import { BadRequestException, Body, Controller, Get, Header, Headers, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { JwtUser } from '../../common/auth/jwt-user.interface';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { CorrectLotDto, CorrectPackagingDto, DailyClosureDto, FinishPackagingDto, PackagingDto, QualityDecisionDto, ServiceDto, StageTargetsDto, StartManufacturingDto, VersionedActionDto, WeightBatchDto } from './dto/plant.dto';
import { PlantService } from './plant.service';

@Controller('plant')
export class PlantController {
  constructor(private readonly service: PlantService) {}

  @Get('tv')
  @Header('Cache-Control', 'no-store')
  tv() { return this.service.publicTanks(); }

  @Post('telemetry/weights')
  weights(@Headers('x-node-red-key') key: string | undefined, @Headers('x-company-id') companyId: string | undefined, @Body() dto: WeightBatchDto) {
    return this.service.ingestWeights(key, companyId, dto);
  }
}

@Controller('plants')
export class PlantPublicScopedController {
  constructor(private readonly service: PlantService) {}
  @Get(':plantCode/tv') @Header('Cache-Control', 'no-store')
  tv(@Param('plantCode') code: string) { return this.service.publicTanks(code); }
  @Post(':plantCode/telemetry/weights')
  weights(@Param('plantCode') code: string, @Headers('x-node-red-key') key: string | undefined, @Body() dto: WeightBatchDto) { return this.service.ingestPlantWeights(code, key, dto); }
}

@Controller('plants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlantScopedController {
  constructor(private readonly service: PlantService) {}
  @Get() @Roles('FABRICACION', 'LABORATORIO', 'ENVASADO', 'MONITOREO', 'JEFATURA', 'ADMIN')
  list(@CurrentUser() u: JwtUser) { return this.service.authorizedPlants(u.companyId,u.sub); }
  @Get(':plantCode/config') @Roles('FABRICACION', 'LABORATORIO', 'ENVASADO', 'MONITOREO', 'JEFATURA', 'ADMIN')
  config(@CurrentUser() u: JwtUser,@Param('plantCode') c:string) { return this.service.scopedConfig(u.companyId,u.sub,c); }
  @Get(':plantCode/tanks') @Roles('FABRICACION', 'LABORATORIO', 'ENVASADO', 'MONITOREO', 'JEFATURA', 'ADMIN')
  tanks(@CurrentUser() u: JwtUser,@Param('plantCode') c:string) { return this.service.scopedTanks(u.companyId,u.sub,c); }
  @Post(':plantCode/tanks/:id/manufacturing') @Roles('FABRICACION','ADMIN')
  async start(@CurrentUser() u:JwtUser,@Param('plantCode') c:string,@Param('id') id:string,@Body() d:StartManufacturingDto) { await this.service.assertPlantAccess(u.companyId,u.sub,c,id); return this.service.start(u.companyId,id,u,d); }
  @Post(':plantCode/tanks/:id/send-to-lab') @Roles('FABRICACION','ADMIN')
  async lab(@CurrentUser() u:JwtUser,@Param('plantCode') c:string,@Param('id') id:string,@Body() d:VersionedActionDto) { await this.service.assertPlantAccess(u.companyId,u.sub,c,id); return this.service.sendToLab(u.companyId,id,u,d); }
  @Post(':plantCode/tanks/:id/quality') @Roles('LABORATORIO','ADMIN')
  async quality(@CurrentUser() u:JwtUser,@Param('plantCode') c:string,@Param('id') id:string,@Body() d:QualityDecisionDto) { await this.service.assertPlantAccess(u.companyId,u.sub,c,id); return this.service.quality(u.companyId,id,u,d); }
  @Post(':plantCode/tanks/:id/packaging') @Roles('ENVASADO','ADMIN')
  async packaging(@CurrentUser() u:JwtUser,@Param('plantCode') c:string,@Param('id') id:string,@Body() d:PackagingDto) { await this.service.assertPlantAccess(u.companyId,u.sub,c,id); return this.service.startPackaging(u.companyId,id,u,d); }
  @Post(':plantCode/tanks/:id/packaging/new-order') @Roles('ENVASADO','ADMIN')
  async newOrder(@CurrentUser() u:JwtUser,@Param('plantCode') c:string,@Param('id') id:string,@Body() d:PackagingDto) { await this.service.assertPlantAccess(u.companyId,u.sub,c,id); return this.service.newPackagingOrder(u.companyId,id,u,d); }
  @Patch(':plantCode/tanks/:id/packaging/current') @Roles('ENVASADO','ADMIN')
  async correctOrder(@CurrentUser() u:JwtUser,@Param('plantCode') c:string,@Param('id') id:string,@Body() d:CorrectPackagingDto) { await this.service.assertPlantAccess(u.companyId,u.sub,c,id); return this.service.correctPackaging(u.companyId,id,u,d); }
  @Post(':plantCode/tanks/:id/packaging/finish') @Roles('ENVASADO','ADMIN')
  async finishPackaging(@CurrentUser() u:JwtUser,@Param('plantCode') c:string,@Param('id') id:string,@Body() d:FinishPackagingDto) { await this.service.assertPlantAccess(u.companyId,u.sub,c,id); return this.service.finishPackaging(u.companyId,id,u,d); }
  @Post(':plantCode/tanks/:id/transfer') @Roles('FABRICACION','ENVASADO','ADMIN')
  async transfer(@CurrentUser() u:JwtUser,@Param('plantCode') c:string,@Param('id') id:string,@Body() d:VersionedActionDto) { await this.service.assertPlantAccess(u.companyId,u.sub,c,id); return this.service.startTransfer(u.companyId,id,u,d); }
  @Post(':plantCode/tanks/:id/transfer/finish') @Roles('FABRICACION','ENVASADO','ADMIN')
  async finishTransfer(@CurrentUser() u:JwtUser,@Param('plantCode') c:string,@Param('id') id:string,@Body() d:VersionedActionDto) { await this.service.assertPlantAccess(u.companyId,u.sub,c,id); return this.service.finishTransfer(u.companyId,id,u,d); }
  @Post(':plantCode/tanks/:id/empty-rejected') @Roles('FABRICACION','ADMIN')
  async empty(@CurrentUser() u:JwtUser,@Param('plantCode') c:string,@Param('id') id:string,@Body() d:VersionedActionDto) { await this.service.assertPlantAccess(u.companyId,u.sub,c,id); return this.service.emptyRejected(u.companyId,id,u,d); }
  @Post(':plantCode/tanks/:id/service-out') @Roles('FABRICACION','ADMIN')
  async serviceOut(@CurrentUser() u:JwtUser,@Param('plantCode') c:string,@Param('id') id:string,@Body() d:ServiceDto) { await this.service.assertPlantAccess(u.companyId,u.sub,c,id); return this.service.serviceOut(u.companyId,id,u,d); }
  @Post(':plantCode/tanks/:id/service-in') @Roles('FABRICACION','ADMIN')
  async serviceIn(@CurrentUser() u:JwtUser,@Param('plantCode') c:string,@Param('id') id:string,@Body() d:VersionedActionDto) { await this.service.assertPlantAccess(u.companyId,u.sub,c,id); return this.service.serviceIn(u.companyId,id,u,d); }
  @Patch(':plantCode/tanks/:id/lot') @Roles('FABRICACION','ADMIN')
  async lot(@CurrentUser() u:JwtUser,@Param('plantCode') c:string,@Param('id') id:string,@Body() d:CorrectLotDto) { await this.service.assertPlantAccess(u.companyId,u.sub,c,id); return this.service.correctLot(u.companyId,id,u,d); }
  @Get(':plantCode/history/states') @Roles('MONITOREO','JEFATURA','ADMIN')
  async history(@CurrentUser() u:JwtUser,@Param('plantCode') c:string,@Query('tankId') tankId?:string,@Query('state') state?:string,@Query('from') from?:string,@Query('to') to?:string) { const p=await this.service.assertPlantAccess(u.companyId,u.sub,c,tankId); return this.service.history(u.companyId,tankId,state,from,to,p.id); }
  @Get(':plantCode/history/audit') @Roles('ADMIN')
  async audit(@CurrentUser() u:JwtUser,@Param('plantCode') c:string,@Query('tankId') tankId?:string) { const p=await this.service.assertPlantAccess(u.companyId,u.sub,c,tankId); return this.service.auditHistory(u.companyId,tankId,p.id); }
  @Get(':plantCode/management/daily') @Roles('JEFATURA','ADMIN')
  async daily(@CurrentUser() u:JwtUser,@Param('plantCode') c:string,@Query('date') date:string) { const p=await this.service.assertPlantAccess(u.companyId,u.sub,c); return this.service.dailyManagement(u.companyId,date,p.id); }
  @Get(':plantCode/management/lots/:id/timeline') @Roles('MONITOREO','JEFATURA','ADMIN')
  async timeline(@CurrentUser() u:JwtUser,@Param('plantCode') c:string,@Param('id') id:string) { const p=await this.service.assertPlantAccess(u.companyId,u.sub,c); return this.service.lotTimeline(u.companyId,id,p.id); }
  @Post(':plantCode/management/closures') @Roles('JEFATURA','ADMIN')
  async close(@CurrentUser() u:JwtUser,@Param('plantCode') c:string,@Body() d:DailyClosureDto) { const p=await this.service.assertPlantAccess(u.companyId,u.sub,c); return this.service.closeDay(u.companyId,u,d,p.id); }
  @Patch(':plantCode/management/targets') @Roles('ADMIN')
  async targets(@CurrentUser() u:JwtUser,@Param('plantCode') c:string,@Body() d:StageTargetsDto) { const p=await this.service.assertPlantAccess(u.companyId,u.sub,c); return this.service.updateTargets(u.companyId,d,p.id); }
  @Get(':plantCode/management/export') @Roles('JEFATURA','ADMIN')
  async export(@CurrentUser() u:JwtUser,@Param('plantCode') c:string,@Query('date') date:string,@Query('format') format:string,@Res() response:Response) { if(format!=='pdf'&&format!=='xls') throw new BadRequestException('Formato no soportado'); const p=await this.service.assertPlantAccess(u.companyId,u.sub,c); const file=await this.service.managementExport(u.companyId,date,format,p.id); response.setHeader('Content-Type',file.contentType); response.setHeader('Content-Disposition',`attachment; filename="${file.filename}"`); response.send(file.body); }
}

@Controller('plant')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlantProtectedController {
  constructor(private readonly service: PlantService) {}

  @Get('config') @Roles('FABRICACION', 'LABORATORIO', 'ENVASADO', 'MONITOREO', 'JEFATURA', 'ADMIN')
  config(@CurrentUser() user: JwtUser) { return this.service.getConfig(user.companyId); }

  @Get('tanks') @Roles('FABRICACION', 'LABORATORIO', 'ENVASADO', 'MONITOREO', 'JEFATURA', 'ADMIN')
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
  finish(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: FinishPackagingDto) { return this.service.finishPackaging(user.companyId, id, user, dto); }

  @Post('tanks/:id/empty-rejected') @Roles('FABRICACION', 'ADMIN')
  emptyRejected(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: VersionedActionDto) { return this.service.emptyRejected(user.companyId, id, user, dto); }

  @Post('tanks/:id/service-out') @Roles('FABRICACION', 'ADMIN')
  serviceOut(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: ServiceDto) { return this.service.serviceOut(user.companyId, id, user, dto); }

  @Post('tanks/:id/service-in') @Roles('FABRICACION', 'ADMIN')
  serviceIn(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: VersionedActionDto) { return this.service.serviceIn(user.companyId, id, user, dto); }

  @Patch('tanks/:id/lot') @Roles('FABRICACION', 'ADMIN')
  correctLot(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: CorrectLotDto) { return this.service.correctLot(user.companyId, id, user, dto); }

  @Get('history/states') @Roles('MONITOREO', 'JEFATURA', 'ADMIN')
  history(@CurrentUser() user: JwtUser, @Query('tankId') tankId?: string, @Query('state') state?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.history(user.companyId, tankId, state, from, to);
  }

  @Get('history/audit') @Roles('ADMIN')
  audit(@CurrentUser() user: JwtUser, @Query('tankId') tankId?: string) { return this.service.auditHistory(user.companyId, tankId); }

  @Get('management/daily') @Roles('JEFATURA', 'ADMIN')
  daily(@CurrentUser() user: JwtUser, @Query('date') date: string) { return this.service.dailyManagement(user.companyId, date); }

  @Get('management/lots/:id/timeline') @Roles('MONITOREO', 'JEFATURA', 'ADMIN')
  timeline(@CurrentUser() user: JwtUser, @Param('id') id: string) { return this.service.lotTimeline(user.companyId, id); }

  @Post('management/closures') @Roles('JEFATURA', 'ADMIN')
  closeDay(@CurrentUser() user: JwtUser, @Body() dto: DailyClosureDto) { return this.service.closeDay(user.companyId, user, dto); }

  @Get('management/closures') @Roles('JEFATURA', 'ADMIN')
  closures(@CurrentUser() user: JwtUser) { return this.service.closures(user.companyId); }

  @Patch('management/targets') @Roles('ADMIN')
  targets(@CurrentUser() user: JwtUser, @Body() dto: StageTargetsDto) { return this.service.updateTargets(user.companyId, dto); }

  @Get('management/export') @Roles('JEFATURA', 'ADMIN')
  async export(@CurrentUser() user: JwtUser, @Query('date') date: string, @Query('format') format: string, @Res() response: Response) {
    if (format !== 'pdf' && format !== 'xls') throw new BadRequestException('Formato no soportado');
    const file = await this.service.managementExport(user.companyId, date, format);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    response.send(file.body);
  }
}
