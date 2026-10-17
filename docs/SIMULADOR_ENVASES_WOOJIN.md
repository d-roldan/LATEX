# Simulador local de inyectoras Woojin · ENVASES

## Alcance y aislamiento

La pestaña **ENVASES Woojin · simulador LOCAL** de `disal-node-red` genera cinco lecturas sintéticas. No consulta CMS, MariaDB, Modbus, PLC, InfluxDB ni las direcciones industriales. Las IP sólo identifican las tarjetas contra el catálogo del backend. El flujo se envía al nginx del mismo Compose mediante `http://disal-nginx/api/plants/ENVASES/telemetry/injection-machines` y nunca a un servidor externo.

La fuente simulada es `NODE_RED_ENVASES_SIM`, con `mode: SIMULATION` y `simulated: true` tanto en lote como en lecturas. Usa `ENVASES_SIM_NODE_RED_KEY`, distinta de `ENVASES_NODE_RED_KEY` de la integración real. El backend acepta la fuente simulada sólo cuando `DISAL_ENABLE_ENVASES_SIMULATOR=true`; el valor por defecto es `false`. Autentica la clave contra una fila `PlantIntegration` exclusiva de esa fuente y planta. Las cachés de lecturas, último ciclo y diagnóstico se separan por planta y fuente. Al deshabilitar el simulador, la consulta vuelve exclusivamente a la fuente real. No se guardan muestras en PostgreSQL.

La pantalla `/envases?plant=ENVASES` exige usuario con acceso a ENVASES. La TV `/tv?plant=ENVASES` sigue siendo pública según el diseño actual de TV. Las tarjetas muestran **SIMULACIÓN** cuando la fuente elegida es la local. El detalle divide información general, producción, parámetros del último ciclo y diagnóstico. La TV muestra los cinco equipos sin IP; para un televisor de 1920 × 1080 o 1280 × 720 se usa una sola fila de cinco tarjetas.

## Configuración local

1. Trabajar en la base y el Compose locales, con respaldo verificado antes de provisionar la credencial. No ejecutar este procedimiento en producción.
2. En `.env` local, definir `DISAL_ENABLE_ENVASES_SIMULATOR=true` y una clave aleatoria de 32 caracteres o más en `ENVASES_SIM_NODE_RED_KEY`. El archivo está ignorado por Git. La clave nunca va en JSON, documentación ni frontend.
3. Compilar el backend y ejecutar una sola vez `node dist/prisma/provision-envases-simulator.js` con `DATABASE_URL`, `SYSTEM_OWNER_COMPANY_ID`, el interruptor y la clave del mismo entorno local. El script sólo crea o actualiza `PlantIntegration` para `NODE_RED_ENVASES_SIM`; no modifica la credencial real.
4. Reconstruir `disal-backend` y `disal-frontend` con Compose; recrear `disal-node-red` para cargar las variables y el flujo. Con el backend reiniciado, la caché comienza vacía hasta el siguiente envío.

El flujo importable está en `infra/node-red/examples/envases-woojin-simulator.json`. El archivo activo local es `infra/node-red/data/flows.json`. Para editar la lógica, modificar `infra/node-red/data/envases-simulator.function.js` y ejecutar `node /data/build-envases-flow.cjs` dentro del contenedor local; copiar el ejemplo generado desde `infra/node-red/data/examples/` a `infra/node-red/examples/`. El generador conserva los nodos ajenos a la pestaña ENVASES. No importar el simulador en el Node-RED industrial externo. El tick de Inject viene en 2 segundos y se puede editar en la pestaña; el nodo HTTP tiene timeout de 4 segundos. Un Catch y el estado del Function muestran fallos sin imprimir la clave ni el lote.

Para apagarlo, cambiar `DISAL_ENABLE_ENVASES_SIMULATOR=false` y recrear backend y Node-RED locales. El backend entonces rechaza lotes simulados y no selecciona la caché simulada. La rama real `envases-woojin-http-branch.json` conserva su propia clave y requiere habilitación independiente.

## Perfiles y ciclos

| Equipo | IP identificadora | Modelo | Ciclo base | Estado inicial |
| --- | --- | --- | ---: | --- |
| INY01 | 172.16.0.141 | DL650G5 | 26 s | AUTO, produce |
| INY02 | 172.16.0.146 | DL450G5 | 21 s | AUTO, produce |
| INY03 | 172.16.0.143 | TB280G5-1 | 24 s | MANUAL, detenido |
| INY04 | 172.16.0.144 | TB280G5-2 | 21 s | AUTO, produce |
| INY05 | 172.16.0.145 | TB200G5 | 18 s | PARO, alarma sintética 204 |

Cada tick actualiza timestamp, operación, motor, calefacción, alarma, contadores, tiempos de producción, promedio y diagnóstico. El contador sólo aumenta cuando se completa un ciclo con motor en AUTO y sin alarma. Cada disparo completado cambia ligeramente el ciclo siguiente y actualiza `ultimo_ciclo_tecnico`, su número y timestamp. Al detener la máquina, el último ciclo técnico queda congelado. El lote parcial conserva los otros equipos; cuando se simula pérdida de comunicación de INY04 no se envía lectura para ella, por lo que su señal vence tras el umbral de 30 segundos. El reinicio de contador de INY05 informa delta negativo y `REINICIO_O_RETROCESO_CONTADOR`; no reduce el total acumulado ni crea producción ficticia.

Los parámetros técnicos incluyen tiempos, presiones, velocidades, posiciones, tornillo, contrapresión, cierre, apertura, resina, siete zonas de cilindro, doce de molde y tolva. Son **valores simulados** para diseñar la vista. Salvo el tiempo de ciclo presentado en segundos como inferencia, las unidades y la semántica de `ngmark` no están verificadas con el equipo real. Un valor ausente o `null` se muestra como «No informado».

## Controles de la pestaña Node-RED

Los Inject de la pestaña local permiten: **INICIAR TODAS**, **DETENER/REANUDAR INYECTORA 1**, **GENERAR/LIMPIAR ALARMA INYECTORA 3**, **PÉRDIDA/RECUPERAR COMUNICACIÓN INYECTORA 4**, **REINICIO CONTADOR INYECTORA 5** y **RESTAURAR ESCENARIO NORMAL**. Cada control genera un lote inmediatamente. «Restaurar» recupera los modos iniciales y la comunicación, manteniendo los contadores ya simulados; no rebobina producción. Los estados se guardan en el contexto del flujo local y se reinician si se limpia ese contexto.

## Verificación y límites

La prueba `infra/node-red/tests/envases-simulator.test.cjs` usa el mismo código del nodo y comprueba ciclos, controles, pérdida de señal y coherencia de contadores. Las pruebas de backend comprueban autenticación, validación, aislamiento de fuentes, lotes parciales y conservación del último disparo. Para comprobar el recorrido vivo, consultar el GET de TV después de activar Node-RED y verificar cinco tarjetas, `source: NODE_RED_ENVASES_SIM`, `simulated: true`, contadores y `ultimo_ciclo_tecnico`. Luego revisar la pantalla a 1920 × 1080 y 1280 × 720 y abrir el detalle técnico.

La caché se pierde al reiniciar el backend y sólo sirve a una instancia. La simulación no valida conectividad, calibración, unidades, mapeo CMS ni adquisición industrial real. La conexión industrial queda pendiente de una puesta en marcha independiente.

### Resultado local del 16/10/2026

El flujo pasó la prueba de ciclos y nueve controles. Las 13 pruebas enfocadas de backend (servicio y HTTP) pasaron, incluidas fuente simulada deshabilitada, arrays de temperaturas parcialmente nulos y separación de cachés. Backend y frontend compilaron. En el Compose local, el GET público devolvió cinco equipos frescos y cinco últimos ciclos con `source: NODE_RED_ENVASES_SIM`; los cinco servicios de aplicación, base y Node-RED estaban en marcha, y los que tienen healthcheck informaron `healthy`. En navegador, la TV presentó las cinco tarjetas sin scroll a 1280 × 720 y 1920 × 1080. La pérdida de INY04 redujo el lote a cuatro y venció sólo su lectura; el control de recuperación restableció las cinco. Al detener INY01, el resumen bajó de tres a dos equipos con producción detectada; se restauró luego el escenario inicial.
