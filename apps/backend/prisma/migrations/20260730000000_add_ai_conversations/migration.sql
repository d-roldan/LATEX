CREATE TYPE "AiMessageRole" AS ENUM ('USER', 'ASSISTANT');

CREATE TABLE "AiConversation" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiMessage" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "role" "AiMessageRole" NOT NULL,
  "content" TEXT NOT NULL,
  "evidence" JSONB,
  "contextUsed" JSONB,
  "suggestions" JSONB,
  "caveats" JSONB,
  "model" TEXT,
  "latencyMs" INTEGER,
  "isFallback" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiConversation_companyId_userId_lastMessageAt_idx"
  ON "AiConversation"("companyId", "userId", "lastMessageAt");
CREATE INDEX "AiMessage_conversationId_createdAt_idx"
  ON "AiMessage"("conversationId", "createdAt");

ALTER TABLE "AiConversation"
  ADD CONSTRAINT "AiConversation_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiConversation"
  ADD CONSTRAINT "AiConversation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiMessage"
  ADD CONSTRAINT "AiMessage_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
