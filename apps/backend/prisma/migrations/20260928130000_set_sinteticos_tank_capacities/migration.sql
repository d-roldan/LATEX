-- Registra los pesos máximos confirmados para los trece tanques de Sinteticos.
UPDATE "Tank" AS tank
SET
  "capacityKg" = capacities."capacityKg",
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Plant" AS plant,
(
  VALUES
    (1, 6600),
    (2, 6000),
    (3, 4800),
    (4, 7200),
    (5, 7200),
    (6, 12000),
    (7, 12000),
    (8, 12000),
    (9, 12000),
    (10, 20400),
    (11, 20400),
    (12, 24000),
    (13, 12000)
) AS capacities("number", "capacityKg")
WHERE plant."id" = tank."plantId"
  AND capacities."number" = tank."number"
  AND plant."code" = 'SINTETICOS';
