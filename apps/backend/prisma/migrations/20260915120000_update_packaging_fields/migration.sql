ALTER TABLE "PackagingOrder" ADD COLUMN "description" TEXT;

UPDATE "PackagingOrder" AS packaging
SET "description" = lot."description"
FROM "ProductionLot" AS lot
WHERE packaging."lotId" = lot."id";

ALTER TABLE "PackagingOrder" ALTER COLUMN "description" SET NOT NULL;

UPDATE "Plant"
SET "settings" = jsonb_set(
  jsonb_set(COALESCE("settings", '{}'::jsonb), '{packagingLines}', '["A", "B"]'::jsonb),
  '{packagingFormats}',
  '["1 L", "4 L", "10 L", "20 L"]'::jsonb
)
WHERE "code" = 'LATEX';

UPDATE "Company"
SET "settings" = jsonb_set(
  jsonb_set(COALESCE("settings", '{}'::jsonb), '{packagingLines}', '["A", "B"]'::jsonb),
  '{packagingFormats}',
  '["1 L", "4 L", "10 L", "20 L"]'::jsonb
);
