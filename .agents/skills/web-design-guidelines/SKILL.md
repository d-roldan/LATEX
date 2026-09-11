---
name: web-design-guidelines
description: Revisar accesibilidad, formularios, foco, navegación, adaptación a pantallas y claridad de la interfaz. Usar cuando se pide revisar diseño o experiencia de uso, o al modificar componentes visuales de LATEX.
license: MIT
metadata:
  author: vercel
  language: es
  adaptation: Edición en español para pantallas operativas de LATEX
---

# Guía de revisión de interfaces

Revisar los archivos afectados con la [guía local en español](references/interfaz.md). Esta edición adapta el procedimiento de Vercel y las recomendaciones de su guía de interfaces al contexto industrial de LATEX. Consultar [procedencia](ORIGEN.md).

## Procedimiento

1. Identificar las pantallas y componentes de la solicitud. Si el cambio o la conversación ya los identifican, continuar sin pedir que el usuario repita las rutas.
2. Leer el código y comprobar los criterios aplicables. Verificar en navegador cuando el comportamiento de foco, desbordamiento o interacción no pueda establecerse sólo con lectura.
3. Preservar identidad visual, navegación y reglas operativas. Priorizar acciones accesibles, lectura de estados y ausencia de recortes sobre cambios estéticos secundarios.
4. Informar problemas concretos en español, con ruta y línea verificadas, efecto sobre el usuario y corrección propuesta. Distinguir lo observado en navegador de lo inferido por código.

La fuente original descarga reglas remotas en cada revisión. Esta adaptación usa una referencia local en español para mantener instrucciones estables. Si se solicita actualizarla, consultar la fuente indicada en `ORIGEN.md`, revisar los cambios y traducirlos antes de incorporarlos; no reemplazarla automáticamente por un documento remoto en inglés.

Usar `../frontend-validate/SKILL.md` para compilación y comprobaciones del frontend y `../playwright-best-practices/SKILL.md` para regresión visual o pruebas de interacción cuando correspondan.
