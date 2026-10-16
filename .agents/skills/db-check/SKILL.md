---
name: db-check
description: Validar el schema Prisma y revisar migraciones cuando cambian modelos, campos o relaciones, o se solicita migrar la base de datos del proyecto.
---

# Verificar base de datos

Desde `apps/backend`, ejecutar `npx --no-install prisma validate` y `npm run prisma:generate`. Revisar el SQL de migración y su compatibilidad con datos existentes; validar no implica aplicar cambios a una base.

Leer `docs/DESPLIEGUE_MULTIPLANTA.md` desde la raíz antes de instalar o actualizar una base. Para actualizaciones, el proyecto dispone de `npm run prisma:deploy` y del servicio Compose `disal-migrate`. Para una base comprobablemente vacía existe `npm run prisma:install-empty`.

`prisma:migrate` y `prisma:deploy` ejecutan ahora `migrate deploy`; se conserva el alias para compatibilidad. Una modificación de `schema.prisma` requiere revisar y versionar su SQL antes de aplicarlo a bases persistentes. `prisma:install-empty` es una excepción de instalación inicial: verifica que la base esté vacía y crea el baseline histórico. Consultar `docs/MIGRACIONES.md` para distinguir entornos. Aplicar cambios sólo al destino solicitado y confirmado, sin mostrar credenciales. No ejecutar seeds ni resets como validación rutinaria.

Consultar `apps/backend/prisma/schema.prisma` como fuente de verdad. La operación multiplanta utiliza plantas, equipos, estados de tanque y asignaciones de usuarios, además de entidades heredadas del módulo comercial. Revisar el aislamiento por empresa y planta según el modelo y los servicios afectados. No asumir que WorkOrder es la entidad central ni borrar migraciones ya aplicadas.

Informar en español las comprobaciones, los cambios aplicados y los pendientes, diferenciando validación local de despliegue.
