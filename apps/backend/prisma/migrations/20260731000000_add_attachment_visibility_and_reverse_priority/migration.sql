ALTER TABLE "OrderAttachment"
ADD COLUMN "isInternal" BOOLEAN NOT NULL DEFAULT false;

-- La escala anterior era 1 = máxima y 5 = mínima.
-- Se invierten los datos existentes para adoptar 1 = mínima y 5 = máxima.
UPDATE "Order"
SET "priority" = 6 - "priority"
WHERE "priority" BETWEEN 1 AND 5;
