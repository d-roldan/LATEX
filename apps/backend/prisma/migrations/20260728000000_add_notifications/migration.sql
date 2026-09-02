CREATE TYPE "NotificationType" AS ENUM ('STAGE_ASSIGNED', 'STAGE_COMPLETED');

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "orderId" TEXT,
  "orderStageId" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_companyId_userId_createdAt_idx"
  ON "Notification"("companyId", "userId", "createdAt");
CREATE INDEX "Notification_userId_readAt_idx"
  ON "Notification"("userId", "readAt");

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
