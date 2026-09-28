-- Incorpora Sinteticos con trece tanques sin alterar plantas, equipos ni accesos existentes.
-- La configuración operativa parte de Látex y luego puede administrarse por planta.
INSERT INTO "Plant" (
  "id", "companyId", "code", "name", "displayOrder", "finalOperation", "settings", "updatedAt"
)
SELECT
  'plant_sinteticos_' || md5(c."id"),
  c."id",
  'SINTETICOS',
  'Sinteticos',
  50,
  'PACKAGING',
  latex."settings",
  CURRENT_TIMESTAMP
FROM "Company" c
LEFT JOIN "Plant" latex
  ON latex."companyId" = c."id" AND latex."code" = 'LATEX'
ON CONFLICT ("companyId", "code") DO NOTHING;

INSERT INTO "Tank" (
  "id", "companyId", "plantId", "number", "name", "equipmentCode",
  "equipmentType", "telemetryMode", "capacityKg", "scaleKey", "updatedAt"
)
SELECT
  'eq_sinteticos_' || n || '_' || md5(p."companyId"),
  p."companyId",
  p."id",
  n,
  'TANQUE ' || n,
  'SIN' || lpad(n::text, 2, '0'),
  'TANK',
  'PENDING',
  NULL,
  NULL,
  CURRENT_TIMESTAMP
FROM "Plant" p
CROSS JOIN generate_series(1, 13) n
WHERE p."code" = 'SINTETICOS'
ON CONFLICT ("plantId", "number") DO NOTHING;

INSERT INTO "TankStateHistory" (
  "id", "companyId", "plantId", "tankId", "state", "description"
)
SELECT
  'hist_' || t."id",
  t."companyId",
  t."plantId",
  t."id",
  'VACIO',
  'Estado inicial'
FROM "Tank" t
LEFT JOIN "TankStateHistory" h
  ON h."tankId" = t."id" AND h."endedAt" IS NULL
JOIN "Plant" p ON p."id" = t."plantId"
WHERE p."code" = 'SINTETICOS' AND h."id" IS NULL;

-- El alta no amplía permisos operativos generales: sólo administradores y dueños
-- reciben acceso inicial; el resto se asigna explícitamente desde Usuarios.
INSERT INTO "UserPlantAccess" ("userId", "plantId")
SELECT u."id", p."id"
FROM "User" u
JOIN "Plant" p ON p."companyId" = u."companyId" AND p."code" = 'SINTETICOS'
WHERE u."role" = 'ADMIN' OR u."isSystemOwner" = true
ON CONFLICT DO NOTHING;
