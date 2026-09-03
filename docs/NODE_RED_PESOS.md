# Contrato de pesos Node-RED → Planta de Látex

## Endpoint

```text
POST http://<servidor>:<HTTP_PORT>/api/plant/telemetry/weights
Content-Type: application/json
X-Node-Red-Key: <NODE_RED_API_KEY>
```

La frecuencia prevista es un lote cada aproximadamente **2 segundos**. El endpoint admite de 1 a 100 lecturas por solicitud. Se recomienda enviar los 9 tanques juntos.

## Nombres acordados

| Tanque | `scaleKey` esperado | Campo de peso bruto | Campo opcional neto |
|---:|---|---|---|
| 101 | `TK101` | `grossKg` | `netKg` |
| 102 | `TK102` | `grossKg` | `netKg` |
| 103 | `TK103` | `grossKg` | `netKg` |
| 104 | `TK104` | `grossKg` | `netKg` |
| 105 | `TK105` | `grossKg` | `netKg` |
| 106 | `TK106` | `grossKg` | `netKg` |
| 107 | `TK107` | `grossKg` | `netKg` |
| 108 | `TK108` | `grossKg` | `netKg` |
| 109 | `TK109` | `grossKg` | `netKg` |

## JSON de ejemplo

```json
{
  "readings": [
    { "scaleKey": "TK101", "grossKg": 5070.125, "netKg": 5018.400, "measuredAt": "2026-09-02T17:47:00.000Z" },
    { "scaleKey": "TK102", "grossKg": 5950.000, "measuredAt": "2026-09-02T17:47:00.000Z" }
  ]
}
```

`measuredAt` es opcional y debe ser ISO 8601. Si falta o no es válido, el backend usa la hora de recepción. Los kilogramos son números, no texto y no deben incluir separadores de miles.

Respuesta esperada:

```json
{
  "accepted": 2,
  "receivedAt": "2026-09-02T17:47:00.120Z",
  "persisted": false
}
```

## Comportamiento importante

- Las lecturas se conservan únicamente en memoria del backend.
- No existe una tabla SQL de pesos y no se genera histórico de las muestras.
- Un reinicio elimina las lecturas; el panel vuelve a mostrar peso al recibir el siguiente lote.
- Una lectura con más de 10 segundos desde su recepción se marca visualmente como **Sin señal**.
- Node-RED debe conservar el último valor sólo para reintentar la transmisión, no para rellenar valores ficticios.
- HTTP `401`: clave incorrecta. HTTP `400`: JSON o campos inválidos. HTTP `429`: frecuencia excesiva.

## Ejemplo de Function node

```javascript
const now = new Date().toISOString();
msg.headers = {
  "content-type": "application/json",
  "x-node-red-key": env.get("NODE_RED_API_KEY")
};
msg.payload = {
  readings: [
    { scaleKey: "TK101", grossKg: Number(flow.get("peso_tk_101")), measuredAt: now },
    { scaleKey: "TK102", grossKg: Number(flow.get("peso_tk_102")), measuredAt: now }
    // continuar hasta TK109
  ]
};
return msg;
```

Conectar este nodo a un HTTP Request `POST` dirigido al endpoint anterior. Este proyecto sólo recibe pesos; no expone comandos TARA ni CERO.

## Simulador incluido en Docker Compose

El servicio `disal-node-red` carga el flujo `infra/node-red/data/flows.json` y abre el editor únicamente en la PC local:

```text
http://localhost:1880
```

El nodo **Enviar cada 2 segundos** comienza automáticamente después de desplegar el contenedor. Genera valores variables para TK101–TK109 y los envía a `http://disal-nginx/api/plant/telemetry/weights`. La clave se obtiene de la variable `NODE_RED_API_KEY` inyectada por Compose.

Para probar una sola muestra, deshabilitar el inyector periódico, desplegar el cambio y presionar **Enviar una vez**. Las respuestas de la API se observan en la pestaña **Depuración**.
