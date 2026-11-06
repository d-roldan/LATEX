ALTER TABLE "PackagingOrder" ADD COLUMN "cancelledAt" TIMESTAMPTZ(3);
ALTER TABLE "TransferOperation" ADD COLUMN "cancelledAt" TIMESTAMPTZ(3);
