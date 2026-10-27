import { Controller, Get, Header } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AppService } from './app.service';

@Controller('health')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  health() {
    return this.appService.health();
  }

  @Get('time')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { ttl: 60000, limit: 600 } })
  time() {
    return { now: new Date().toISOString() };
  }
}
