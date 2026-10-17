# LATEX V0.0.42

**Fecha de publicación:** 17 de octubre de 2026.

[← Historial de versiones](README.md)

## Resumen

Se incorpora la planta ENVASES al catálogo y el monitoreo de cinco inyectoras Woojin. La pantalla operativa, la TV pública y el detalle técnico muestran estado, producción, ciclo, archivo cargado y parámetros recibidos. Un simulador local de Node-RED permite revisar las vistas con datos coherentes antes de conectar los equipos reales.

## Cambios incorporados

- Pantalla `/envases?plant=ENVASES` para usuarios con acceso a la planta y TV `/tv?plant=ENVASES` con cinco tarjetas visibles sin desplazamiento en 1280 × 720 y 1920 × 1080. Los modos se distinguen por color: producción en verde, manual en amarillo y paro en rojo. La TV muestra información operativa sin direcciones IP.
- Título compacto «ENVASES», archivo cargado junto al título y tarjetas con texto y contraste acordes al resto del frontend. El detalle de equipo ocupa el centro de la pantalla e incluye parámetros del último ciclo de inyección y diagnóstico.
- Recepción y consulta de telemetría Woojin por lote, con validación, autenticación de Node-RED, estado de señal reciente y separación entre fuente industrial y fuente simulada. La caché conserva el último ciclo técnico y no crea historial en PostgreSQL.
- Simulador local de cinco inyectoras con contadores que avanzan sólo al completar ciclos de producción, estados manual y paro, controles de alarma, pérdida de comunicación y reinicio de contador. Incluye flujo Node-RED importable y pruebas de coherencia.
- El administrador puede editar su propio perfil y asignarse plantas desde la pantalla de usuarios. Se mantienen las restricciones de rol y eliminación de la propia cuenta.

## Configuración y actualización

No hay migraciones de esquema de base de datos. En instalaciones existentes, provisionar ENVASES mediante el procedimiento de [integración Woojin](../INTEGRACION_ENVASES_WOOJIN.md), asignar el acceso a los usuarios necesarios y reconstruir backend y frontend. El simulador se configura únicamente en el entorno local según su [guía](../SIMULADOR_ENVASES_WOOJIN.md); `DISAL_ENABLE_ENVASES_SIMULATOR` permanece deshabilitado por defecto y sus claves no se versionan. La conexión al Node-RED industrial requiere una puesta en marcha independiente.

La TV de ENVASES, como las demás TV del sistema, es pública. La caché de telemetría reside en memoria del backend y se vacía al reiniciarlo; una instalación con varias instancias requiere resolver esa condición antes de usarla como fuente compartida.

## Verificación

- Backend: 16 suites y 123 pruebas aprobadas; compilación y ESLint de los archivos modificados aprobados.
- Frontend: compilación y ESLint de los archivos modificados aprobados. Se comprobó la vista en navegador con temas claro y oscuro y tamaños de TV de 1280 × 720 y 1920 × 1080.
- Simulador: prueba de ciclos, controles, pérdida de señal y contadores aprobada. En Docker local se verificó la recepción de cinco equipos simulados y la actualización de sus estados.

Estas pruebas usan telemetría simulada; todavía no validan conectividad, unidades ni mapeo de los equipos industriales reales.
