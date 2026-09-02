ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "username" TEXT;

WITH normalized AS (
  SELECT
    "id",
    "companyId",
    COALESCE(
      NULLIF(
        regexp_replace(
          lower(split_part("email", '@', 1)),
          '[^a-z0-9._-]+',
          '',
          'g'
        ),
        ''
      ),
      'usuario'
    ) AS base_username,
    "createdAt"
  FROM "User"
  WHERE "username" IS NULL
),
ranked AS (
  SELECT
    "id",
    base_username,
    row_number() OVER (
      PARTITION BY "companyId", base_username
      ORDER BY "createdAt", "id"
    ) AS occurrence
  FROM normalized
)
UPDATE "User" AS target
SET "username" = CASE
  WHEN ranked.occurrence = 1 THEN ranked.base_username
  ELSE ranked.base_username || '-' || ranked.occurrence
END
FROM ranked
WHERE target."id" = ranked."id";

ALTER TABLE "User"
ALTER COLUMN "username" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "User_companyId_username_key"
ON "User" ("companyId", "username");
