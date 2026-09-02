import { Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { JwtUser } from '../../common/auth/jwt-user.interface';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: JwtUser, @Query('limit') limit?: string) {
    return this.notifications.list(user, Number(limit ?? 30));
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: JwtUser) {
    return this.notifications.markAllRead(user);
  }
}
