---
name: frontend-validate
description: Valida cambios del frontend React con lint, formato, compilación y comprobación de pantalla según el riesgo y alcance. Usar cuando cambie apps/frontend o se pida validarlo.
---

# Skill: Validar Frontend

Leer primero [Validación proporcional al cambio](../../../docs/ESTRATEGIA_VALIDACION.md). Antes de ejecutar comandos, distinguir un cambio de texto o estilo de uno de lógica, navegación, tipos o contrato. Ejecutar cada comando desde `apps/frontend`.

## Comprobaciones disponibles

Para un cambio acotado, verificar los archivos modificados y el comportamiento visual o interactivo afectado. Un texto estático puede requerir sólo revisión del diff y de la pantalla; un cambio en TSX, tipos, imports o rutas puede requerir lint y build.

```bash
npx --no-install eslint src/features/plant/PlantBoardPage.tsx
npx --no-install prettier --check src/features/plant/PlantBoardPage.tsx
npm run build
```

Sustituir el archivo del ejemplo por el afectado y elegir los comandos conforme a la política. Para una comprobación general justificada:

1. **Lint general**
   ```bash
   npm run lint
   ```

2. **Formato general**
   ```bash
   npx --no-install prettier --check "src/**/*.{ts,tsx,css,md}"
   ```

3. **Build de producción** (verificación de tipos + bundle Vite)
   ```bash
   npm run build
   ```

## Cómo reportar resultados:

- Informar qué archivos y pantallas se verificaron, comandos ejecutados y limitaciones del entorno.
- Si algo falla, resumir el error relevante y distinguir un problema nuevo de uno preexistente.
- No presentar un build como prueba de una interacción o de una integración externa.

## Idioma:
- Toda comunicación, explicación y reporte debe ser en **español**. Esto incluye mensajes de error traducidos, sugerencias de corrección y confirmaciones.

## Notas:
- El modo estricto de TypeScript está habilitado — los errores de tipos fallarán el build
- No ejecutar el build sólo por rutina ante un cambio documental o de texto estático, salvo que otro riesgo lo justifique.
- Se usa Tailwind CSS — verificar clases rotas o sin uso si los estilos se ven mal
- El output del build queda en `apps/frontend/dist/` — no commitear esa carpeta
- El servidor de desarrollo Vite corre en 0.0.0.0:5173 — para desarrollo usar `npm run dev`

## Uso en Codex

- Los comandos muestran la carpeta de trabajo; usar el directorio de trabajo de la herramienta o Set-Location en PowerShell.
- No usar npm run format como comprobación: escribe sobre los archivos. Limitar correcciones de formato a los archivos del cambio.
- Diferenciar fallos preexistentes de los introducidos por el cambio; no declarar una comprobación aprobada si no se ejecutó.
