# Operación y API de planta

## Roles

| Rol | Pantallas | Operaciones |
|---|---|---|
| `FABRICACION` | Fabricación | Iniciar/corregir OF, enviar a Laboratorio, cerrar rechazado y gestionar servicio |
| `LABORATORIO` | Laboratorio | Aprobar, pedir ajuste o rechazar |
| `ENVASADO` | Envasado | Iniciar/corregir/cambiar/finalizar OE |
| `MONITOREO` | Monitoreo e Historial | Sólo lectura |
| `JEFATURA` | Resumen diario, Monitoreo e Historial | Sólo lectura, cierres y exportaciones |
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
- Pesos bruto/neto y última comunicación: memoria del backend, sin tabla de muestras. Cada transición guarda una fotografía puntual en el histórico.
- La grilla consulta `/api/plant/tanks` cada 2 segundos.

## Datos configurables

- Los 9 tanques TK101–TK109 y sus `scaleKey` están en `Tank`. `capacityKg` se calcula como capacidad nominal en litros × `1,5 kg/L`: 60.000 kg para TK101–102, 45.000 kg para TK103–104, 30.000 kg para TK105–107 y 10.500 kg para TK108–109.
- Líneas, formatos y motivos están en el JSON `Company.settings`.
- Los tiempos objetivo por etapa están en `Company.settings.plantStageTargetsMinutes` y pueden configurarse desde el Resumen diario usando una cuenta ADMIN.
- El seed crea los valores iniciales observados en la especificación; pueden modificarse para los equipos reales de la planta.

Ejemplo para cambiar líneas desde PostgreSQL preservando el resto del JSON:

```sql
UPDATE "Company"
SET settings = jsonb_set(settings::jsonb, '{packagingLines}', '["Línea A", "Línea B"]'::jsonb, true)
WHERE id = 'seed_company_disal';
```

Reiniciar el backend no cambia ningún estado productivo ni cierra una OE. Sólo se pierden las lecturas efímeras de peso, que se reconstruyen con el próximo envío de Node-RED.
