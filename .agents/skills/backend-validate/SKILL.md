---
name: backend-validate
description: Valida el código del backend NestJS — ejecuta lint, verificación de formato y tests. Usar esta skill cuando el código TypeScript en apps/backend haya cambiado, o cuando se pida validar, testear o revisar el backend.
---

# Skill: Validar Backend

Validar los cambios del backend. Ejecutar cada comando desde apps/backend, sin acumular cambios de directorio.

## Pasos a ejecutar (en orden):

1. **Verificación de lint**
   ```bash
   cd apps/backend && npm run lint
   ```

2. **Verificación de formato**
   ```bash
   cd apps/backend && npx --no-install prettier --check "{src,prisma}/**/*.{ts,js,json,md}"
   ```

3. **Tests unitarios**
   ```bash
   cd apps/backend && npm test -- --runInBand
   ```

## Cómo reportar resultados:

- Mostrar una tabla resumen: Lint ✓/✗ | Formato ✓/✗ | Tests ✓/✗
- Si algún paso falla, mostrar el error exacto y sugerir una corrección específica
- Si todo pasa: confirmar que el backend está listo para commitear

## Idioma:
- Toda comunicación, explicación y reporte debe ser en **español**. Esto incluye mensajes de error traducidos, sugerencias de corrección y confirmaciones.

## Notas:
- Siempre ejecutar los tres pasos, aunque uno falle
- Prestar atención a errores de TypeScript en modo estricto — este proyecto tiene strict: true
- Reglas ESLint: comillas simples, punto y coma, ancho máximo de línea 100

## Uso en Codex

- Los comandos muestran la carpeta de trabajo; usar el directorio de trabajo de la herramienta o Set-Location en PowerShell.
- No usar npm run format como comprobación: escribe sobre los archivos. Limitar correcciones de formato a los archivos del cambio.
- Diferenciar fallos preexistentes de los introducidos por el cambio; no declarar una comprobación aprobada si no se ejecutó.
- Ejecutar también npm run build desde apps/backend para comprobar la compilación.
