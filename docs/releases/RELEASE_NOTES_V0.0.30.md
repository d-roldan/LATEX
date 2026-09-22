# DISAL Planta de Látex · V0.0.30

[← Índice de versiones](README.md)

Fecha: 22 de septiembre de 2026.

## Resumen

Esta versión amplía la pantalla de Auditoría con filtros temporales globales y una vista detallada de actividad por usuario. También reorganiza la trazabilidad de Laboratorio para presentar muestras y ajustes dentro de la secuencia real de estados de cada orden de fabricación, tanto en pantalla como en el informe PDF.

## Auditoría por período

- Se incorporó un filtro de período visible para todo el tablero, con fechas **Desde/Hasta** y accesos rápidos para hoy, 7 días y 30 días.
- El período seleccionado se aplica a indicadores, alertas de acceso, gráfico diario, actividad de usuarios y bitácora unificada.
- Seleccionar la misma fecha en ambos campos permite analizar un único día completo con la zona horaria de Argentina.
- El gráfico conserva hasta los últimos 14 días comprendidos dentro del período elegido.

## Resumen e historial por usuario

- El nombre de cada usuario abre un diálogo con el mismo patrón visual y de accesibilidad utilizado por la trazabilidad del Historial de estados.
- El resumen muestra estado de la cuenta, situación de seguridad, último ingreso, movimientos del período, accesos correctos y fallidos, acciones realizadas y plantas involucradas.
- Debajo del resumen se agregó una tabla cronológica con fecha y hora, origen, movimiento, elemento, contexto y detalle auditable.
- La tabla dispone de un período **Desde/Hasta** propio, independiente del resumen general.
- La paginación carga 25 movimientos por defecto y permite seleccionar 50, con navegación entre páginas y conteo total.
- El backend combina los registros de sistema y planta en orden cronológico, pagina la respuesta y verifica que el usuario consultado pertenezca a la empresa autenticada.
- Los valores sensibles continúan ocultándose antes de responder al navegador y la funcionalidad permanece restringida al Super Usuario.

## Trazabilidad de Laboratorio

- Los ciclos de recepción y análisis de muestras se muestran dentro de la etapa `LABORATORIO` correspondiente, respetando la secuencia de la OF.
- Las solicitudes de ajuste se presentan dentro de su etapa `AJUSTE`, junto con motivos, responsables y materiales asociados.
- El PDF incorpora estos detalles en la columna cronológica de cada etapa, evitando repetir los ajustes en una sección separada.
- Las tarjetas simplifican el subestado de Laboratorio y adaptan el contraste del texto al tema claro u oscuro.

## Base de datos e integración

- No se agregan tablas, columnas ni migraciones.
- La actualización utiliza los registros existentes de `AuditLog`, `PlantAuditLog`, ciclos de muestras e historial de estados.
- El archivo de flujos de Node-RED conserva la misma lógica operativa; sólo cambia el orden del nodo dentro del JSON exportado.

## Verificación realizada

- Backend compilado correctamente y 71 pruebas automatizadas aprobadas en 14 suites.
- Frontend validado con TypeScript y build productivo de Vite.
- Los archivos TypeScript modificados aprobaron ESLint y Prettier.
- Las imágenes Docker de backend y frontend se reconstruyeron correctamente.
- Backend y PostgreSQL quedaron saludables; Nginx respondió HTTP 200 en el puerto local `8081`.
- `git diff --check` finalizó sin errores de espacios en blanco.
- El formato global continúa informando deuda histórica en archivos compactos y finales de línea del repositorio; no se realizó un reformateo masivo.

## Consideraciones de actualización

- No es necesario ejecutar migraciones ni seeds para instalar esta versión.
- Desplegar backend y frontend en conjunto para que el popup utilice el nuevo contrato paginado.
- Después de actualizar el frontend puede ser necesaria una recarga forzada del navegador para descartar recursos anteriores de la PWA.

