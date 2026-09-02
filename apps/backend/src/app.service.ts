import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  health() {
    return {
      status: 'ok',
      service: 'DISAL-industria-metalurgica-backend',
      timestamp: new Date().toISOString()
    };
  }
}
