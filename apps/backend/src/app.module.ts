import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { UsersModule } from './modules/users/users.module';
import { ClientsModule } from './modules/clients/clients.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ResourcesModule } from './modules/resources/resources.module';
import { OperationLogsModule } from './modules/operation-logs/operation-logs.module';
import { MaterialsModule } from './modules/materials/materials.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditModule } from './modules/audit/audit.module';
import { AiAssistantModule } from './modules/ai-assistant/ai-assistant.module';
import { CabinModelsModule } from './modules/cabin-models/cabin-models.module';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { RolesGuard } from './common/auth/roles.guard';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { APP_GUARD } from '@nestjs/core';
import { RateLimitGuard } from './common/security/rate-limit.guard';
import { PlantModule } from './modules/plant/plant.module';

@Module({
  imports: [
    ConfigModule.forRoot({ 
      isGlobal: true,
      envFilePath: ['.env', '../../.env']
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    CompaniesModule,
    UsersModule,
    ClientsModule,
    OrdersModule,
    ResourcesModule,
    OperationLogsModule,
    MaterialsModule,
    ReportsModule,
    AuditModule,
    AiAssistantModule,
    CabinModelsModule,
    NotificationsModule,
    PlantModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    JwtAuthGuard,
    RolesGuard,
    { provide: APP_GUARD, useClass: RateLimitGuard }
  ]
})
export class AppModule {}
