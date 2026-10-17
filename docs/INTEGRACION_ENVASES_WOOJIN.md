# ENVASES · monitoreo Woojin

## Alcance

ENVASES es una planta independiente de ENVASADO. El backend recibe el resumen ya producido por el Node-RED industrial externo y conserva únicamente el último valor aceptado de cada inyectora en memoria. No consulta MariaDB ni Modbus, no envía órdenes a las máquinas y no escribe muestras en PostgreSQL o InfluxDB. Tras reiniciar el backend, las cinco tarjetas muestran **Sin datos** hasta el siguiente lote.

Como la caché vigente es local al proceso (igual que la telemetría de pesos actual), la recepción y las consultas deben llegar a la misma instancia de backend. Un despliegue con varias réplicas necesitaría un almacén compartido antes de habilitar balanceo libre entre ellas.

La pantalla autenticada es `/envases?plant=ENVASES`; la TV de consulta pública sigue el modelo existente en `/tv?plant=ENVASES`. La API pública de TV no expone la clave ni concede acciones de administración. Para restringirla en una instalación concreta sería necesario cambiar el modelo público de TV de la aplicación.

## Catálogo y umbrales

El catálogo central está en `apps/backend/src/modules/plant/injection-machines.config.ts` y viaja en la respuesta de consulta; el frontend no mantiene una copia de las IP. Orden: INY01 / 172.16.0.141 / DL650G5, INY02 / 172.16.0.146 / DL450G5, INY03 / 172.16.0.143 / TB280G5-1, INY04 / 172.16.0.144 / TB280G5-2, INY05 / 172.16.0.145 / TB200G5. Para agregar, cambiar u ocultar una inyectora, editar una entrada del catálogo y desplegar el backend. El frontend genera las tarjetas desde la lista devuelta y admite más equipos sin cambios.

Los umbrales declarados en ese archivo son: CMS 10 s, recepción Node-RED 30 s, incremento observado 60 s y refresco visual 2 s. Ajustar el segundo y el tercero a la cadencia real de adquisición. La frescura se calcula con timestamps absolutos ISO 8601 UTC y la hora se presenta en la zona local del navegador. Un timestamp SQL reciente no valida la adquisición Modbus. `AUTO` tampoco confirma producción física. El valor `adquisicion_industrial_fresca` se muestra sin reinterpretarlo.

## Preparación de la base y permisos

No hay cambio de schema ni migración. `Plant` y `PlantIntegration` existentes admiten este módulo; las inyectoras se catalogan de forma declarativa porque `Tank` contiene estados, lotes y capacidad específicos de tanques. El seed de una instalación nueva crea la planta sin inventar tanques. Para una instalación existente, preparar la empresa destino mediante el script idempotente `prisma:provision-envases`. **No ejecutar el seed general sobre una base existente para esta incorporación:** también realiza otras tareas de inicialización.

1. Verificar respaldo y empresa destino. Si no usa `seed_company_disal`, definir `SYSTEM_OWNER_COMPANY_ID`.
2. Generar una clave aleatoria exclusiva de al menos 32 caracteres y cargarla como `ENVASES_NODE_RED_KEY` sólo en el entorno del proceso que ejecutará el script y en el almacén de credenciales del Node-RED externo. No copiarla a Git ni al frontend. El script almacena su hash SHA-256 en `PlantIntegration` con fuente `NODE_RED_ENVASES`.
3. Después de compilar el backend, ejecutar desde `apps/backend` `npm run build` y `npm run prisma:provision-envases` en el destino autorizado, con `DATABASE_URL` y las variables anteriores apuntando explícitamente a ese destino. Sin la variable de clave, sólo crea la planta y deja la integración pendiente. El backend en ejecución no necesita la clave en su entorno: compara contra el hash guardado.
4. Asignar ENVASES a cada usuario autorizado desde la administración de usuarios existente. La creación de la planta no concede permisos automáticamente. Comprobar con un usuario asignado y uno sin asignación.

Este procedimiento está preparado, pero **no se ejecutó contra producción**. Tampoco se importó ni habilitó ningún flujo en Node-RED externo.

## Contrato HTTP

`POST /api/plants/ENVASES/telemetry/injection-machines` requiere `X-Node-Red-Key` y una `PlantIntegration` activa de fuente `NODE_RED_ENVASES`. El cuerpo es el objeto `msg.payload` de `RESUMEN 5 WOOJIN` con `source: "NODE_RED_ENVASES"` y `schemaVersion: 1` añadidos:

```json
{
  "source": "NODE_RED_ENVASES",
  "schemaVersion": 1,
  "fecha_recepcion_nodered": "2026-10-16T18:46:28.685Z",
  "cantidad_filas_sql": 5,
  "cantidad_maquinas_frescas_cms": 5,
  "duracion_consulta_ms": 5,
  "maquinas": [
    {
      "machine_ip": "172.16.0.141",
      "modelo": "DL650G5",
      "cms_timestamp": "2026-10-16T18:46:27.000Z",
      "current_quantity": 11429,
      "operation_status_code": 1,
      "operation_status_text": "AUTO",
      "adquisicion_industrial_fresca": "NO_VERIFICADA"
    }
  ]
}
```

Se admiten lotes parciales. Cada IP conocida y visible se relaciona con su código estable; el modelo recibido, si existe, debe coincidir con el catálogo. Una IP desconocida o un modelo distinto se rechazan por máquina, sin perder las aceptadas. Se rechazan IP repetidas en el mismo lote, timestamps futuros, tipos inválidos y campos fuera del contrato. Se ignora una lectura cuyo `cms_timestamp` sea igual o anterior al último aceptado de esa inyectora. Respuesta: `accepted`, `rejected`, `ignored`, `receivedAt`, `persisted: false` y `results` por IP. Un lote válido, aunque repita muestras, actualiza la última comunicación del emisor; no altera contadores.

`GET /api/plants/ENVASES/telemetry/injection-machines` requiere sesión, rol de planta y asignación ENVASES al usuario. `GET /api/plants/ENVASES/tv/injection-machines` es público conforme al TV existente. Ambos devuelven un único lote ordenado con cinco equipos y `reading: null` para los que aún no recibieron datos. `communication`, `cmsFresh`, `communicationFresh` y `counterRecent` se recalculan al consultar. La recepción desde Node-RED, la frescura SQL de CMS y la validación industrial son diagnósticos independientes. Los valores nulos y los códigos desconocidos permanecen visibles.

`cycle_time_current` y `cycle_time_before` se muestran en segundos como **unidad inferida pendiente de confirmación**. `production_time_hour` y `production_time_min` se rotulan como tiempo reportado por CMS. `total_quantity` es total reportado por CMS, no meta. El delta de contador indica cambio entre consultas, no piezas producidas en un segundo. El código de alarma se muestra en bruto: cero no se interpreta como ausencia confirmada de alarma.

## Rama importable de Node-RED

Archivo: `infra/node-red/examples/envases-woojin-http-branch.json`. Importar **en la pestaña del flujo que ya produce `RESUMEN 5 WOOJIN`**; conectar una nueva salida de ese nodo a la entrada de `ENVASES · preparar lote`. Mantener sus conexiones existentes a Debug, `EVENTOS contador` y `PREPARADO InfluxDB (NO escribe)`. No agregar un Inject ni otra consulta SQL. La rama envía el resumen completo en una sola solicitud, con timeout de 4 s, hasta dos reintentos separados por 3 s y una compuerta temporal para que una caída de LATEX no acumule envíos sin límite. Los diagnósticos muestran únicamente estado y cantidades; nunca la clave ni el cuerpo completo.

Configurar en el entorno seguro de ese Node-RED:

- `LATEX_API_BASE_URL`: URL interna del backend terminada en `/api`, accesible desde el contenedor externo.
- `ENVASES_NODE_RED_KEY`: la misma clave secreta usada al provisionar `PlantIntegration`.

Probar primero contra un backend de desarrollo con un resumen real o una muestra controlada y comprobar aceptación por IP, orden, refresco de 2 s y caducidad al detener envíos. Inspeccionar el mapeo de tiempos entre MariaDB, Node-RED y backend. La conectividad productiva sigue **pendiente de habilitar esta rama** con autorización del responsable del Node-RED compartido. No reiniciar ni desplegar el Node-RED externo como parte de la preparación local.

## Simulación local para visualizar las tarjetas

El simulador local tiene fuente, clave y caché propias (`NODE_RED_ENVASES_SIM`, `ENVASES_SIM_NODE_RED_KEY`). Su configuración, controles de escenarios, parámetros de último ciclo, pruebas y límites están en [SIMULADOR_ENVASES_WOOJIN.md](SIMULADOR_ENVASES_WOOJIN.md). No reutilizar la clave real ni importar el flujo de demostración en el Node-RED industrial externo.

## Validación y límites

La verificación local debe incluir contrato válido/inválido, permisos, parcialidad, duplicados, códigos desconocidos, nulidad, caída de señal, compilaciones y vista en 1920 × 1080 y tamaños menores. Una muestra de prueba local demuestra el recorrido de aplicación; no demuestra conectividad productiva con CMS. No hay historial persistido ni gráficos históricos en esta fase. La salida `PREPARADO InfluxDB (NO escribe)` queda intacta para una etapa posterior con autorización independiente.
