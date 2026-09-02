import { Module } from '@nestjs/common';
import { AiAssistantController } from './ai-assistant.controller';
import { AiAssistantService } from './ai-assistant.service';
import { ReportsModule } from '../reports/reports.module';
import { OrdersModule } from '../orders/orders.module';
import { MaterialsModule } from '../materials/materials.module';
import { ResourcesModule } from '../resources/resources.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [ReportsModule, OrdersModule, MaterialsModule, ResourcesModule, PrismaModule],
  controllers: [AiAssistantController],
  providers: [AiAssistantService]
})
export class AiAssistantModule {}
