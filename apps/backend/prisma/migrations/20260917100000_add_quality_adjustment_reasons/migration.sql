ALTER TABLE "QualityDecision"
ADD COLUMN "adjustmentReasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
