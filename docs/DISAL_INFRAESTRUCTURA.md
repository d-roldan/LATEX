# DISAL INDUSTRIA METALÚRGICA — Infraestructura

## Arquitectura desplegada

```text
Usuarios de red
  -> HTTP_PORT
  -> disal-nginx
      -> disal-frontend
      -> disal-backend
          -> disal-db
```

Servicios Compose conservan identificadores técnicos `DISAL-*`; los contenedores locales se nombran `DISAL-*`.

## Contenedores

| Contenedor | Función |
|---|---|
| `disal-db` | PostgreSQL 16 |
| `disal-backend` | API NestJS |
| `disal-frontend` | SPA compilada |
| `disal-nginx` | Reverse proxy |

## Puertos locales actuales

| Servicio | Puerto |
|---|---|
| Aplicación | `8081` |
| PostgreSQL local | `5433`, enlazado solo a `127.0.0.1` |

Los valores reales provienen de `.env`.

## Inicio

```powershell
docker compose config --quiet
docker compose up --build -d
docker compose ps
```

## Inicialización de base

```powershell
docker compose exec disal-backend npm run prisma:migrate
docker compose exec disal-backend npm run prisma:seed
docker compose exec disal-backend npm run security:ensure-system-owner
```

El seed base es limpio e idempotente. El escenario ficticio de ocho casillas se carga únicamente con `npm run prisma:seed-disal-operational`; no debe ejecutarse en una base productiva.

Después de incorporar cambios de esquema con restricciones nuevas, Prisma puede solicitar confirmación de pérdida de datos. Verificar primero el objetivo y aplicar `prisma db push --accept-data-loss` solo cuando la advertencia haya sido auditada.

## Verificación

```powershell
docker compose ps
docker compose exec disal-db pg_isready -U DISAL_app -d DISAL_industria
Invoke-WebRequest -UseBasicParsing http://localhost:8081/api/auth/status
```

## Logs

```powershell
docker compose logs -f disal-backend
docker compose logs -f disal-nginx
docker compose logs --tail 100 disal-db
```

## Persistencia

Existen volúmenes nombrados para PostgreSQL y los adjuntos:

```text
postgres_data -> /var/lib/postgresql/data
uploads_data  -> /app/data/uploads
```

Los archivos nuevos se guardan fuera del webroot y solo se entregan mediante un endpoint autenticado. Antes del primer despliegue de esta versión, respaldar cualquier archivo legado presente en `/app/public/uploads`; si el contenedor anterior se recrea sin copiarlo, ese contenido no puede recuperarse desde la imagen nueva.

## Backup

```powershell
docker compose exec -T disal-db pg_dump -U DISAL_app DISAL_industria > DISAL_backup.sql
docker compose cp disal-backend:/app/data/uploads ./DISAL_uploads_backup
```

La estrategia final debe incluir:

- ejecución automática;
- retención;
- copia fuera del servidor;
- cifrado cuando corresponda;
- prueba periódica de restauración.

## Actualización

```powershell
git pull --ff-only
docker compose up --build -d
docker compose exec disal-backend npm run prisma:migrate
docker compose ps
```

Antes de actualizar:

1. Revisar cambios.
2. Crear backup.
3. Verificar variables.
4. Definir ventana de mantenimiento.

## Seguridad

Estado actual:

- PostgreSQL solo expuesto en loopback.
- JWT con secreto local.
- Contraseñas con bcrypt.
- CORS configurable.
- Headers HTTP de seguridad.
- Rate limiting global en NestJS: 120 solicitudes por minuto por sesión autenticada o IP, con respuesta HTTP `429` al excederse.
- Login limitado a 5 intentos por minuto por IP.
- Bloqueo persistente de cuenta durante 15 minutos tras 5 contraseñas incorrectas consecutivas; las cuentas `ADMIN` y `DUENO` admiten 10. El contador se reinicia con un ingreso correcto.
- IA limitada a 5 solicitudes por minuto y 2 ejecuciones simultáneas por usuario, con timeout externo de 60 segundos.
- Adjuntos limitados a 10 subidas cada 10 minutos por sesión y 10 MB por archivo, almacenados fuera del webroot en el volumen `uploads_data` y descargados únicamente mediante autorización del backend.
- Segunda capa en Nginx con límites de frecuencia, ráfaga y conexiones por IP.
- Límites configurables de CPU, memoria y procesos para PostgreSQL, backend y Nginx.
- Backend ejecutado como usuario sin privilegios, filesystem de solo lectura, capacidades Linux eliminadas y `no-new-privileges`.
- Revocación persistente de sesiones al cambiar contraseña, rol o estado del usuario.
- Dependencias de producción sin vulnerabilidades altas o críticas conocidas al 05/08/2026.

Pendientes:

- HTTPS real.
- gestión de secretos fuera de `.env`;
- firewall y segmentación de red documentados;
- backups automatizados;
- monitoreo.
- MFA para cuentas privilegiadas.

Nginx sirve HTTP para la red local. HSTS se habilitará únicamente junto con HTTPS; enviarlo sobre HTTP no aporta protección.
El perfil opcional, la generación del certificado y el procedimiento de confianza están en [HTTPS_LOCAL.md](HTTPS_LOCAL.md).

## Red local

No fijar en documentación una IP como definitiva. Configurar:

- IP estable o reserva DHCP para el servidor;
- DNS local, por ejemplo `disal-industria.local`;
- `CORS_ORIGIN`;
- `server_name` de Nginx;
- reglas de firewall.

La configuración Nginx actual utiliza los nombres `disal-industria.local` y `DISAL-industria`. Deben adaptarse si el despliegue definitivo usa otro DNS local.

## Pantalla de TV

`/tv` no está envuelta por `ProtectedRoute`, pero solicita `/api/orders`, que requiere JWT. Debe abrirse en un navegador con sesión o rediseñarse con un mecanismo de pantalla segura.

## Recuperación básica

### Reiniciar un servicio

```powershell
docker compose restart disal-backend
```

### Reconstruir

```powershell
docker compose up --build -d
```

### Detener sin borrar datos

```powershell
docker compose down
```

No ejecutar `docker compose down -v` salvo eliminación deliberada del volumen de base.

## Checklist antes de producción

- [ ] Branding y seed de DISAL
- [ ] Dominio de casillas validado.
- [ ] Volumen de adjuntos.
- [ ] HTTPS.
- [ ] Backup y restauración probados.
- [ ] Contraseñas definitivas.
- [ ] CORS y Nginx sin referencias heredadas.
- [ ] Política de actualización.
- [ ] Logs y alertas.
- [ ] Revisión de `/tv`.
- [ ] Manuales PDF regenerados.
