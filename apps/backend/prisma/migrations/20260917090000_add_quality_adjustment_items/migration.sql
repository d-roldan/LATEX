CREATE TABLE "QualityAdjustmentItem" (
    "id" TEXT NOT NULL,
    "qualityDecisionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "materialCode" TEXT NOT NULL,
    "quantityKg" DECIMAL(12,3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualityAdjustmentItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QualityAdjustmentItem_qualityDecisionId_position_key"
ON "QualityAdjustmentItem"("qualityDecisionId", "position");

CREATE INDEX "QualityAdjustmentItem_qualityDecisionId_idx"
ON "QualityAdjustmentItem"("qualityDecisionId");

ALTER TABLE "QualityAdjustmentItem"
ADD CONSTRAINT "QualityAdjustmentItem_qualityDecisionId_fkey"
FOREIGN KEY ("qualityDecisionId") REFERENCES "QualityDecision"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
