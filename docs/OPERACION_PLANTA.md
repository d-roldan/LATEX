# Operación y API de planta

## Roles

| Rol | Pantallas | Operaciones |
|---|---|---|
| `FABRICACION` | Fabricación | Iniciar/corregir OF, enviar a Laboratorio, cerrar rechazado y gestionar servicio |
| `LABORATORIO` | Laboratorio | Confirmar recepción de muestra, aprobar, pedir ajuste o rechazar |
| `ENVASADO` | Envasado | Iniciar/corregir/cambiar/finalizar OE |
| `MONITOREO` | Monitoreo e Historial | Sólo lectura |
| `JEFATURA` | Resumen diario, Monitoreo e Historial | Sólo lectura, cierres y exportaciones |
| `ADMIN` | Todas | Todas las anteriores, usuarios y auditoría |

Además del rol, cada usuario necesita `UserPlantAccess`. Los usuarios preexistentes conservan solamente Látex; el administrador protegido obtiene las cuatro plantas al ejecutar `security:ensure-system-owner`. Slurry exige además `canTransfer` (ADMIN conserva su facultad administrativa).

Ocultar un botón no constituye seguridad: todos los endpoints operativos usan JWT, roles y validación de estado en backend.

## Transiciones aceptadas

```text
VACIO → FABRICANDO → LABORATORIO → APROBADO → ENVASANDO → VACIO
                         ↓
                       AJUSTE → LABORATORIO
                         ↓
                     RECHAZADO → VACIO

VACIO → FUERA_DE_SERVICIO → VACIO

APROBADO → TRASVASANDO → VACIO   (sólo Slurry; cierra lote, no crea OE)
```

Cada escritura incluye `version`. Si otro usuario actuó primero, el backend responde `409 Conflict` y la pantalla se actualiza.

Dentro de `LABORATORIO` existe un ciclo de muestra que no agrega estados físicos al tanque:

```text
AWAITING_RECEIPT → RECEIVED → RESOLVED
     espera           análisis     aprobado / ajuste / rechazo
```

Fabricación abre el ciclo al enviar el tanque. Laboratorio confirma **Recibí la muestra** cuando la recibe físicamente; hasta entonces el backend bloquea cualquier decisión de calidad. Cada devolución después de un ajuste crea una iteración nueva. Se conservan responsable y horario de solicitud, recepción y resolución, además de los tiempos envío–recepción y recepción–resultado.

## Persistencia

- Tanques, lotes, estados, decisiones, OEs, tiempos y auditoría: PostgreSQL.
- Pesos bruto/neto y última comunicación: memoria del backend, sin tabla de muestras. Cada transición guarda una fotografía puntual en el histórico.
- La grilla consulta `/api/plants/{plantCode}/tanks` cada 2 segundos. Las rutas `/api/plant/*` se conservan transitoriamente para Látex.

## Datos configurables

- Los 9 tanques TK101–TK109 y sus `scaleKey` están en `Tank`. `capacityKg` se calcula como capacidad nominal en litros × `1,5 kg/L`: 60.000 kg para TK101–102, 45.000 kg para TK103–104, 30.000 kg para TK105–107 y 10.500 kg para TK108–109.
- Líneas, formatos, dosificadoras, filtros, motivos y objetivos nuevos están en `Plant.settings`. La lectura de Látex mantiene fallback compatible a los valores anteriores de `Company.settings`.
- En Látex, `packagingDispensers` admite inicialmente `A` y `B`, mientras que `packagingFilters` admite `1`, `2` y `3`. Cada orden de envasado conserva la selección realizada.
- Los tiempos objetivo por etapa están en `Company.settings.plantStageTargetsMinutes` y pueden configurarse desde el Resumen diario usando una cuenta ADMIN.
- El seed crea los valores iniciales observados en la especificación; pueden modificarse para los equipos reales de la planta.

Ejemplo para cambiar líneas desde PostgreSQL preservando el resto del JSON:

```sql
UPDATE "Company"
SET settings = jsonb_set(settings::jsonb, '{packagingLines}', '["Línea A", "Línea B"]'::jsonb, true)
WHERE id = 'seed_company_disal';
```

Reiniciar el backend no cambia ningún estado productivo ni cierra una OE. Sólo se pierden las lecturas efímeras de peso, que se reconstruyen con el próximo envío de Node-RED.

## Significado de “tiempo real”

La versión actual ofrece actualización visual cercana al tiempo real:

- La pantalla consulta tanques y pesos cada 2 segundos.
- Una balanza se muestra sin señal después de 10 segundos sin recepción.
- Las notificaciones se consultan cada 3 segundos.

Esto no equivale todavía a una reproducción completa de eventos del PLC. El estado operativo de la aplicación y el último peso recibido deben presentarse como datos relacionados pero independientes. Una futura integración debe incluir timestamp de origen, secuencia, calidad, idempotencia, buffer y diagnóstico de cada componente.

## Comunicación entre sectores

Actualmente cada transición relevante crea avisos para los usuarios activos del sector receptor. El aviso identifica el tanque y permite navegar hasta él. Marcarlo como leído sólo confirma visualización.

La evolución recomendada es incorporar una entrega operativa independiente de la notificación:

```text
PENDIENTE → RECIBIDA → EN_PROCESO → RESUELTA
     │           │
     ├─→ DEVUELTA
     └─→ CANCELADA
```

La entrega debe conservar sector emisor/receptor, responsables, turno, timestamps, observaciones, vencimiento y motivo de devolución. Resolver una entrega no debe modificar por sí solo el estado del tanque: las transiciones productivas continuarán pasando por sus reglas y permisos específicos.

## Controles operativos recomendados

- Al declarar un tanque vacío, comparar el último peso confiable con una tolerancia configurable. Permitir excepción sólo con motivo y auditoría.
- Mostrar la antigüedad de la lectura y su calidad además de “en línea”.
- Exigir motivo en toda corrección, devolución, rechazo o excepción.
- Evitar avanzar con datos almacenados en caché cuando la API no esté disponible.
- Definir responsables y escalamiento para esperas que superen los tiempos objetivo.
- Mantener una bitácora de turno con entregas pendientes y condiciones anormales.

## Contingencia

Si el sistema no está disponible, el PLC/SCADA conserva el control seguro del proceso. La planta debe acordar un procedimiento externo para registrar temporalmente OF, tanque, horarios, decisiones de Laboratorio y OE. Al recuperar DISAL, la carga o reconciliación debe identificar que se trata de información retrospectiva, el responsable y la evidencia utilizada; nunca debe simularse que fue capturada automáticamente.
