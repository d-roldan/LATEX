# Migraciones Prisma por entorno

La fuente de verdad es `apps/backend/prisma/schema.prisma` junto con las migraciones versionadas. `prisma:migrate` se conserva como alias de `prisma:deploy`; ambos ejecutan `prisma migrate deploy`. El antiguo `db push` no se usa sobre bases persistentes. `prisma:normalize-enums` es una herramienta histórica de reparación y requiere evaluación específica; no forma parte del despliegue normal.

| Situación | Procedimiento |
| --- | --- |
| Desarrollo local descartable | Editar schema, generar una migración con `prisma migrate dev` sólo sobre una base aislada, revisar SQL y versionarlo. Validar con `prisma validate` y `prisma generate`. |
| Instalación nueva | Comprobar que la base esté realmente vacía y seguir `DESPLIEGUE_MULTIPLANTA.md`: `prisma:install-empty` materializa el esquema y registra el baseline histórico. No ejecutarlo sobre una base existente. |
| Cambio de schema | Crear y revisar migración versionada; evaluar compatibilidad hacia adelante, bloqueos y datos existentes. Probar sobre una restauración aislada antes de publicarla. |
| Base existente | Inventariar `_prisma_migrations`, obtener respaldo verificable, ensayar restauración y ejecutar `prisma:deploy` una vez dentro del procedimiento controlado. Si el baseline histórico no coincide, detenerse y auditar. |
| Producción | Seguir `ACTUALIZACION_SERVIDOR.md`, con ventana autorizada, backup restaurado de prueba, escritores controlados, `disal-migrate` y verificación posterior. |

Nunca usar `migrate reset`, `db push --accept-data-loss`, seeds ni `migrate resolve --applied` para sortear un error en una base existente. El seed inicial requiere una instalación vacía y decisión explícita. Esta documentación no autoriza ejecutar migraciones reales.
