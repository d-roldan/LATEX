import { Module } from '@nestjs/common';
import { PlantController, PlantProtectedController } from './plant.controller';
import { PlantService } from './plant.service';

@Module({ controllers: [PlantController, PlantProtectedController], providers: [PlantService] })
export class PlantModule {}
