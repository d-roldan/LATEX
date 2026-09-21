import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Delete,
  UseGuards
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtUser } from '../../common/auth/jwt-user.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';
import { UpdateUserPlantsDto } from './dto/update-user-plants.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get('status')
  status() {
    return this.service.getStatus();
  }

  @Get()
  @Roles('ADMIN')
  findAll(
    @CurrentUser() user: JwtUser,
    @Query('role') role?: string,
    @Query('active') active?: string
  ) {
    return this.service.findAll(user.companyId, user, role, active);
  }

  @Get('available-plants')
  @Roles('ADMIN')
  availablePlants(@CurrentUser() user: JwtUser) {
    return this.service.availablePlants(user.companyId);
  }

  @Post()
  @Roles('ADMIN')
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateUserDto) {
    return this.service.create(user.companyId, dto, user.sub);
  }

  @Patch('toggle-active')
  @Roles('ADMIN')
  toggle(@CurrentUser() user: JwtUser, @Body('id') id: string) {
    return this.service.toggleActive(user.companyId, id, user.sub, user);
  }

  @Patch(':id/role')
  @Roles('ADMIN')
  updateRole(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto
  ) {
    return this.service.updateRole(user.companyId, id, dto.role, user.sub, user);
  }

  @Patch(':id/profile')
  @Roles('ADMIN')
  updateProfile(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserProfileDto
  ) {
    return this.service.updateProfile(user.companyId, id, dto, user.sub, user);
  }

  @Patch(':id/plants')
  @Roles('ADMIN')
  updatePlants(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserPlantsDto
  ) {
    return this.service.updatePlants(user.companyId, id, dto.plantIds, user.sub, user);
  }

  @Patch(':id/password')
  @Roles('ADMIN')
  updatePassword(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserPasswordDto
  ) {
    return this.service.updatePassword(user.companyId, id, dto.password, user.sub, user);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.remove(user.companyId, id, user.sub, user);
  }
}
