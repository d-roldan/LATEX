# Instrucciones para Codex

Responder en español. Este repositorio contiene la aplicación industrial multiplanta de DISAL y módulos comerciales heredados. Confirmar el alcance en el código vigente; no confundir órdenes comerciales con OF/OE y estados de tanques.

## Repositorios Git del usuario

| Destino | Remoto local | URL |
| --- | --- | --- |
| GitHub personal | `origin` | `https://github.com/d-roldan/LATEX.git` |
| GitHub laboral de Grupo DISAL | `laboral` | `https://github.grupodisal.com.ar/droldan/LATEX.git` |

Conservar esta distinción en futuras tareas. Si el usuario pide publicar en ambos, subir el mismo commit a cada destino y verificar ambas ramas remotas. Si especifica uno, usar sólo ese destino. No confundir las credenciales o cuentas ni hacer push forzado para resolver divergencias.

## Skills del proyecto

Las skills están en `.agents/skills/`. Antes de trabajar en un área de la tabla, leer su `SKILL.md` y aplicar las instrucciones pertinentes sin que el usuario deba invocarla por nombre. Leer sólo las skills relevantes; una tarea de documentación o Git no exige ejecutar todas las validaciones.

| Trabajo | Skill que se debe consultar |
| --- | --- |
| Cambios o validación de backend | `.agents/skills/backend-validate/SKILL.md` |
| Cambios o validación de frontend | `.agents/skills/frontend-validate/SKILL.md` |
| Schema Prisma o migraciones | `.agents/skills/db-check/SKILL.md` |
| Inicio, reconstrucción o diagnóstico de Docker | `.agents/skills/docker-stack/SKILL.md` |
| Pruebas de flujos completos o cambios de integración operativa | `.agents/skills/e2e-test/SKILL.md` |
| Cambios de roles, autorización o acceso por planta | `.agents/skills/roles-audit/SKILL.md` |
| Presupuestos y órdenes comerciales del módulo heredado | `.agents/skills/unify-orders/SKILL.md` |
| Diseño o diagnóstico de pruebas Playwright | `.agents/skills/playwright-best-practices/SKILL.md` |
| Implementación o revisión de módulos y servicios NestJS | `.agents/skills/nestjs-best-practices/SKILL.md` |
| Componentes React, consultas y rendimiento del frontend | `.agents/skills/vercel-react-best-practices/SKILL.md` |
| SQL, índices, diseño de esquema, conexiones y bloqueos | `.agents/skills/supabase-postgres-best-practices/SKILL.md` |
| Diseño de pantallas, accesibilidad y experiencia de uso | `.agents/skills/web-design-guidelines/SKILL.md` |
| Auditoría, orientación o corrección de seguridad solicitada | `.agents/skills/security-best-practices/SKILL.md` |

Avisar brevemente qué skill se utiliza. Las instrucciones del usuario prevalecen sobre las convenciones de las skills; usar una skill no amplía el alcance autorizado.

Las skills de buenas prácticas complementan las validaciones del proyecto: no duplicar comandos si ya se ejecutaron para el mismo cambio. Leer las referencias específicas del trabajo, no el catálogo completo. Una revisión ordinaria no activa una auditoría de seguridad general.

## Idioma y mantenimiento de skills

Mantener instrucciones, descripciones visibles, referencias locales y nuevos comentarios explicativos en español. Conservar identificadores de APIs, comandos, nombres técnicos y avisos legales originales. Los nombres técnicos de las carpetas se mantienen estables; `agents/openai.yaml` define nombres visibles en español.

Las seis skills incorporadas de fuentes externas son ediciones adaptadas y condensadas para LATEX, no traducciones íntegras de sus catálogos. Cada una incluye `ORIGEN.md`, licencia y un registro de procedencia. No reemplazarlas automáticamente por una descarga en inglés; revisar y traducir los cambios antes de actualizar.

Mantener compatibilidad con las versiones del proyecto. No introducir Next.js, TypeORM, Supabase Auth, APIs de React 19 o una actualización de Prisma por seguir un ejemplo externo. Las recomendaciones de una skill no constituyen autorización para instalar servicios, ejecutar migraciones o modificar producción.

## Agentes especializados

Los roles están en `.codex/agents/`, con instrucciones en español. Para subtareas concretas que se beneficien de delegación, seleccionar el agente pertinente y transmitir alcance, archivos y resultado esperado:

| Subtarea | Agente |
| --- | --- |
| Explorar y planificar escenarios de navegador | `playwright-test-planner` |
| Implementar escenarios en pruebas Playwright | `playwright-test-generator` |
| Diagnosticar una prueba fallida | `playwright-test-healer` |
| Revisar transiciones, concurrencia y aislamiento por planta | `plant-reviewer` |
| Revisar contratos Node-RED, pesos y señal | `telemetry-reviewer` |

Consultar `docs/AGENTES_CODEX.md` para alcance y requisitos. Delegar únicamente cuando haya una subtarea independiente útil; no ejecutar todos los agentes por defecto. Si el generador depende de un plan, esperar primero el resultado del planificador. Los revisores entregan hallazgos sin editar archivos. El agente principal integra los resultados y distingue pruebas ejecutadas de propuestas.

Si la herramienta de la sesión no expone roles personalizados, leer el TOML pertinente y transmitir sus instrucciones a una subtarea compatible, indicando esa adaptación. No inventar una selección de rol ni eludir restricciones de herramientas o permisos. Mantener el modelo elegido por el usuario y evitar delegación recursiva de estos roles.

## Trabajo y verificación

- Ejecutar comandos desde la raíz del repositorio o el directorio de trabajo indicado; adaptar ejemplos de shell a PowerShell.
- Consultar los scripts actuales de cada `package.json` antes de ejecutarlos. Distinguir comprobaciones de comandos que modifican archivos o datos.
- Para despliegues y migraciones, leer `docs/DESPLIEGUE_MULTIPLANTA.md`. No aplicar seeds o resets como requisito de una validación.
- Reportar qué se verificó y qué quedó pendiente. Las notas de versiones anteriores no prueban que la versión actual haya pasado pruebas.
- Mantener secretos, bases de datos, backups y artefactos generados fuera de Git.
