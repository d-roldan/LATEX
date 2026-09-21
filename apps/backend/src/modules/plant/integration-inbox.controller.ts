import { Body, Controller, Headers, Param, Post } from '@nestjs/common';
import { IndustrialEventBatchDto } from './dto/integration-event.dto';
import { IntegrationInboxService } from './integration-inbox.service';

@Controller('plants')
export class IntegrationInboxController {
  constructor(private readonly inbox: IntegrationInboxService) {}

  @Post(':plantCode/integration/events')
  receive(
    @Param('plantCode') plantCode: string,
    @Headers('x-integration-key') apiKey: string | undefined,
    @Body() dto: IndustrialEventBatchDto
  ) {
    return this.inbox.receive(plantCode, apiKey, dto);
  }
}
