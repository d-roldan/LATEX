---
name: backend-validate
description: Valida el código del backend NestJS — ejecuta lint, verificación de formato y tests. Usar esta skill cuando el código TypeScript en apps/backend haya cambiado, antes de hacer commit, o cuando se pida validar, testear o revisar el backend.
---

# Skill: Validar Backend

Ejecutar esta skill para validar el backend completo antes de hacer commit.

## Pasos a ejecutar (en orden):

1. **Verificación de lint**
   ```bash
   cd apps/backend && npm run lint
   ```

2. **Verificación de formato**
   ```bash
   cd apps/backend && npm run format
   ```

3. **Tests unitarios**
   ```bash
   cd apps/backend && npm test
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
