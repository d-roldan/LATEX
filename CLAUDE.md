# Guía de desarrollo del repositorio

## Proyecto

Sistema de gestión productiva de DISAL INDUSTRIA METALÚRGICA para fabricación de casillas rurales. El código parte de DISAL Mini-MES/JM Rectificaciones y está en reconversión.

No introducir nuevo contenido con la marca heredada. Cuando se modifique una pantalla, preferir terminología de DISAL y registrar cualquier decisión de dominio en `docs/`.

## Fuente de verdad

1. Prisma: `apps/backend/prisma/schema.prisma`.
2. API y permisos: controllers, DTOs y services de NestJS.
3. Rutas frontend: `apps/frontend/src/app/router/AppRouter.tsx`.
4. Despliegue: `docker-compose.yml` e `infra/nginx/default.conf`.

## Arquitectura

Monolito modular:

```text
React SPA -> Nginx -> NestJS -> Prisma -> PostgreSQL
```

No describirlo como microservicios.

## Entidad central

`Order` unifica presupuesto y producción.

- `commercialStatus != null`: tiene fase comercial.
- `productionStatus != null`: tiene fase productiva.
- Una orden puede nacer directamente en producción.

No existen modelos ni módulos separados `Quotation` o `WorkOrder`.

## Módulos backend

- `auth`
- `companies`
- `users`
- `clients`
- `orders`
- `resources`
- `operation-logs`
- `materials`
- `reports`
- `audit`
- `ai-assistant`
- `cabin-models`
- `notifications`

## Features frontend

- `auth`
- `dashboard`
- `supervisor`
- `operator`
- `clients`
- `orders`
- `materials`
- `resources`
- `reports`
- `calendar`
- `users`
- `audit`
- `ai-assistant`

## Seguridad

- JWT guardado en `localStorage` bajo `disal.session`. La clave heredada `disal.session` sólo se lee una vez para migrar sesiones viejas y luego se borra.
- Login limitado a 5 intentos por minuto.
- Throttle global configurado en backend.
- Los controllers deben filtrar por `companyId`.
- `RolesGuard` autoriza automáticamente a `isSystemOwner`.
- `ADMIN` no es un superadministrador global.
- El logout no revoca tokens.

## Comandos

Backend:

```powershell
Set-Location apps/backend
npm install
npm run prisma:generate
npm run build
npm run start:dev
```

Frontend:

```powershell
Set-Location apps/frontend
npm install
npm run build
npm run dev
```

Docker:

```powershell
docker compose up --build -d
docker compose exec disal-backend npm run prisma:migrate
docker compose exec disal-backend npm run prisma:seed
docker compose exec disal-backend npm run security:ensure-system-owner
docker compose ps
```

## Variables

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `CORS_ORIGIN`
- `BACKEND_PORT`
- `VITE_API_BASE_URL`
- `DISAL_OPENAI_API_KEY` en el host, entregada como `OPENAI_API_KEY` al contenedor
- `OPENAI_MODEL`
- variables `SYSTEM_OWNER_*`

El nombre `DISAL_OPENAI_API_KEY` es deuda técnica pendiente.

## Convenciones

- TypeScript estricto.
- Validar entradas con DTOs.
- Mantener el aislamiento por empresa.
- No agregar rutas únicamente protegidas en frontend.
- Auditar acciones sensibles.
- Actualizar documentación cuando cambien modelos, endpoints, roles o despliegue.

## Limitaciones conocidas

- Adjuntos sin volumen Docker persistente.
- Calendario manual en `localStorage`.
- `/tv` necesita sesión para consultar la API.
- HTTP sin TLS.
- Branding y seed heredados.
