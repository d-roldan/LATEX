import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AiAssistantChatDto {
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  message!: string;

  @IsOptional()
  @IsString()
  conversationId?: string;
}

export class CreateAiConversationDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;
}
