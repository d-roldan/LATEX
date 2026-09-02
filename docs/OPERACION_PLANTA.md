# Operación y API de planta

## Roles

| Rol | Pantallas | Operaciones |
|---|---|---|
| `FABRICACION` | Fabricación | Iniciar/corregir OF, enviar a Laboratorio, cerrar rechazado y gestionar servicio |
| `LABORATORIO` | Laboratorio | Aprobar, pedir ajuste o rechazar |
| `ENVASADO` | Envasado | Iniciar/corregir/cambiar/finalizar OE |
| `MONITOREO` | Monitoreo e Historial | Sólo lectura |
| `ADMIN` | Todas | Todas las anteriores, usuarios y auditoría |

Ocultar un botón no constituye seguridad: todos los endpoints operativos usan JWT, roles y validación de estado en backend.

## Transiciones aceptadas

```text
VACIO → FABRICANDO → LABORATORIO → APROBADO → ENVASANDO → VACIO
                         ↓
                       AJUSTE → LABORATORIO
                         ↓
                     RECHAZADO → VACIO

VACIO → FUERA_DE_SERVICIO → VACIO
```

Cada escritura incluye `version`. Si otro usuario actuó primero, el backend responde `409 Conflict` y la pantalla se actualiza.

## Persistencia

- Tanques, lotes, estados, decisiones, OEs, tiempos y auditoría: PostgreSQL.
- Pesos bruto/neto y última comunicación: memoria del backend, sin tabla SQL.
- La grilla consulta `/api/plant/tanks` cada 2 segundos.

## Datos configurables

- Los 9 tanques TK101–TK109 y sus `scaleKey` están en `Tank`. `capacityKg` queda en `NULL` hasta configurar las dimensiones reales.
- Líneas, formatos y motivos están en el JSON `Company.settings`.
- El seed crea los valores iniciales observados en la especificación; pueden modificarse para los equipos reales de la planta.

Ejemplo para cambiar líneas desde PostgreSQL preservando el resto del JSON:

```sql
UPDATE "Company"
SET settings = jsonb_set(settings::jsonb, '{packagingLines}', '["Línea A", "Línea B"]'::jsonb, true)
WHERE id = 'seed_company_disal';
```

Reiniciar el backend no cambia ningún estado productivo ni cierra una OE. Sólo se pierden las lecturas efímeras de peso, que se reconstruyen con el próximo envío de Node-RED.
