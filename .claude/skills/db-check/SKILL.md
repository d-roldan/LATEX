---
name: db-check
description: Valida cambios en el schema Prisma, regenera el cliente y aplica migraciones. Usar esta skill cuando schema.prisma fue modificado, al agregar nuevos modelos o campos, o cuando se pida actualizar, migrar o sincronizar la base de datos.
---

# Skill: Verificar Base de Datos

Ejecutar esta skill después de modificar el schema Prisma o cuando se necesite sincronizar la base de datos.

## Pasos a ejecutar (en orden):

1. **Regenerar cliente Prisma** (después de cualquier cambio en el schema)
   ```bash
   cd apps/backend && npm run prisma:generate
   ```

2. **Aplicar schema a la base de datos**
   ```bash
   cd apps/backend && npm run prisma:migrate
   ```

3. **Opcional — recargar datos de demo** (solo si se solicita o después de un reset completo)
   ```bash
   cd apps/backend && npm run prisma:seed
   ```

## Datos clave del schema a tener en cuenta:

- Ubicación del schema: `apps/backend/prisma/schema.prisma`
- Entidad central: **WorkOrder** con 8 estados:
  `PENDIENTE → PLANIFICADA → EN_PROCESO → PAUSADA → FINALIZADA → ENTREGADA / CANCELADA / RETRABAJO`
- Multi-tenant: cada entidad está asociada a un `companyId`
- Todos los cambios sensibles se registran en `AuditLog` (JSON antes/después)

## Cómo reportar resultados:

- Confirmar qué paso se ejecutó y si fue exitoso
- Si la migración falla: mostrar el error de Prisma y sugerir una solución (problema común: los cambios en enums necesitan normalización previa)
- Si se regeneró el cliente: recordar al usuario reiniciar el servidor de desarrollo del backend

## Idioma:
- Toda comunicación, explicación y reporte debe ser en **español**. Esto incluye mensajes de error traducidos, sugerencias de corrección y confirmaciones.

## Notas:
- `prisma:migrate` normaliza enums Y aplica el schema — usar siempre este, no `prisma db push` directamente
- Nunca eliminar archivos de migración ya aplicados en producción
- Credenciales de demo tras el seed: `owner@disal.local`, `supervisor@disal.local`, `oper1@disal.local` — contraseña: `ChangeMe123!`
