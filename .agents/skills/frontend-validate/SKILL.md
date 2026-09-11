---
name: frontend-validate
description: Valida el código del frontend React — ejecuta lint, formato y verificación del build de producción. Usar esta skill cuando el código en apps/frontend haya cambiado, o cuando se pida validar, buildear o revisar el frontend.
---

# Skill: Validar Frontend

Validar los cambios del frontend. Ejecutar cada comando desde apps/frontend, sin acumular cambios de directorio.

## Pasos a ejecutar (en orden):

1. **Verificación de lint**
   ```bash
   cd apps/frontend && npm run lint
   ```

2. **Verificación de formato**
   ```bash
   cd apps/frontend && npx --no-install prettier --check "src/**/*.{ts,tsx,css,md}"
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

## Uso en Codex

- Los comandos muestran la carpeta de trabajo; usar el directorio de trabajo de la herramienta o Set-Location en PowerShell.
- No usar npm run format como comprobación: escribe sobre los archivos. Limitar correcciones de formato a los archivos del cambio.
- Diferenciar fallos preexistentes de los introducidos por el cambio; no declarar una comprobación aprobada si no se ejecutó.
