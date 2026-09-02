---
name: frontend-validate
description: Valida el código del frontend React — ejecuta lint, formato y verificación del build de producción. Usar esta skill cuando el código en apps/frontend haya cambiado, antes de hacer commit, o cuando se pida validar, buildear o revisar el frontend.
---

# Skill: Validar Frontend

Ejecutar esta skill para validar el frontend completo antes de hacer commit.

## Pasos a ejecutar (en orden):

1. **Verificación de lint**
   ```bash
   cd apps/frontend && npm run lint
   ```

2. **Verificación de formato**
   ```bash
   cd apps/frontend && npm run format
   ```

3. **Build de producción** (verificación de tipos + bundle Vite)
   ```bash
   cd apps/frontend && npm run build
   ```

## Cómo reportar resultados:

- Mostrar una tabla resumen: Lint ✓/✗ | Formato ✓/✗ | Build ✓/✗
- Si algún paso falla, mostrar el error exacto y sugerir una corrección específica
- Si todo pasa: confirmar que el frontend está listo para commitear

## Idioma:
- Toda comunicación, explicación y reporte debe ser en **español**. Esto incluye mensajes de error traducidos, sugerencias de corrección y confirmaciones.

## Notas:
- El modo estricto de TypeScript está habilitado — los errores de tipos fallarán el build
- Se usa Tailwind CSS — verificar clases rotas o sin uso si los estilos se ven mal
- El output del build queda en `apps/frontend/dist/` — no commitear esa carpeta
- El servidor de desarrollo Vite corre en 0.0.0.0:5173 — para desarrollo usar `npm run dev`
