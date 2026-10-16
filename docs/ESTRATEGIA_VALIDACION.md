# Validación proporcional al cambio

Antes de ejecutar pruebas o builds, identificar qué comportamiento cambió, qué componentes lo consumen y qué fallos serían relevantes. Elegir la comprobación más pequeña que aporte evidencia suficiente y ampliarla si aparece un riesgo concreto. Ahorrar tiempo y tokens nunca justifica dejar sin verificar una función afectada.

## Niveles de trabajo

| Nivel | Alcance | Evidencia habitual |
| --- | --- | --- |
| 0 | Texto, etiqueta o documentación sin efecto operativo | Archivo y diff; cotejar instrucciones críticas con el código vigente. |
| 1 | Presentación, CSS, responsive o TV | Componente y vista afectada; navegador cuando se necesita ver el resultado; build si cambian tipos, imports o bundle. |
| 2 | Función ordinaria, formulario, filtro, consulta o componente compartido | Consumidores directos, prueba enfocada y compilación del paquete afectado. |
| 3 | Estados, concurrencia, roles, plantas, trazabilidad, datos, telemetría o Node-RED | Impacto, casos válidos y rechazados, persistencia y regresión pertinente en entorno seguro; build solo no basta. |
| 4 | Release o preparación productiva | Procedimiento de `docs/RELEASE_PROCESS.md` sobre todos los cambios acumulados y runbook productivo si corresponde. |

La clasificación depende del efecto real, no del tamaño del diff. Un cambio de texto en un selector de pruebas, contrato, accesibilidad o instrucción de seguridad puede subir de nivel. Nivel 0 no activa agentes, Docker, Playwright, E2E ni build por defecto. En todos los niveles, revisar `git diff --check` y el diff relevante.

## Decisión previa

Para cada cambio, determinar:

1. **Alcance:** archivos, módulos, contratos y flujos afectados. Distinguir código de documentación, configuración y datos.
2. **Riesgo:** posibilidad e impacto de un fallo. Considerar estados de tanque, permisos, aislamiento por planta, persistencia, migraciones, integraciones externas y código compartido.
3. **Evidencia necesaria:** qué prueba o inspección demostraría que el comportamiento solicitado funciona y que no se rompieron sus consumidores inmediatos.

Comunicar brevemente el plan de validación antes de ejecutar comandos costosos. No fijar un número de pruebas por costumbre ni usar la cantidad de pruebas ejecutadas como medida de calidad.

## Selección de comprobaciones

| Tipo de cambio | Validación inicial habitual | Cuándo ampliar |
| --- | --- | --- |
| Documentación o texto sin lógica | Revisar contenido, enlaces y `git diff --check`. | Si el texto forma parte de una instrucción operativa o contrato, cotejarlo con el código o la fuente vigente. |
| Presentación local del frontend | Lint y formato de los archivos afectados; comprobar la pantalla y los tamaños pertinentes. Compilar si cambia TSX, tipos, imports, rutas o estilos que podrían romper el bundle. | Probar interacciones, accesibilidad o regresión visual si cambian el comportamiento o la disposición. |
| Lógica local de backend o frontend | Pruebas unitarias del módulo afectado, casos límite relevantes, lint/formato de los archivos modificados y compilación del paquete afectado. | Ampliar a módulos consumidores si se modifica una interfaz, función compartida o comportamiento reutilizado. |
| Contrato API, telemetría o integración | Validar DTO/entrada, autenticación, casos válidos e inválidos y consumidor. Probar el recorrido entre componentes en un entorno de prueba cuando sea necesario para demostrar el cambio. | Añadir pruebas de pérdida de señal, datos obsoletos, concurrencia o aislamiento por planta según el contrato. Una simulación aislada no demuestra una integración externa real. |
| Estados operativos, permisos, datos o migraciones | Probar transiciones permitidas y rechazadas, concurrencia o aislamiento pertinente; compilar; validar esquema y SQL si corresponde. | Ejecutar suite más amplia o E2E enfocado si el cambio alcanza varios flujos o tiene efectos difíciles de aislar. No aplicar migraciones ni mutar producción como parte de una validación rutinaria. |

La tabla orienta; el riesgo real manda. Una corrección pequeña en autorización puede necesitar más pruebas que un cambio visual grande. Si el usuario o un proceso de entrega exige una suite completa, ejecutarla.

## Cuándo ejecutar suites completas

Ejecutar la suite completa del paquete cuando cambie lógica compartida con consumidores difíciles de enumerar, haya una refactorización amplia, fallen pruebas enfocadas de manera que sugieran regresiones, o una entrega tenga ese requisito. Antes de repetirla, comprobar si ya se ejecutó sobre el mismo código. Un build no reemplaza pruebas de comportamiento; una prueba unitaria no reemplaza una comprobación de integración cuando el objetivo depende de varios componentes.

Si una comprobación revela un fallo, investigar su relación con el cambio y ampliar sólo lo necesario para encontrar la causa. Distinguir fallos introducidos, preexistentes y del entorno. No ocultar fallos ni declarar aprobada una validación que no se ejecutó.

## Uso eficiente de tiempo y tokens

- Leer los scripts actuales de `package.json` antes de ejecutarlos. Usar herramientas ya instaladas y evitar instalaciones, reconstrucciones o pruebas repetidas sin una necesidad concreta.
- Empezar por pruebas enfocadas. Ejecutar suites generales sólo bajo los criterios anteriores.
- Aplicar lint y formato al alcance modificado cuando el chequeo global tiene deuda conocida; registrar esa limitación. No reformatear archivos ajenos para hacer pasar una verificación.
- Resumir resultados con comando, alcance, cantidad y fallo relevante. No volcar logs extensos si un resumen y unas pocas líneas diagnósticas bastan.
- Detener las comprobaciones opcionales cuando la evidencia sea suficiente. Declarar qué quedó pendiente y por qué, especialmente si falta un entorno de integración o una señal real.
- Agrupar reconstrucciones Docker relacionadas y limitar `docker compose up -d --build --no-deps <servicio>` a servicios afectados cuando la validación local lo requiera. Registrar contenedores actualizados y los que mantienen imagen anterior; no tocar servicios persistentes.

Las skills de `backend-validate`, `frontend-validate`, `db-check` y `e2e-test` aportan comandos y criterios específicos. Esta política define cómo elegir su alcance; las instrucciones explícitas del usuario prevalecen.
