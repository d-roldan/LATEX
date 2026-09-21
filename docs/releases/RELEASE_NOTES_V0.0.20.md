# DISAL Planta de Látex · V0.0.20

[← Índice de versiones](README.md)

Fecha: 15 de septiembre de 2026.

## Resumen

Esta versión actualiza el flujo de Envasado de Látex para registrar los datos propios de cada orden, separarlos de la información de fabricación y conservar la trazabilidad completa en Historial.

## Envasado

- El selector “Línea” se reemplazó visualmente por “Celda”, con opciones A y B.
- Los formatos disponibles son 1 L, 4 L, 10 L y 20 L.
- Las órdenes de envasado se validan con exactamente 6 dígitos.
- Cada OE registra una descripción propia y un material de envasado de exactamente 4 dígitos.
- Mientras el tanque está en estado `ENVASANDO`, la tarjeta oculta la OF y el material de fabricación y muestra el material y la descripción de envasado.
- Las acciones para iniciar, agregar o corregir una OE guardan material, descripción, celda y formato.
- La entrada del material elimina espacios accidentales y limita el formulario a caracteres numéricos.
- Los mensajes de validación de OE y material se muestran en español.

## Historial y trazabilidad

- Las filas correspondientes a Envasado muestran la OE, el material y la descripción de envasado.
- La búsqueda de Historial contempla OE, material de envasado, descripción, celda y formato.
- El resumen de trazabilidad incluye todas las OE del lote con material, descripción, celda, formato, inicio, fin, responsable, kilogramos, merma y unidades.
- Las OE anteriores a esta versión conservan sus datos existentes; cuando no existe un material histórico verificable se muestra como no informado, sin inventar valores.

## Base de datos y actualización

- Se agregó una descripción propia a `PackagingOrder` y se completaron los registros históricos con la descripción del lote como valor inicial.
- Se agregó `materialCode` a `PackagingOrder` como campo nullable para preservar las OE históricas; las operaciones nuevas lo validan como obligatorio en el contrato de la API.
- La configuración persistida de Látex se actualiza a celdas A/B y formatos 1/4/10/20 L.
- Se actualizó el service worker para activar nuevas versiones inmediatamente y recargar la aplicación cuando cambia el frontend, evitando formularios antiguos en caché.

## Verificación y despliegue

- Prisma validó el esquema y generó el cliente correctamente.
- La suite del backend finalizó correctamente, incluidas las pruebas nuevas del contrato de envasado.
- Backend y frontend compilaron correctamente para producción.
- Las reglas funcionales de lint pasaron sobre los archivos modificados.
- Las migraciones se aplicaron en el Docker local y el migrador terminó con código 0.
- Backend, base de datos y Node-RED quedaron saludables; frontend y API respondieron correctamente en `http://localhost:8081`.

## Consideraciones

- La actualización de entornos persistentes requiere ejecutar `prisma migrate deploy` antes de iniciar el backend nuevo.
- Las OE históricas o activas creadas antes de esta versión pueden no tener material de envasado; debe completarse mediante “Corregir OE” cuando corresponda.
- El despliegue verificado corresponde al entorno Docker local, no a producción.
