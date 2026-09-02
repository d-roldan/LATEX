import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { OperationLogsService } from './operation-logs.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtUser } from '../../common/auth/jwt-user.interface';

@Controller('operation-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OperationLogsController {
  constructor(private readonly service: OperationLogsService) {}

  @Get('status')
  status() {
    return this.service.getStatus();
  }

  @Get()
  findAll(
    @CurrentUser() user: JwtUser,
    @Query('orderId') orderId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.service.findAll(user, orderId, from, to);
  }

  @Get('order/:orderId')
  findByOrder(@CurrentUser() user: JwtUser, @Param('orderId') orderId: string) {
    return this.service.findByOrder(user, orderId);
  }
}
