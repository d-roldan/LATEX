import { Module } from '@nestjs/common';
import { PlantController, PlantProtectedController } from './plant.controller';
import { PlantService } from './plant.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({ imports: [NotificationsModule], controllers: [PlantController, PlantProtectedController], providers: [PlantService] })
export class PlantModule {}
