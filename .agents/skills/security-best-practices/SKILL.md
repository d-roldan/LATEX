---
name: security-best-practices
description: Realizar revisiones de seguridad y orientar código seguro en JavaScript y TypeScript. Usar cuando el usuario solicita una auditoría, buenas prácticas de seguridad o una corrección de seguridad; no activar una auditoría completa por una edición general.
license: Apache-2.0
metadata:
  author: OpenAI
  language: es
  adaptation: Edición en español para React y NestJS sobre Express
---

# Buenas prácticas de seguridad

Edición adaptada en español de OpenAI, centrada en el frontend React y el backend NestJS sobre Express de LATEX. Las referencias locales condensan la orientación aplicable; no son una traducción completa de las guías de todos los lenguajes. Consultar [procedencia y licencia](ORIGEN.md).

## Referencias según el alcance

- React y navegador: [Seguridad del frontend](references/frontend.md).
- NestJS, Express, Node-RED y límites HTTP: [Seguridad del backend](references/backend.md).
- Evidencias, prioridades y correcciones: [Método de revisión](references/revision.md).

## Procedimiento

1. Identificar componentes, versiones y alcance solicitado. Leer las referencias del frontend y backend cuando ambos formen parte del trabajo.
2. Revisar entradas no confiables y el lugar donde se interpretan o usan: DOM, SQL, archivos, procesos y solicitudes salientes. Seguir el flujo en el código y evitar hipótesis sin evidencia.
3. Diferenciar una revisión explícita, ayuda para implementar una función segura y un problema concreto observado durante un cambio. Mantener el trabajo dentro de lo pedido.
4. En permisos y separación por planta, consultar `../roles-audit/SKILL.md`; para privilegios de PostgreSQL, `../supabase-postgres-best-practices/SKILL.md`.
5. Producir resultados en español, sin secretos y con rutas y líneas verificadas. Si se solicita corregir, aplicar cambios enfocados y validarlos; si sólo se solicita revisar, entregar el diagnóstico sin convertirlo en una modificación general del sistema.

Las instrucciones del usuario y el contexto del proyecto prevalecen sobre convenciones de la guía. No exigir una confirmación nueva para arreglos ya autorizados. La instalación de esta skill no ejecuta una auditoría ni modifica la configuración de seguridad de la aplicación.
