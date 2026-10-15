---
name: backend-validate
description: Valida cambios del backend NestJS con lint, formato, pruebas y compilación según el riesgo y alcance. Usar cuando cambie TypeScript en apps/backend o se pida validarlo.
---

# Skill: Validar Backend

Leer primero [Validación proporcional al cambio](../../../docs/ESTRATEGIA_VALIDACION.md). Antes de ejecutar comandos, identificar los módulos y contratos afectados y decidir qué pruebas son necesarias. Ejecutar cada comando desde `apps/backend`.

## Comprobaciones disponibles

Para un cambio acotado, empezar con los archivos modificados y las pruebas del módulo afectado:

```bash
npx --no-install eslint src/modules/plant/plant.service.ts src/modules/plant/plant.service.spec.ts
npx --no-install prettier --check src/modules/plant/plant.service.ts src/modules/plant/plant.service.spec.ts
npm test -- --runInBand src/modules/plant/plant.service.spec.ts
npm run build
```

Sustituir los archivos del ejemplo por los realmente afectados. Añadir pruebas de consumidores y casos límite según el contrato. Para una suite completa justificada por la política o exigida por la entrega:

1. **Lint general**
   ```bash
   npm run lint
   ```

2. **Formato general**
   ```bash
   npx --no-install prettier --check "{src,prisma}/**/*.{ts,js,json,md}"
   ```

3. **Todas las pruebas unitarias**
   ```bash
   npm test -- --runInBand
   ```

4. **Compilación**
   ```bash
   npm run build
   ```

## Cómo reportar resultados:

- Informar comandos, archivos o módulos cubiertos y resultados. Distinguir pruebas enfocadas de suite completa.
- Si algo falla, resumir el error relevante, su relación con el cambio y la corrección o limitación.
- Indicar las comprobaciones pendientes; no afirmar que una integración funciona por haber compilado o pasado pruebas aisladas.

## Idioma:
- Toda comunicación, explicación y reporte debe ser en **español**. Esto incluye mensajes de error traducidos, sugerencias de corrección y confirmaciones.

## Notas:
- No ejecutar toda la suite por defecto; razonar primero el riesgo y el alcance.
- Prestar atención a errores de TypeScript en modo estricto — este proyecto tiene strict: true
- Reglas ESLint: comillas simples, punto y coma, ancho máximo de línea 100

## Uso en Codex

- Los comandos muestran la carpeta de trabajo; usar el directorio de trabajo de la herramienta o Set-Location en PowerShell.
- No usar npm run format como comprobación: escribe sobre los archivos. Limitar correcciones de formato a los archivos del cambio.
- Diferenciar fallos preexistentes de los introducidos por el cambio; no declarar una comprobación aprobada si no se ejecutó.
- Si un chequeo global falla por deuda preexistente, verificar los archivos modificados e informar ambas observaciones.
