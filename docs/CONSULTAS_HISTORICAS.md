# Manual de consultas históricas

## Entrar a PostgreSQL

Desde el directorio del proyecto:

```powershell
docker compose exec disal-db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Dentro de `psql`:

```sql
\dt
\d "Tank"
\d "ProductionLot"
\d "TankStateHistory"
\d "QualityDecision"
\d "PackagingOrder"
\d "PlantAuditLog"
```

Los identificadores llevan comillas dobles porque Prisma crea nombres con mayúsculas y minúsculas.

## Tablas principales

| Tabla | Contenido |
|---|---|
| `Tank` | Configuración y estado actual de cada tanque |
| `ProductionLot` | OF, material, producto y vigencia del lote |
| `TankStateHistory` | Un período por estado, con inicio y fin |
| `QualityDecision` | Aprobación, ajuste o rechazo, legajo, motivo y peso específico |
| `PackagingOrder` | OE, línea, formato, inicio, fin y duración |
| `PlantAuditLog` | Correcciones, transiciones, valores anteriores/nuevos y comandos sensibles |
| `User` | Usuario autenticado y rol |

No hay tabla de pesos: por decisión funcional, la telemetría de balanzas no se persiste.

## Estado actual de los 9 tanques

```sql
SELECT t.number AS tanque, t.name, t.state, t."capacityKg", t."scaleKey",
       l."manufacturingOrder" AS of, l."materialCode" AS material, l.description
FROM "Tank" t
LEFT JOIN "ProductionLot" l ON l.id = t."activeLotId"
ORDER BY t.number;
```

## Recorrido completo de una OF

```sql
SELECT t.number AS tanque, l."manufacturingOrder" AS of, h.state,
       h.description, h."startedAt", h."endedAt", u."fullName" AS responsable
FROM "TankStateHistory" h
JOIN "Tank" t ON t.id = h."tankId"
LEFT JOIN "ProductionLot" l ON l.id = h."lotId"
LEFT JOIN "User" u ON u.id = h."userId"
WHERE l."manufacturingOrder" = '12345678'
ORDER BY h."startedAt";
```

## Estados abiertos y permanencia

```sql
SELECT t.number AS tanque, h.state, h."startedAt",
       ROUND(EXTRACT(EPOCH FROM (NOW() - h."startedAt")) / 3600, 2) AS horas
FROM "TankStateHistory" h
JOIN "Tank" t ON t.id = h."tankId"
WHERE h."endedAt" IS NULL
ORDER BY horas DESC;
```

## Decisiones de Laboratorio

```sql
SELECT t.number AS tanque, l."manufacturingOrder" AS of, q.result,
       q."employeeNumber" AS legajo, q."specificWeight", q.reason,
       q."recoveryAction", u."fullName", q."createdAt"
FROM "QualityDecision" q
JOIN "ProductionLot" l ON l.id = q."lotId"
JOIN "Tank" t ON t.id = l."tankId"
JOIN "User" u ON u.id = q."userId"
ORDER BY q."createdAt" DESC
LIMIT 200;
```

## Órdenes de envasado y duración

```sql
SELECT t.number AS tanque, l."manufacturingOrder" AS of,
       p."packagingOrder" AS oe, p.line, p.format,
       p."startedAt", p."finishedAt", p."durationSeconds",
       ROUND(p."durationSeconds" / 60.0, 1) AS minutos
FROM "PackagingOrder" p
JOIN "Tank" t ON t.id = p."tankId"
JOIN "ProductionLot" l ON l.id = p."lotId"
ORDER BY p."startedAt" DESC
LIMIT 200;
```

## Correcciones y comandos sensibles

```sql
SELECT a."createdAt", t.number AS tanque, a.action, a."entityType",
       u."fullName" AS usuario, a.reason, a.before, a.after
FROM "PlantAuditLog" a
LEFT JOIN "Tank" t ON t.id = a."tankId"
LEFT JOIN "User" u ON u.id = a."userId"
WHERE a.action IN ('CORRECTION', 'SCALE_COMMAND')
ORDER BY a."createdAt" DESC;
```

## Exportar una consulta a CSV

Dentro de `psql`:

```sql
\copy (SELECT * FROM "PackagingOrder" ORDER BY "startedAt" DESC) TO '/tmp/ordenes_envasado.csv' CSV HEADER
```

Copiar el archivo al host:

```powershell
docker cp disal-db:/tmp/ordenes_envasado.csv .\ordenes_envasado.csv
```

## Respaldo

```powershell
docker compose exec -T disal-db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > planta-latex.backup
```

Hacer el respaldo antes de migraciones o despliegues. Probar la restauración periódicamente en una base separada.
