import { Module } from '@nestjs/common';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';
import { ReportingLaboratoryService } from './reporting-laboratory.service';
import { ReportingProductionService } from './reporting-production.service';

@Module({
  controllers: [ReportingController],
  providers: [ReportingService, ReportingLaboratoryService, ReportingProductionService]
})
export class ReportingModule {}
