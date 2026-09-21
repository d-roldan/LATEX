# DISAL Planta de Látex · V0.0.24

[← Índice de versiones](README.md)

Fecha: 17 de septiembre de 2026.

## Resumen

Esta versión amplía el popup de trazabilidad del Historial para reunir en una sola vista el recorrido completo de una orden de fabricación: estados, solicitudes de ajuste de Laboratorio, órdenes de envasado, cargas de materias primas y la evolución del peso del tanque consultada en InfluxDB. También incorpora la descarga de un informe PDF profesional con identidad visual de Grupo DISAL.

## Historial y trazabilidad de OF

- El acceso desde `Orden / Material` abre una vista ampliada de la orden de fabricación seleccionada.
- El encabezado identifica la OF, el material, la descripción, el tanque utilizado y la duración total.
- La línea temporal conserva todos los estados y muestra responsable, inicio, fin, duración, descripción y peso registrado al ingresar a cada etapa.
- La búsqueda del historial también contempla números de OE, materiales y descripciones de las órdenes de envasado vinculadas.

## Laboratorio

- Cada período de `LABORATORIO` muestra los ajustes solicitados durante ese intervalo.
- Los ajustes incluyen motivos, fecha, legajo, responsable y detalle de cada material con su cantidad en kilogramos.
- La información se presenta mediante un control desplegable para mantener compacta la línea temporal.

## Órdenes de envasado

- El punto de `ENVASANDO` reúne todas las órdenes de envasado asociadas a la OF, no sólo la primera.
- Un botón compacto despliega el número de OE, material, descripción, línea, formato, inicio, fin, responsable, kilogramos producidos, merma y unidades.
- En la tabla principal, los registros de Envasado siguen identificándose por su OE y material correspondiente.

## Cargas de materias primas

- El estado `FABRICANDO` incorpora un botón desplegable preparado para mostrar las cargas individuales de materias primas.
- La tabla contempla fecha y hora, material, descripción, setpoint y cantidad real.
- Mientras la fuente de cargas no esté disponible, la interfaz informa el estado vacío sin afectar el resto de la trazabilidad.

## Historial de peso desde InfluxDB

- El backend incorpora una consulta opcional a InfluxDB 2.x para obtener el peso desde el inicio de `FABRICANDO` hasta el último timestamp disponible de la OF.
- La consulta identifica el tanque mediante su `scaleKey` y admite tanto un tag de tanque como fields independientes del tipo `PESO_TK101`.
- Los datos se reducen dinámicamente a un máximo aproximado de 500 ventanas y siempre se incorpora la última muestra disponible.
- La respuesta diferencia datos disponibles, período sin datos, configuración pendiente e indisponibilidad temporal de InfluxDB.
- Una falla de telemetría no impide consultar los estados operativos de la orden.
- La gráfica informa tanque, última muestra, rango visible y cantidad de puntos.

## Configuración de InfluxDB

Se agregan al entorno y a Docker Compose las variables:

- `INFLUXDB_URL`
- `INFLUXDB_TOKEN`
- `INFLUXDB_ORG` o `INFLUXDB_ORG_ID`
- `INFLUXDB_BUCKET`
- `INFLUXDB_WEIGHT_MEASUREMENT`
- `INFLUXDB_TANK_TAG`
- `INFLUXDB_WEIGHT_FIELD`
- `INFLUXDB_QUERY_TIMEOUT_MS`

Para la instalación actual, la medición puede configurarse como `PESOS_TANQUES_LATEX`, dejar vacío `INFLUXDB_TANK_TAG` y usar `PESO_{scaleKey}` como plantilla del field. El token real permanece fuera de Git.

## Informe PDF

- Se incorpora la descarga de un informe PDF profesional desde el popup de trazabilidad.
- El documento incluye el logo de Grupo DISAL, datos generales de la OF y el tanque, gráfica de peso, etapas, ajustes de Laboratorio, órdenes de envasado y cargas de materias primas.
- La generación se realiza en el navegador y las librerías de PDF se cargan bajo demanda para no aumentar el peso de la pantalla inicial.
- El botón se ubica en el encabezado, inmediatamente a la izquierda de la acción de cierre, para no consumir una fila adicional del popup.
- Su estética es oscura y neutra, coherente con el menú; en pantallas pequeñas se reduce al ícono con etiqueta accesible.

## Accesibilidad y experiencia de uso

- El diálogo compartido admite acciones de encabezado sin alterar los usos existentes.
- Los botones desplegables, la gráfica, los mensajes de carga y los errores cuentan con nombres o roles accesibles.
- El popup se adapta a escritorio y móvil, y mantiene versiones compatibles con los temas oscuro y claro.

## Dependencias

- Se agregan `jspdf` y `jspdf-autotable` al frontend para generar el informe descargable.
- No se incorporan migraciones de base de datos en esta versión.

## Verificación realizada

- Backend: 10 suites y 55 pruebas unitarias aprobadas.
- Backend: build de NestJS aprobado.
- Backend: lint funcional de los archivos de Influx y Planta sin errores distintos de formato; los archivos nuevos de Influx cumplen Prettier.
- Frontend: TypeScript sin errores, lint focalizado aprobado y build de Vite aprobado.
- Docker: imagen del frontend reconstruida correctamente y servicios `disal-frontend` y `disal-nginx` en ejecución.
- Navegador: popup revisado en `http://localhost:8081`, botón alineado con el cierre, franja anterior eliminada y consola sin errores.

## Consideraciones

- El lint y el chequeo global de Prettier continúan informando deuda previa de formato y finales de línea CRLF en el repositorio. No se realizó un reformateo masivo para evitar mezclar cambios ajenos a esta versión.
- La tabla de cargas queda preparada para la futura fuente persistente; actualmente puede mostrarse vacía.
- Las credenciales de InfluxDB deben configurarse como secretos del entorno de despliegue y no deben incorporarse al repositorio.
