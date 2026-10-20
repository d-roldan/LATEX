import { Module } from '@nestjs/common';
import {
  PlantController,
  PlantPublicScopedController,
  PlantScopedController
} from './plant.controller';
import { PlantService } from './plant.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { InfluxHistoryService } from './influx-history.service';
import { IntegrationInboxController } from './integration-inbox.controller';
import { IntegrationInboxService } from './integration-inbox.service';
import { PlantIntegrationAuthService } from './plant-integration-auth.service';
import { InjectionMachinesService } from './injection-machines.service';
import { InjectionHistoryService } from './injection-history.service';
import { InjectionCmsHistoryService } from './injection-cms-history.service';

@Module({
  imports: [NotificationsModule],
  controllers: [
    PlantController,
    PlantPublicScopedController,
    PlantScopedController,
    IntegrationInboxController
  ],
  providers: [
    PlantService,
    InfluxHistoryService,
    PlantIntegrationAuthService,
    InjectionMachinesService,
    InjectionHistoryService,
    InjectionCmsHistoryService,
    IntegrationInboxService
  ]
})
export class PlantModule {}
