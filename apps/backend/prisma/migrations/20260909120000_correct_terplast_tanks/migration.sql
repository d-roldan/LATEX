-- Nombres y capacidades confirmados por planta el 9 de septiembre de 2026.
-- number conserva el orden interno 1..4; no modificar IDs, códigos, pesos,
-- lotes activos, estados ni relaciones históricas.
UPDATE "Tank" AS t
SET "name" = mapping.name,
    "capacityKg" = mapping.capacity,
    "updatedAt" = CURRENT_TIMESTAMP
FROM "Plant" AS p,
     (VALUES (1, 'TANQUE 3', 1500),
             (2, 'TANQUE 4', 1500),
             (3, 'TANQUE 5', 8000),
             (4, 'TANQUE 6', 8000)) AS mapping(number, name, capacity)
WHERE t."plantId" = p."id"
  AND p."code" = 'TERPLAST'
  AND t."number" = mapping.number
  AND (t."name" IS DISTINCT FROM mapping.name
       OR t."capacityKg" IS DISTINCT FROM mapping.capacity);
