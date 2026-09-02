import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AiAssistantService } from './ai-assistant.service';
import { AiAssistantChatDto, CreateAiConversationDto } from './dto/chat.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtUser } from '../../common/auth/jwt-user.interface';
import { Throttle } from '@nestjs/throttler';

@Controller('ai-assistant')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DUENO', 'SUPERVISOR', 'ADMIN')
@Throttle({ default: { ttl: 60000, limit: 5 } })
export class AiAssistantController {
  constructor(private readonly service: AiAssistantService) {}

  @Get('conversations')
  listConversations(@CurrentUser() user: JwtUser) {
    return this.service.listConversations(user);
  }

  @Post('conversations')
  createConversation(@CurrentUser() user: JwtUser, @Body() dto: CreateAiConversationDto) {
    return this.service.createConversation(user, dto.title);
  }

  @Get('conversations/:id')
  getConversation(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.getConversation(user, id);
  }

  @Delete('conversations/:id')
  deleteConversation(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.deleteConversation(user, id);
  }

  @Post('conversations/:id/messages')
  sendMessage(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: AiAssistantChatDto
  ) {
    return this.service.sendMessage(user, id, dto.message);
  }

  @Post('chat')
  chat(@CurrentUser() user: JwtUser, @Body() dto: AiAssistantChatDto) {
    return this.service.chat(user, dto.message, dto.conversationId);
  }
}
