# DISAL Planta de Látex · V0.0.32

[← Índice de versiones](README.md)

Fecha: 28 de septiembre de 2026.

## Resumen

Esta versión amplía la operación multiplanta, separa la recepción de muestras del inicio efectivo del análisis de Laboratorio y renueva varias pantallas operativas. También incorpora una visualización de tanques de sólo lectura para Jefatura, mejora el resumen diario, el historial, las notificaciones, el Copiloto y la documentación distribuible.

## Laboratorio y trazabilidad

- La recepción física de una muestra ya no inicia automáticamente el tiempo de análisis: Laboratorio puede comenzar el análisis en ese momento o dejar el tanque en espera.
- Se incorpora el subestado `ANALYZING`, con fecha y responsable del inicio efectivo del análisis.
- No se permite aprobar, ajustar ni rechazar una muestra hasta que el análisis haya comenzado.
- El historial, la línea de tiempo, el resumen diario y los PDF distinguen demora de llegada, espera previa al análisis y duración real del análisis.
- La migración de compatibilidad convierte las muestras antiguas en estado `RECEIVED` a `ANALYZING`, usando la recepción histórica como inicio para conservar la semántica anterior.

## Plantas y equipos

- Se incorpora **Látex Viejo** con cuatro tanques de 30.000 kg, códigos `LV01`–`LV04`, telemetría pendiente y configuración inicial heredada de Látex.
- Se incorpora **Sintéticos** con trece tanques, códigos `SIN01`–`SIN13`, telemetría y capacidades pendientes, y configuración inicial heredada de Látex.
- Administradores y dueños reciben acceso inicial a las plantas nuevas; los demás usuarios requieren asignación explícita.
- Los selectores, pantallas públicas, esqueletos de carga y consultas por planta reconocen las nuevas instalaciones.
- Se conserva el aislamiento por empresa, usuario y planta en las consultas autenticadas.

## Jefatura, resumen e historial

- Jefatura dispone de la nueva opción **Visualización**, con tarjetas de tanques de la planta activa en modo estrictamente informativo, sin acciones ni formularios operativos.
- El resumen diario presenta indicadores de fabricación, muestras pendientes, análisis en curso, espera de envasado, lotes finalizados, kilos envasados y alertas.
- Se amplían la consulta por fecha, cierres diarios, objetivos administrables y exportaciones PDF/Excel.
- La trazabilidad de lotes muestra responsables, marcas horarias, pesos de transición, órdenes de envasado, dosificadora, filtro y tiempos de Laboratorio desglosados.

## Interfaz y experiencia de uso

- Se renuevan estilos, contraste y comportamiento responsive de paneles, tarjetas, diálogos, tablas, controles, estados de carga y temas claro/oscuro.
- Las notificaciones se filtran por planta y sector, permiten marcar todas como leídas y elegir, probar o silenciar el sonido.
- Se incorpora un proveedor global de avisos breves para comunicar resultados de acciones.
- El Copiloto mejora la navegación de conversaciones, sugerencias, evidencia enlazada, estados de procesamiento, copia de respuestas, manejo de errores y presentación móvil.
- Se fortalecen mensajes y controles de sesión, cambio de contraseña y actualización de la PWA.

## Documentación y materiales

- Se agregan documentos Word y PDF de los manuales de Fabricación, Laboratorio, Envasado y Administrador.
- Se incorporan capturas operativas y el diagrama del flujo de fabricación utilizados por la documentación.
- Se agrega el script reproducible para exportar los manuales a Word.
- Se actualizan la especificación funcional, operación, despliegue y modelo de datos para reflejar el flujo de análisis y las plantas nuevas.

## Base de datos y actualización

- `20260923120000_add_laboratory_analysis_start` agrega el estado `ANALYZING`, las marcas de inicio y la relación con el usuario responsable.
- `20260923120100_backfill_laboratory_analysis_start` adapta las muestras históricas recibidas.
- `20260924090000_add_latex_viejo_plant` crea Látex Viejo, sus cuatro tanques, estados iniciales y accesos administrativos.
- `20260928120000_add_sinteticos_plant` crea Sintéticos, sus trece tanques, estados iniciales y accesos administrativos.
- En una actualización existente se deben aplicar las migraciones con `prisma migrate deploy` o mediante el servicio `disal-migrate`; no corresponde ejecutar seeds ni resets.

## Verificación realizada

- Los 14 suites y 73 tests unitarios del backend finalizaron correctamente.
- El esquema Prisma fue validado y el cliente Prisma se generó correctamente.
- El backend compiló correctamente con NestJS.
- El frontend compiló correctamente dentro de la imagen Docker de producción.
- Se reconstruyó `disal-frontend`, y la aplicación local respondió HTTP 200 en `/visualizacion` a través de Nginx.
- La comprobación global de formato detectó deuda previa de finales de línea y formato en archivos no limitados a esta versión; no se aplicó una reescritura masiva para evitar mezclar cambios mecánicos adicionales.

## Consideraciones de actualización

- Realizar backup antes de aplicar las migraciones y verificar la salida exitosa de `disal-migrate`.
- Revisar y asignar accesos a Látex Viejo y Sintéticos para los usuarios no administrativos.
- Configurar capacidades y claves de telemetría de Sintéticos antes de tratar sus lecturas como reales.
- Confirmar con Laboratorio que el nuevo paso **Iniciar análisis** representa el comienzo real del trabajo y no sólo la recepción de la muestra.
- Después del despliegue, actualizar la PWA o realizar una recarga completa si el navegador conserva recursos de la versión anterior.
