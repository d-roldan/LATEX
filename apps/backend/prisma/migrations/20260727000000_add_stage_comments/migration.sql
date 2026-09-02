CREATE TABLE "StageComment" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "orderStageId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StageComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StageComment_companyId_orderStageId_createdAt_idx"
  ON "StageComment"("companyId", "orderStageId", "createdAt");
CREATE INDEX "StageComment_authorId_idx" ON "StageComment"("authorId");

ALTER TABLE "StageComment"
  ADD CONSTRAINT "StageComment_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StageComment"
  ADD CONSTRAINT "StageComment_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StageComment"
  ADD CONSTRAINT "StageComment_orderStageId_fkey"
  FOREIGN KEY ("orderStageId") REFERENCES "OrderStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StageComment"
  ADD CONSTRAINT "StageComment_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
