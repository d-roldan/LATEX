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
import { ResourcesService } from './resources.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtUser } from '../../common/auth/jwt-user.interface';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';

@Controller('resources')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ResourcesController {
  constructor(private readonly service: ResourcesService) {}

  @Get('status')
  status() {
    return this.service.getStatus();
  }

  @Get()
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN')
  findAll(
    @CurrentUser() user: JwtUser,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('search') search?: string
  ) {
    return this.service.findAll(user.companyId, type, status, search);
  }

  @Post()
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN')
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateResourceDto) {
    return this.service.create(user.companyId, dto);
  }

  @Patch(':id')
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN')
  update(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateResourceDto) {
    return this.service.update(user.companyId, id, dto);
  }

  @Delete(':id')
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN')
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.remove(user.companyId, id);
  }
}

