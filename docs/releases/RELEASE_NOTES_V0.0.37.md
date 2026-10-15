# DISAL Planta de Látex · V0.0.37

[← Índice de versiones](README.md)

Fecha: 15 de octubre de 2026.

## Resumen

Esta versión amplía la telemetría de envasado de Látex con la velocidad de la línea Devree, mejora las pizarras y las pantallas por sector, y permite configurar la consulta histórica de InfluxDB por planta. También incorpora una guía para ajustar las validaciones al riesgo de cada cambio.

## Telemetría y operación

- El backend recibe la velocidad en envases por minuto para `DEVREE`, tanto junto con los pesos como mediante el endpoint dedicado. Conserva la última lectura en memoria y la muestra sólo durante el envasado de Látex; sin lectura vigente indica «Sin señal».
- Se mantienen `A` y `B` como identificadores compatibles para emisores anteriores. La documentación de Node-RED describe los contratos y el período de 60 segundos sin señal.
- En la pizarra de envasado se puede indicar el filtro de cada tarjeta, con los valores 1 a 5 o RECIRCULACIÓN.
- La configuración de InfluxDB admite perfiles de medición y campo de peso por planta, con compatibilidad para la configuración previa. Se amplían las pruebas de consulta histórica.

## Pantallas

- La pantalla TV permite elegir fabricación, laboratorio o envasado y destaca la información pertinente de cada sector. Laboratorio incorpora un aviso sonoro.
- El cartel del tanque en envasado muestra la velocidad con el estilo de los demás datos operativos.
- Se ajustan el acceso de Jefatura a la visualización y el comportamiento de selección de planta.

## Base de datos y actualización

- La migración `20261009120000_add_packaging_planning_filter` agrega `filter` opcional a `PackagingPlanningCard` y restringe sus valores permitidos.
- Antes de actualizar una instalación existente, respaldar la base y ejecutar `prisma migrate deploy` según `docs/ACTUALIZACION_SERVIDOR.md`. Reconstruir backend y frontend. Configurar los perfiles de InfluxDB sólo para las plantas que los requieran.
- El flujo de simulación de Node-RED incluido en el repositorio queda deshabilitado. La señal real de velocidad requiere configurar el emisor externo; este tag no modifica ese equipo.
- Esta publicación actualiza los repositorios Git. No despliega cambios en el servidor productivo.

## Verificación realizada

- Backend: 14 suites y 102 pruebas correctas; compilación correcta.
- Esquema Prisma válido. Frontend: ESLint, TypeScript y compilación de producción correctos.
- JSON de flujos Node-RED válido. Contenedores locales de backend y frontend reconstruidos y aplicación comprobada por HTTP.

## Documentación

- Se incorpora `docs/ESTRATEGIA_VALIDACION.md` para elegir las comprobaciones necesarias según alcance y riesgo, y se actualizan las skills de validación del proyecto.
