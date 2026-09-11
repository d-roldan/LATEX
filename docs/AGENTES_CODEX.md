# Agentes de Codex para LATEX

Los cinco agentes del proyecto se definen en `.codex/agents/` mediante archivos TOML. Sus descripciones e instrucciones están en español. Los nombres técnicos permanecen estables para poder invocarlos.

| Agente | Trabajo | Entrega |
| --- | --- | --- |
| `playwright-test-planner` | Explorar y planificar pruebas del flujo solicitado | Plan en `e2e/specs/`, con expectativas y precondiciones |
| `playwright-test-generator` | Convertir escenarios en pruebas Playwright | Pruebas, evidencia de ejecución y pendientes |
| `playwright-test-healer` | Investigar y reparar pruebas defectuosas | Causa raíz, corrección y resultado; conserva fallos del producto |
| `plant-reviewer` | Revisar estados, concurrencia, trazabilidad y permisos | Hallazgos con ubicaciones, sin cambios de código |
| `telemetry-reviewer` | Revisar Node-RED, pesos, señal y separación por planta | Hallazgos y límites de validación, sin cambios de código |

## Uso

Abrir Codex desde la raíz `planta-latex`. Los agentes del proyecto usan el formato de archivos independientes documentado por Codex. No requieren fijar un modelo ni agregar credenciales: heredan la configuración de la sesión. Los dos revisores declaran `sandbox_mode = "read-only"`; las políticas efectivas del entorno y de cada herramienta siguen aplicándose.

Ejemplos de pedidos:

- «Usá playwright-test-planner para planificar las pruebas del trasvase de Slurry».
- «Usá playwright-test-generator para implementar los escenarios del plan de envasado».
- «Usá playwright-test-healer para investigar el fallo de esta prueba».
- «Pedile a plant-reviewer que revise las transiciones modificadas».
- «Pedile a telemetry-reviewer que revise este cambio del flujo Node-RED».

El agente principal debe asignar una subtarea concreta, su alcance y la entrega esperada. Planner y Generator se usan en secuencia cuando el segundo necesita el plan del primero. Healer interviene cuando existe un fallo que investigar. Los revisores pueden trabajar de forma independiente cuando el alcance lo permite; no es necesario ejecutar los cinco por cada cambio.

`AGENTS.md` contiene la guía de selección y las skills asociadas. Si una sesión iniciada desde `LatexNuevo` no descubre los agentes del repositorio hijo, abrir una tarea desde `planta-latex`. Cuando la herramienta de delegación disponible no permita seleccionar un rol personalizado, el agente principal puede leer el TOML y transmitir sus instrucciones a una subtarea compatible; debe indicar esa adaptación y no afirmar que seleccionó un rol nativo inexistente.

## Herramientas y pruebas

Las definiciones usan las herramientas disponibles en la sesión. Las plantillas de Playwright originales mencionan herramientas MCP específicas; estas ediciones incluyen una alternativa con las herramientas de navegador, archivos y CLI efectivamente disponibles. No se instala ni se presupone un servidor MCP adicional.

La incorporación de agentes no equivale a una suite E2E terminada. Al preparar estas definiciones, `e2e/package.json` declara Playwright 1.58.2 como rango mínimo compatible y su comando `test` sigue siendo un marcador pendiente. Tampoco se encontraron dependencias Playwright instaladas en `e2e/node_modules`. El generador comprueba configuración, dependencias, navegador, datos y entorno antes de ejecutar casos; puede preparar lo necesario dentro de una tarea de pruebas autorizada.

No usar cuentas demo supuestas ni iniciar pruebas contra una planta activa sin un entorno apropiado. Una exploración estática se informa como tal. Los planes se versionan cuando corresponde; las trazas, sesiones, capturas e informes temporales se guardan bajo `output/` o una ruta ignorada.

## Procedencia y adaptación

Formato de configuración: [documentación oficial de subagentes de Codex](https://learn.chatgpt.com/docs/agent-configuration/subagents). Se consultó la versión local de Codex CLI `0.153.4` al preparar los archivos.

Los tres roles de pruebas se adaptaron al español y a TOML desde las [plantillas oficiales de Playwright v1.58.2](https://github.com/microsoft/playwright/tree/v1.58.2/packages/playwright/src/agents), bajo Apache-2.0. Su licencia se conserva en [playwright-LICENSE.txt](../.codex/agents/licenses/playwright-LICENSE.txt). El flujo general está documentado en [Playwright Test Agents](https://playwright.dev/docs/test-agents).

Cambios respecto de las plantillas originales:

- Se conserva el modelo del usuario en lugar de fijar un modelo de otro proveedor.
- Se adapta el uso de herramientas a Codex y a las capacidades disponibles.
- Se incorpora el contexto de roles, plantas, OF/OE y telemetría de LATEX.
- Healer no marca `skip` o `fixme` para ocultar un fallo ni cambia una expectativa válida para aceptar un defecto.
- Se acotan reintentos sin progreso y se separan fallos de producto, pruebas y entorno.
- La falta de entorno se declara como validación pendiente; no se inventan observaciones.

Los dos revisores son definiciones propias del proyecto, basadas en sus reglas y documentación. Estas configuraciones son adaptaciones locales, no una instalación sin modificaciones de un paquete oficial. Mantenerlas en español y comparar futuras actualizaciones antes de reemplazarlas.
