import { Module } from '@nestjs/common';
import { CabinModelsController } from './cabin-models.controller';
import { CabinModelsService } from './cabin-models.service';

@Module({
  controllers: [CabinModelsController],
  providers: [CabinModelsService],
  exports: [CabinModelsService]
})
export class CabinModelsModule {}
