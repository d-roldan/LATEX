import { Module } from '@nestjs/common';
import { PlantController, PlantProtectedController, PlantPublicScopedController, PlantScopedController } from './plant.controller';
import { PlantService } from './plant.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { InfluxHistoryService } from './influx-history.service';

@Module({ imports: [NotificationsModule], controllers: [PlantController, PlantProtectedController, PlantPublicScopedController, PlantScopedController], providers: [PlantService, InfluxHistoryService] })
export class PlantModule {}
