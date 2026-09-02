import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtUser } from '../../common/auth/jwt-user.interface';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { CabinModelsService } from './cabin-models.service';

@Controller('cabin-models')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CabinModelsController {
  constructor(private readonly service: CabinModelsService) {}

  @Get()
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN')
  findAll(@CurrentUser() user: JwtUser) {
    return this.service.findAll(user.companyId);
  }
}
