# Contrato de pesos Node-RED → DISAL multiplanta

## Contrato vigente

```text
POST /api/plants/{plantCode}/telemetry/weights
X-Node-Red-Key: <credencial exclusiva de la integración>
Content-Type: application/json
```

`plantCode` admite `LATEX`, `TERPLAST` o `SLURRY`. Enduido no tiene sensores. La credencial se guarda únicamente como SHA-256 en `PlantIntegration.keyHash`, está limitada a una planta/fuente y nunca se entrega al frontend. Una integración nueva queda deshabilitada hasta confirmar tags y habilitar `PlantIntegration.isActive`.

```json
{"source":"NODE_RED_LATEX","readings":[{"scaleKey":"TK101","grossKg":18542.7,"measuredAt":"2026-09-08T14:32:10.000Z"}]}
```

`grossKg` y `netKg` son números finitos en kg. `measuredAt`, si se envía, debe ser ISO-8601 válido. La API responde un resultado por lectura. El lote tiene aceptación parcial: una clave desconocida o no habilitada se informa `REJECTED`; una muestra igual o anterior a la vigente se informa `IGNORED_OLDER` y no reemplaza el valor actual.

```json
{"accepted":1,"rejected":0,"ignored":0,"persisted":false,"results":[{"scaleKey":"TK101","status":"ACCEPTED"}]}
```

La telemetría instantánea vive en memoria. Tras reiniciar el backend aparece sin comunicación hasta recibir una lectura nueva; las fotografías tomadas al cambiar estados sí quedan en `TankStateHistory`.

## Compatibilidad Látex

`POST /api/plant/telemetry/weights` con `NODE_RED_API_KEY` continúa disponible exclusivamente para Látex. No acepta otro código de planta. Se puede retirar cuando todos los emisores de Látex usen la ruta nueva y se haya observado un ciclo operativo completo sin cruces.

## Mapa de integración

| Planta | Equipo | `scaleKey` | Tag/variable origen | Unidad/transformación | Disponibilidad | Emisor/ruta |
|---|---|---|---|---|---|---|
| Látex | TK101–TK109 | TK101–TK109 | Flujo vigente; confirmar nombre de tag in situ | kg, sin transformación confirmada | Disponible | NODE_RED_LATEX → `/plants/LATEX/...` |
| Terplast | TANQUE 3 y TANQUE 4 (1.500 kg); TANQUE 5 y TANQUE 6 (8.000 kg) | Pendiente | Pendiente de relevamiento | Pendiente | Deshabilitada (`PENDING`) | NODE_RED_TERPLAST → `/plants/TERPLAST/...` |
| Slurry | Dispersora 1–2 (provisorio) | Pendiente | Pendiente de relevamiento | Pendiente | Deshabilitada (`PENDING`) | NODE_RED_SLURRY → `/plants/SLURRY/...` |
| Enduido | Equipo 1–2 (provisorio) | No aplica | No aplica | No aplica | Sensor no instalado | No aplica |

Los nombres provisorios no son tags físicos. Antes de operar se deben confirmar códigos reales, actualizar `equipmentCode`/`scaleKey`, cambiar `telemetryMode` a `AUTOMATIC` y recién entonces habilitar la integración.

## Simulación del Docker local

La instalación Docker local incluye la pestaña `Pesos multiplanta DISAL` en Node-RED. Con `DISAL_ENABLE_WEIGHT_SIMULATOR=true`, cada tres segundos envía lotes independientes por la ruta multiplanta. El valor predeterminado de Compose y del archivo de ejemplo es `false` para impedir que un despliegue nuevo active simuladores accidentalmente.

| Planta | Fuente local | Claves simuladas | Resultado esperado |
|---|---|---|---|
| Látex | `NODE_RED_LATEX` | `TK101`–`TK109` | 9 lecturas aceptadas |
| Terplast | `NODE_RED_TERPLAST_LOCAL` | `TERP01`–`TERP04` | 4 lecturas aceptadas |
| Slurry | `NODE_RED_SLURRY_LOCAL` | `SLURRY01`–`SLURRY02` | 2 lecturas aceptadas |
| Enduido | No aplica | No aplica | No se hace POST; conserva `NOT_INSTALLED` |

Correspondencia local Terplast: `TERP01` → TANQUE 3 (1.500 kg), `TERP02` → TANQUE 4 (1.500 kg), `TERP03` → TANQUE 5 (8.000 kg), `TERP04` → TANQUE 6 (8.000 kg). Las claves de integración e IDs se conservan; los nombres y capacidades fueron confirmados el 9 de septiembre de 2026. Los tags físicos siguen pendientes.

Los tags de Terplast y Slurry son exclusivamente fixtures del entorno local. No deben copiarse a producción ni interpretarse como mapeos de PLC confirmados. El flujo anterior `Simulador de pesos DISAL` se conserva deshabilitado como referencia para evitar envíos duplicados.

La simulación reutiliza `NODE_RED_API_KEY` sólo dentro del Docker local; el backend la valida contra una integración activa y su `source` para cada ruta. Una instalación real debe usar una credencial distinta por emisor/planta.

## Tiempo de comunicación

Un equipo con telemetría automática muestra «Sin señal» después de más de 30 segundos sin una lectura nueva aceptada. Este margen admite emisores con pulsos de 10 segundos. Las tarjetas mantienen su consulta cada 2 segundos. El peso puede repetirse, pero `measuredAt` debe corresponder a una nueva medición: timestamps iguales o anteriores se ignoran y no renuevan la comunicación.

## Variables del emisor

- `DISAL_API_BASE_URL`: URL alcanzable terminada en `/api`.
- `DISAL_PLANT_CODE`: código de planta.
- `DISAL_INTEGRATION_KEY`: secreto exclusivo.
- `DISAL_SOURCE_ID`: coincide con `PlantIntegration.source`.
- `DISAL_REQUEST_TIMEOUT_MS`: recomendado 5000.
- `DISAL_ENABLE_WEIGHT_SIMULATOR`: habilita exclusivamente los fixtures del Docker local; debe permanecer `false` en producción.

`disal-nginx` sólo resuelve dentro de la red de Compose. Un Node-RED externo debe usar el DNS/protocolo real del servidor. El ejemplo importable está en `infra/node-red/examples/multiplant-weights.json`; sus inyectores están deshabilitados y contiene sólo placeholders. El flujo local desplegado está en `infra/node-red/data/flows.json`.
