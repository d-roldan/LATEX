ALTER TABLE "QualityDecision" ADD COLUMN "cancelledAt" TIMESTAMPTZ(3);
ALTER TABLE "LaboratorySample" ADD COLUMN "cancelledAt" TIMESTAMPTZ(3);
