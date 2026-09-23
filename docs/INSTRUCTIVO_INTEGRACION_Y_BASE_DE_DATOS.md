# Instructivo de integración de pesos y consultas de base de datos

Este documento corresponde a la instalación local de **Planta de Látex** disponible en `http://localhost:8081`. Describe cómo enviar las lecturas de los 9 tanques desde Node-RED y cómo consultar o exportar la información persistida en PostgreSQL.

> **Seguridad:** los valores reales están únicamente en el archivo local `.env`, excluido de Git. Antes de instalar el sistema en otra PC se deben definir `POSTGRES_PASSWORD`, `JWT_SECRET`, `SYSTEM_OWNER_PASSWORD` y `NODE_RED_API_KEY`. Nunca se deben escribir claves reales en documentación versionada.

## 1. Accesos de esta instalación

### Aplicación web

| Dato | Valor local |
|---|---|
| URL | `http://localhost:8081` |
| Usuario administrador | `admin@planta.local` |
| Contraseña | Valor de `SYSTEM_OWNER_PASSWORD` en `.env` |
| Rol | `ADMIN` |

### PostgreSQL

| Dato | Valor local |
|---|---|
| Motor | PostgreSQL 16 |
| Host desde Windows | `127.0.0.1` |
| Puerto desde Windows | `5433` |
| Base | `planta_latex` |
| Usuario | `planta_app` |
| Contraseña | Valor de `POSTGRES_PASSWORD` en `.env` |
| Host desde otro contenedor del Compose | `disal-db` |
| Puerto dentro de Docker | `5432` |
| Contenedor | `disal-db` |

Cadena para DBeaver, pgAdmin o una aplicación ejecutada en Windows:

```text
postgresql://planta_app:<POSTGRES_PASSWORD>@127.0.0.1:5433/planta_latex
```

La base sólo se publica en `127.0.0.1`; no acepta conexiones directas desde otras computadoras. Para administración remota se recomienda una VPN o túnel SSH, no exponer PostgreSQL a Internet.

### Integración Node-RED

| Dato | Valor local |
|---|---|
| Endpoint | `POST http://localhost:8081/api/plant/telemetry/weights` |
| Header de autenticación | `X-Node-Red-Key` |
| Clave | Valor de `NODE_RED_API_KEY` en `.env` |
| Empresa predeterminada | `seed_company_disal` |

Si Node-RED corre en otra computadora, reemplazar `localhost` por la IP o nombre DNS de la PC donde corre Docker. El puerto TCP `8081` debe estar permitido en el firewall.

## 2. Contrato para enviar pesos

La aplicación espera una solicitud aproximadamente cada 2 segundos. Conviene enviar los 9 valores juntos. El cuerpo admite entre 1 y 100 lecturas.

| Tanque | `scaleKey` obligatorio |
|---|---|
| TK101 | `TK101` |
| TK102 | `TK102` |
| TK103 | `TK103` |
| TK104 | `TK104` |
| TK105 | `TK105` |
| TK106 | `TK106` |
| TK107 | `TK107` |
| TK108 | `TK108` |
| TK109 | `TK109` |

Campos de cada lectura:

| Campo | Tipo | Obligatorio | Regla |
|---|---|---:|---|
| `scaleKey` | texto | Sí | Uno de los nombres de la tabla anterior |
| `grossKg` | número | Sí | Entre -1000 y 100000, máximo 3 decimales |
| `netKg` | número | No | Entre -1000 y 100000, máximo 3 decimales |
| `measuredAt` | texto ISO 8601 | No | Ejemplo: `2026-09-02T17:47:00.000Z` |

Los números se mandan sin comillas y sin separadores de miles: `5070.125` es correcto; `"5.070,125"` no lo es.

### JSON completo de ejemplo

```json
{
  "readings": [
    { "scaleKey": "TK101", "grossKg": 5070.125, "measuredAt": "2026-09-02T17:47:00.000Z" },
    { "scaleKey": "TK102", "grossKg": 5950.000, "measuredAt": "2026-09-02T17:47:00.000Z" },
    { "scaleKey": "TK103", "grossKg": 5130.000, "measuredAt": "2026-09-02T17:47:00.000Z" },
    { "scaleKey": "TK104", "grossKg": 5355.000, "measuredAt": "2026-09-02T17:47:00.000Z" },
    { "scaleKey": "TK105", "grossKg": 5425.000, "measuredAt": "2026-09-02T17:47:00.000Z" },
    { "scaleKey": "TK106", "grossKg": 8780.000, "measuredAt": "2026-09-02T17:47:00.000Z" },
    { "scaleKey": "TK107", "grossKg": 9545.000, "measuredAt": "2026-09-02T17:47:00.000Z" },
    { "scaleKey": "TK108", "grossKg": 8665.000, "measuredAt": "2026-09-02T17:47:00.000Z" },
    { "scaleKey": "TK109", "grossKg": 8085.000, "measuredAt": "2026-09-02T17:47:00.000Z" }
  ]
}
```

Respuesta correcta:

```json
{
  "accepted": 9,
  "receivedAt": "2026-09-02T17:47:00.120Z",
  "persisted": false
}
```

`persisted: false` confirma que este endpoint no guardó las muestras en PostgreSQL ni las escribió en InfluxDB. El backend mantiene en memoria sólo el último valor de cada tanque para mostrarlo en vivo. En paralelo, el sistema industrial almacena la señal continua segundo a segundo en InfluxDB y LATEX la consulta para reconstruir el histórico. Tras 10 segundos sin recibir una lectura, la balanza se muestra **Sin señal**. Un reinicio del backend borra únicamente los últimos valores en RAM; no elimina las muestras existentes en InfluxDB.

### Ejemplo de Function node de Node-RED

```javascript
const measuredAt = new Date().toISOString();

msg.method = "POST";
msg.url = "http://IP_DEL_SERVIDOR:8081/api/plant/telemetry/weights";
msg.headers = {
  "content-type": "application/json",
  "x-node-red-key": env.get("NODE_RED_API_KEY")
};
msg.payload = {
  readings: [
    { scaleKey: "TK101", grossKg: Number(flow.get("peso_tk101")), measuredAt },
    { scaleKey: "TK102", grossKg: Number(flow.get("peso_tk102")), measuredAt },
    { scaleKey: "TK103", grossKg: Number(flow.get("peso_tk103")), measuredAt },
    { scaleKey: "TK104", grossKg: Number(flow.get("peso_tk104")), measuredAt },
    { scaleKey: "TK105", grossKg: Number(flow.get("peso_tk105")), measuredAt },
    { scaleKey: "TK106", grossKg: Number(flow.get("peso_tk106")), measuredAt },
    { scaleKey: "TK107", grossKg: Number(flow.get("peso_tk107")), measuredAt },
    { scaleKey: "TK108", grossKg: Number(flow.get("peso_tk108")), measuredAt },
    { scaleKey: "TK109", grossKg: Number(flow.get("peso_tk109")), measuredAt }
  ]
};
return msg;
```

Conectar la salida a un nodo **HTTP Request** configurado como `POST` y con retorno JSON. Guardar `NODE_RED_API_KEY` como variable de entorno de Node-RED, no escrita directamente dentro del flow.

### Prueba manual desde PowerShell

```powershell
$nodeRedKey = "<NODE_RED_API_KEY>"
$headers = @{ "X-Node-Red-Key" = $nodeRedKey }
$body = @{
  readings = @(
    @{ scaleKey = "TK101"; grossKg = 1234.567; measuredAt = (Get-Date).ToUniversalTime().ToString("o") }
  )
} | ConvertTo-Json -Depth 4

Invoke-RestMethod -Method Post `
  -Uri "http://localhost:8081/api/plant/telemetry/weights" `
  -Headers $headers -ContentType "application/json" -Body $body
```

Errores usuales:

| HTTP | Causa probable |
|---:|---|
| `400` | JSON inválido, valor fuera de rango o número enviado como texto |
| `401` | Falta `X-Node-Red-Key` o la clave no coincide |
| `429` | Demasiadas solicitudes; Nginx permite 10 solicitudes/s por IP más una ráfaga breve |
| `502`/`503` | Backend detenido o iniciándose |

## 3. Acceder a PostgreSQL

Desde PowerShell, ubicado en la raíz `D:\Proyectos\LatexNuevo\planta-latex`:

```powershell
docker compose exec disal-db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Comandos útiles dentro de `psql`:

```sql
\conninfo
\dt
\d "Tank"
\d "ProductionLot"
\d "TankStateHistory"
\d "QualityDecision"
\d "PackagingOrder"
\d "PlantAuditLog"
\d "User"
\q
```

Prueba directa desde DBeaver o pgAdmin: host `127.0.0.1`, puerto `5433`, base `planta_latex`, usuario `planta_app`, contraseña indicada en la sección 1 y SSL desactivado para esta instalación local.

## 4. Tablas operativas de la planta

| Tabla | Contenido persistido |
|---|---|
| `Tank` | Configuración y estado actual de TK101–TK109 |
| `ProductionLot` | OF, material, descripción, peso específico y vigencia del lote |
| `TankStateHistory` | Inicio y fin de cada permanencia en un estado |
| `QualityDecision` | Resultado de laboratorio, legajo, motivo y recuperación |
| `PackagingOrder` | OE, línea, formato, responsables y duración |
| `PlantAuditLog` | Altas, transiciones y correcciones con valores anterior/nuevo |
| `User` | Usuarios, roles y estado de acceso; la contraseña sólo existe como hash |
| `Company` | Empresa lógica propietaria de los registros |

No existe una tabla de pesos. Esa exclusión es intencional.

## 5. Consultas SQL

### Extraer todos los registros de cada tabla de planta

```sql
SELECT * FROM "Company" ORDER BY "createdAt";
SELECT * FROM "User" ORDER BY "createdAt";
SELECT * FROM "Tank" ORDER BY number;
SELECT * FROM "ProductionLot" ORDER BY "startedAt" DESC;
SELECT * FROM "TankStateHistory" ORDER BY "startedAt" DESC;
SELECT * FROM "QualityDecision" ORDER BY "createdAt" DESC;
SELECT * FROM "PackagingOrder" ORDER BY "startedAt" DESC;
SELECT * FROM "PlantAuditLog" ORDER BY "createdAt" DESC;
```

La consulta cruda de `User` muestra `passwordHash`. No compartir ni exportar ese campo. Para una lista segura:

```sql
SELECT id, email, username, "fullName", role, "isActive", "lockedUntil", "createdAt", "updatedAt"
FROM "User"
ORDER BY "fullName";
```

### Estado actual de los 9 tanques

```sql
SELECT t.number AS tanque, t.name, t.state, t."capacityKg", t."scaleKey",
       l."manufacturingOrder" AS of, l."materialCode" AS material,
       l.description, l."specificWeight", t."updatedAt"
FROM "Tank" t
LEFT JOIN "ProductionLot" l ON l.id = t."activeLotId"
ORDER BY t.number;
```

### Histórico completo, legible y unido

```sql
SELECT h.id, t.name AS tanque, l."manufacturingOrder" AS of,
       h.state, h.description, h."startedAt", h."endedAt",
       ROUND(EXTRACT(EPOCH FROM (COALESCE(h."endedAt", NOW()) - h."startedAt")) / 60.0, 2) AS minutos,
       u."fullName" AS responsable
FROM "TankStateHistory" h
JOIN "Tank" t ON t.id = h."tankId"
LEFT JOIN "ProductionLot" l ON l.id = h."lotId"
LEFT JOIN "User" u ON u.id = h."userId"
ORDER BY h."startedAt" DESC;
```

### Recorrido de una OF específica

```sql
SELECT t.name AS tanque, l."manufacturingOrder" AS of, h.state,
       h.description, h."startedAt", h."endedAt", u."fullName" AS responsable
FROM "TankStateHistory" h
JOIN "Tank" t ON t.id = h."tankId"
JOIN "ProductionLot" l ON l.id = h."lotId"
LEFT JOIN "User" u ON u.id = h."userId"
WHERE l."manufacturingOrder" = '12345678'
ORDER BY h."startedAt";
```

### Historial de un tanque y rango de fechas

```sql
SELECT t.name AS tanque, h.state, h.description, h."startedAt", h."endedAt"
FROM "TankStateHistory" h
JOIN "Tank" t ON t.id = h."tankId"
WHERE t."scaleKey" = 'TK101'
  AND h."startedAt" >= TIMESTAMP '2026-09-01 00:00:00'
  AND h."startedAt" <  TIMESTAMP '2026-10-01 00:00:00'
ORDER BY h."startedAt";
```

### Estados actualmente abiertos y permanencia

```sql
SELECT t.name AS tanque, h.state, h."startedAt",
       ROUND(EXTRACT(EPOCH FROM (NOW() - h."startedAt")) / 3600.0, 2) AS horas
FROM "TankStateHistory" h
JOIN "Tank" t ON t.id = h."tankId"
WHERE h."endedAt" IS NULL
ORDER BY horas DESC;
```

### Decisiones de laboratorio

```sql
SELECT t.name AS tanque, l."manufacturingOrder" AS of, q.result,
       q."employeeNumber" AS legajo, q."specificWeight", q.reason,
       q."recoveryAction", u."fullName" AS usuario, q."createdAt"
FROM "QualityDecision" q
JOIN "ProductionLot" l ON l.id = q."lotId"
JOIN "Tank" t ON t.id = l."tankId"
JOIN "User" u ON u.id = q."userId"
ORDER BY q."createdAt" DESC;
```

### Órdenes de envasado y duración

```sql
SELECT t.name AS tanque, l."manufacturingOrder" AS of,
       p."packagingOrder" AS oe, p.line, p.format,
       p."startedAt", p."finishedAt", p."durationSeconds",
       ROUND(p."durationSeconds" / 60.0, 1) AS minutos,
       ui."fullName" AS iniciado_por, uf."fullName" AS finalizado_por
FROM "PackagingOrder" p
JOIN "Tank" t ON t.id = p."tankId"
JOIN "ProductionLot" l ON l.id = p."lotId"
JOIN "User" ui ON ui.id = p."startedByUserId"
LEFT JOIN "User" uf ON uf.id = p."finishedByUserId"
ORDER BY p."startedAt" DESC;
```

### Auditoría completa de cambios

```sql
SELECT a."createdAt", t.name AS tanque, l."manufacturingOrder" AS of,
       a.action, a."entityType", a."entityId",
       u."fullName" AS usuario, a.reason, a.before, a.after
FROM "PlantAuditLog" a
LEFT JOIN "Tank" t ON t.id = a."tankId"
LEFT JOIN "ProductionLot" l ON l.id = a."lotId"
LEFT JOIN "User" u ON u.id = a."userId"
ORDER BY a."createdAt" DESC;
```

### Conteo y duración promedio por estado

```sql
SELECT state, COUNT(*) AS cantidad,
       ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE("endedAt", NOW()) - "startedAt"))) / 60.0, 2) AS minutos_promedio
FROM "TankStateHistory"
GROUP BY state
ORDER BY state;
```

## 6. Exportar datos

Dentro de `psql`, exportar el histórico unido a CSV:

```sql
\copy (
  SELECT t.name AS tanque, l."manufacturingOrder" AS of, h.state,
         h.description, h."startedAt", h."endedAt", u."fullName" AS responsable
  FROM "TankStateHistory" h
  JOIN "Tank" t ON t.id = h."tankId"
  LEFT JOIN "ProductionLot" l ON l.id = h."lotId"
  LEFT JOIN "User" u ON u.id = h."userId"
  ORDER BY h."startedAt" DESC
) TO '/tmp/historico_tanques.csv' CSV HEADER;
```

Copiarlo desde el contenedor a la carpeta actual de Windows:

```powershell
docker cp disal-db:/tmp/historico_tanques.csv .\historico_tanques.csv
```

Para exportar cualquier tabla completa, por ejemplo auditoría:

```sql
\copy (SELECT * FROM "PlantAuditLog" ORDER BY "createdAt" DESC) TO '/tmp/auditoria.csv' CSV HEADER;
```

## 7. Respaldo y restauración

Crear un respaldo completo desde PowerShell:

```powershell
docker compose exec -T disal-db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > planta-latex.backup
```

El archivo incluye estructura y datos persistidos, pero no los pesos en memoria. Para restaurar se debe usar una base vacía y ejecutar:

```powershell
Get-Content -AsByteStream .\planta-latex.backup | docker compose exec -T disal-db sh -c 'pg_restore --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

La restauración reemplaza información y debe probarse primero en un entorno separado.

## 8. Diagnóstico rápido

```powershell
docker compose ps
docker compose logs --tail 100 disal-backend
docker compose logs --tail 100 disal-db
Invoke-RestMethod http://localhost:8081/api/health
```

Todos los servicios deben figurar `Up`; la API debe responder con estado `ok`. Si se cambia `.env`, recrear los servicios con `docker compose up -d --build`.
