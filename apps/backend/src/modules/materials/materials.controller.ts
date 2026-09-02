import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from '@nestjs/common';
import { MaterialsService } from './materials.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtUser } from '../../common/auth/jwt-user.interface';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';

@Controller('materials')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MaterialsController {
  constructor(private readonly service: MaterialsService) {}

  @Get('status')
  status() {
    return this.service.getStatus();
  }

  @Get()
  findAll(@CurrentUser() user: JwtUser, @Query('search') search?: string) {
    return this.service.findAll(user.companyId, search, user.role !== 'OPERARIO');
  }

  @Post()
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN')
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateMaterialDto) {
    return this.service.create(user.companyId, dto);
  }

  @Patch(':id')
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN')
  update(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateMaterialDto) {
    return this.service.update(user.companyId, id, dto);
  }

  @Post(':id/adjust-stock')
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN')
  adjustStock(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: AdjustStockDto
  ) {
    return this.service.adjustStock(user.companyId, id, dto);
  }

  @Delete(':id')
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN')
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.remove(user.companyId, id);
  }
}

