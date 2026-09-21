# Matriz PLC / SCADA / Node-RED / InfluxDB

## Objetivo y límite

Esta matriz separa responsabilidades antes de conectar señales físicas. DISAL recibe eventos y presenta trazabilidad; no reemplaza enclavamientos, automatismos ni el control seguro del proceso. Los tags físicos pendientes deben permanecer deshabilitados hasta que Automatización confirme nombre, unidad, escala, calidad y equipo asociado.

## Responsabilidades

| Componente | Fuente de verdad | Conserva | No debe hacer |
|---|---|---|---|
| PLC | Estado y seguridad del proceso físico | Señales, enclavamientos y secuencias de máquina | Depender de DISAL para operar en forma segura |
| SCADA | Supervisión industrial | Contexto operativo y alarmas según la instalación | Inventar OF, decisiones de calidad o recepciones humanas |
| Node-RED / integrador | Transporte y adaptación | Buffer, reintentos, normalización y diagnóstico del enlace | Generar un identificador diferente al reintentar el mismo evento |
| InfluxDB | Telemetría de alta frecuencia | Series de peso y variables continuas | Ser la única evidencia de decisiones humanas o estados consolidados |
| PostgreSQL DISAL | Eventos productivos consolidados | Inbox idempotente, OF/OE, hitos, decisiones, responsables y auditoría | Duplicar sin criterio toda la señal de alta frecuencia |

## Contrato de eventos durables

```http
POST /api/plants/{plantCode}/integration/events
X-Integration-Key: <credencial exclusiva de la fuente y planta>
Content-Type: application/json
```

```json
{
  "source": "scada-latex",
  "events": [
    {
      "eventId": "plc-000042",
      "eventType": "BATCH_STEP_COMPLETED",
      "occurredAt": "2026-09-20T15:30:00.000Z",
      "sequence": "42",
      "payload": { "equipmentCode": "TK101", "step": 3 }
    }
  ]
}
```

`eventId` es estable durante todos los reintentos. La unicidad se controla por planta, fuente e identificador. `occurredAt` representa el instante de origen y `receivedAt` el instante de recepción en DISAL. La API admite hasta 100 eventos por lote y responde cuántos fueron aceptados y cuántos ya existían.

La bandeja sólo deja el evento en estado `RECEIVED`: no cambia automáticamente el estado de un tanque. Cada tipo de evento deberá tener un procesador explícito, reglas de reconciliación y pruebas antes de habilitarlo en producción.

## Matriz mínima a completar por señal

| Planta | Equipo | Tag / variable física | Origen | Tipo de dato | Unidad | Escala | Calidad | Frecuencia | Destino | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| Látex | TK101–TK109 | Confirmar con Automatización | Node-RED actual | decimal | kg | Confirmar | Timestamp y antigüedad | ~2 s | Memoria + InfluxDB | Peso operativo vigente |
| Terplast | Tanques 3–6 | Pendiente | Pendiente | decimal | kg | Pendiente | Pendiente | Pendiente | Memoria + InfluxDB | No habilitar como real |
| Slurry | Equipos 1–2 | Pendiente | Pendiente | decimal | kg | Pendiente | Pendiente | Pendiente | Memoria + InfluxDB | No habilitar como real |
| Enduido | Dispersoras 1–2 | Sin sensor | — | — | — | — | — | — | — | No instalado |

Para cada evento discreto se deben agregar además: `eventType`, criterio de inicio/fin, `eventId`, secuencia, comportamiento ante pérdida de conexión, ventana de reintento, responsable funcional y regla de conciliación.

## Puesta en producción

1. Confirmar NTP en PLC/SCADA, integrador, InfluxDB y servidor DISAL.
2. Crear una credencial diferente por fuente y planta; almacenar sólo su hash en `PlantIntegration`.
3. Probar duplicados, eventos atrasados, fuera de orden y reanudación después de una caída.
4. Verificar que el buffer reenvíe el mismo `eventId` y que PostgreSQL conserve una sola fila.
5. Habilitar primero en observación, sin ejecutar transiciones productivas automáticas.
6. Acordar tablero de diagnóstico y procedimiento de contingencia antes de automatizar cualquier consolidación.
