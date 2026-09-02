---
name: roles-audit
description: Audita la consistencia del control de acceso basado en roles en todo el código — verifica guards de NestJS, ProtectedRoute del frontend y AppRouter. Usar esta skill al agregar nuevas funcionalidades con restricciones de roles, después de modificar guards o rutas, o cuando se pida revisar permisos o control de acceso.
---

# Skill: Auditar Roles y Permisos

Verifica que el control de acceso basado en roles sea consistente entre backend y frontend.

## Jerarquía de roles (referencia):
```
OPERARIO < SUPERVISOR < DUENO < ADMIN
```

- **OPERARIO**: Solo Mi Turno (sus propios turnos/eventos)
- **SUPERVISOR**: Acceso operativo completo (órdenes de trabajo, despacho, reportes)
- **DUENO**: SUPERVISOR + gestión de usuarios + registros de auditoría
- **ADMIN**: Acceso completo al sistema en todas las empresas

## Pasos para auditar:

### 1. Verificar guards del backend
Buscar decoradores `@Roles()` en todos los controladores:
```
apps/backend/src/modules/*/
```
Verificar que cada endpoint sensible tenga `@Roles(...)` y `@UseGuards(JwtAuthGuard, RolesGuard)`.

### 2. Verificar protección de rutas en el frontend
Revisar:
- `apps/frontend/src/features/auth/ProtectedRoute.tsx`
- `apps/frontend/src/app/AppRouter.tsx` (o el archivo de rutas equivalente)

Verificar que cada ruta tenga la prop `allowedRoles` correcta.

### 3. Verificar consistencia cruzada
Para cada funcionalidad, confirmar:
- El backend permite exactamente los roles que el frontend expone
- Ninguna ruta es accesible en la UI para un rol que el backend rechazaría
- ADMIN siempre tiene acceso (es el nivel más alto)

## Cómo reportar resultados:

- Listar todos los controladores/rutas con su configuración de `@Roles()`
- Listar todas las rutas del frontend con sus `allowedRoles`
- Marcar cualquier inconsistencia o guard faltante
- Sugerir correcciones para cada problema encontrado

## Idioma:
- Toda comunicación, explicación y reporte debe ser en **español**. Esto incluye mensajes de error traducidos, sugerencias de corrección y confirmaciones.

## Notas:
- Los guards están en `apps/backend/src/common/`
- Payload del JWT: `{ sub, email, role, companyId, fullName }`
- Multi-tenant: también verificar el alcance de `companyId` en las consultas de la capa de servicios
