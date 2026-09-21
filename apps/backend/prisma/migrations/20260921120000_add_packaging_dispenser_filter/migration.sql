ALTER TABLE "PackagingOrder"
ADD COLUMN "dispenser" TEXT,
ADD COLUMN "filter" TEXT;

UPDATE "Plant"
SET "settings" = jsonb_set(
  jsonb_set(
    COALESCE("settings", '{}'::jsonb),
    '{packagingDispensers}',
    '["A", "B"]'::jsonb
  ),
  '{packagingFilters}',
  '["1", "2", "3"]'::jsonb
)
WHERE "code" = 'LATEX';

UPDATE "Company"
SET "settings" = jsonb_set(
  jsonb_set(
    COALESCE("settings", '{}'::jsonb),
    '{packagingDispensers}',
    '["A", "B"]'::jsonb
  ),
  '{packagingFilters}',
  '["1", "2", "3"]'::jsonb
);
