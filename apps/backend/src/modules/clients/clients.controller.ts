import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto, CreateClientContactDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtUser } from '../../common/auth/jwt-user.interface';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientsController {
  constructor(private readonly service: ClientsService) {}

  @Get('status')
  status() { return this.service.getStatus(); }

  @Get()
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN')
  findAll(@CurrentUser() user: JwtUser, @Query() query: PaginationQueryDto) {
    return this.service.findAll(user.companyId, query);
  }

  @Get(':id')
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN')
  findOne(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.findOne(user.companyId, id);
  }

  @Post()
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN')
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateClientDto) {
    return this.service.create(user.companyId, dto);
  }

  @Patch(':id')
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN')
  update(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.service.update(user.companyId, id, dto);
  }

  @Delete(':id')
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN')
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.remove(user.companyId, id);
  }

  // ── Contactos ──────────────────────────────────────────

  @Post(':id/contacts')
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN')
  addContact(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CreateClientContactDto
  ) {
    return this.service.addContact(user.companyId, id, dto);
  }

  @Patch(':id/contacts/:contactId')
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN')
  updateContact(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @Body() dto: Partial<CreateClientContactDto>
  ) {
    return this.service.updateContact(user.companyId, id, contactId, dto);
  }

  @Delete(':id/contacts/:contactId')
  @Roles('DUENO', 'SUPERVISOR', 'ADMIN')
  removeContact(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('contactId') contactId: string
  ) {
    return this.service.removeContact(user.companyId, id, contactId);
  }
}
