# DISAL Planta de Látex · V0.0.29

[← Índice de versiones](README.md)

Fecha: 21 de septiembre de 2026.

## Resumen

Esta versión amplía la trazabilidad de Envasado incorporando la dosificadora y el filtro utilizados en cada OE. También mejora la lectura de las tarjetas en modo TV, especialmente en las vistas de Laboratorio y Envasado, tanto en tema claro como oscuro y con o sin pantalla completa.

## Dosificadora y filtro en Envasado

- El inicio de envasado, la apertura de una nueva OE y la corrección de la OE activa permiten seleccionar **Dosificadora A o B** y **Filtro 1, 2 o 3**.
- Las opciones se cargan desde la configuración de planta, de la misma manera que Celda y Formato.
- El backend valida que ambas selecciones pertenezcan a la configuración vigente antes de crear o corregir una orden.
- Cada `PackagingOrder` conserva la dosificadora y el filtro para evitar que la información se pierda al cerrar la OE.
- La tarjeta del tanque, el historial, la búsqueda histórica y el PDF de trazabilidad muestran los nuevos datos.

## Legibilidad y modo TV

- **Dosif. / Filtro** utiliza la misma jerarquía visual y los mismos colores que EN ESTADO, OF y SEMI, sin un recuadro adicional.
- Los textos **Esperando recepción de muestra** y **Muestra recibida · En análisis** se muestran en negro directamente sobre la tarjeta de Laboratorio, sin fondo blanco.
- Se compactaron espaciados y tamaños de las tarjetas de Envasado para evitar cortes cuando el modo TV no ocupa toda la pantalla.
- La disposición fue revisada en temas claro y oscuro, con el navegador en ventana y en pantalla completa.

## Base de datos y configuración

- La migración `20260921120000_add_packaging_dispenser_filter` agrega las columnas opcionales `dispenser` y `filter` a `PackagingOrder`.
- La misma migración incorpora `packagingDispensers: ["A", "B"]` y `packagingFilters: ["1", "2", "3"]` en la configuración de Látex y mantiene el fallback de configuración de empresa.
- Las columnas son opcionales para conservar las órdenes históricas creadas antes de esta versión; la interfaz las representa con un guion cuando no existe información.

## Verificación realizada

- Esquema Prisma validado y cliente generado correctamente.
- Backend compilado y 67 pruebas automatizadas aprobadas en 13 suites.
- Frontend validado con TypeScript y build productivo de Vite.
- Migración aplicada mediante el flujo Docker local y frontend reconstruido.
- La vista TV respondió HTTP 200 y fue revisada visualmente en modo claro y oscuro, con y sin pantalla completa.
- `git diff --check` finalizó sin errores de espacios en blanco.
- El formato global continúa informando deuda histórica en archivos que ya usan el estilo compacto del repositorio; no se realizó un reformateo masivo en esta versión.

## Consideraciones de actualización

- Antes de actualizar otra instalación se debe respaldar PostgreSQL, adjuntos, `.env` y runtime de Node-RED.
- Aplicar la migración con `disal-migrate` o `prisma migrate deploy`; no ejecutar seeds, `db push` ni resets.
- Desplegar backend y frontend de esta versión en conjunto: los clientes anteriores no envían dosificadora ni filtro en las operaciones de Envasado.
- Las órdenes históricas continúan siendo válidas y pueden mostrar `—` en los nuevos campos.
