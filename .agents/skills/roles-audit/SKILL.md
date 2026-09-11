---
name: roles-audit
description: Revisar permisos del backend y frontend cuando cambian roles, guards, rutas protegidas o acceso a plantas, o cuando se solicita una auditoría de autorización.
---

# Auditar roles y permisos

Usar como fuentes de verdad `apps/backend/prisma/schema.prisma`, `apps/backend/src/common/auth/roles.guard.ts`, los controladores y servicios afectados, `apps/frontend/src/features/auth/ProtectedRoute.tsx` y `apps/frontend/src/app/router/AppRouter.tsx`.

La planta usa FABRICACION, LABORATORIO, ENVASADO, MONITOREO, JEFATURA y ADMIN. También hay roles heredados DUENO, SUPERVISOR y OPERARIO y alias OWNER/OPERATOR. No imponer una jerarquía universal: verificar las listas de roles explícitas y el tratamiento de `isSystemOwner` en cada capa.

1. Revisar autenticación, decoradores y guards a nivel de clase y método en los endpoints afectados. Distinguir rutas públicas deliberadas, como TV, de rutas operativas.
2. Comparar rutas, acciones y controles visibles del frontend con la autorización efectiva del backend. Ocultar un botón no protege la API.
3. Verificar empresa, asignación de plantas y planta activa en consultas y mutaciones; una selección de planta en la URL no concede permiso.
4. Verificar denegaciones y accesos autorizados con pruebas enfocadas cuando se modifica autorización.

Informar en español inconsistencias concretas, ubicación, impacto y validación. Limitar la revisión al área del cambio salvo que se solicite una auditoría completa.
