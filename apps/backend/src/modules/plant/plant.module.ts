import { Module } from '@nestjs/common';
import { PlantController, PlantProtectedController, PlantPublicScopedController, PlantScopedController } from './plant.controller';
import { PlantService } from './plant.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { InfluxHistoryService } from './influx-history.service';
import { IntegrationInboxController } from './integration-inbox.controller';
import { IntegrationInboxService } from './integration-inbox.service';
import { PlantIntegrationAuthService } from './plant-integration-auth.service';

@Module({
  imports: [NotificationsModule],
  controllers: [
    PlantController,
    PlantProtectedController,
    PlantPublicScopedController,
    PlantScopedController,
    IntegrationInboxController
  ],
  providers: [
    PlantService,
    InfluxHistoryService,
    PlantIntegrationAuthService,
    IntegrationInboxService
  ]
})
export class PlantModule {}
