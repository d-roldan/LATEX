# Requisitos funcionales · Planta de Látex DISAL

## Operación

- Nueve tanques fijos TK101–TK109.
- Flujo `VACIO → FABRICANDO → LABORATORIO → APROBADO → ENVASANDO → VACIO`.
- Caminos controlados de ajuste, rechazo y fuera de servicio.
- Pantallas separadas para Fabricación, Laboratorio y Envasado.
- Confirmaciones internas, control de versión y autorización en backend.
- Peso en vivo desde Node-RED sin persistencia de muestras continuas.
- Foto del peso únicamente al confirmar un cambio de etapa.

## Trazabilidad

- Inicio, fin y duración de cada estado.
- OF, material, descripción, cantidad planificada, prioridad, turno y programación.
- Responsable y motivo de cada transición o corrección.
- Decisiones e iteraciones de Laboratorio.
- OE, línea, formato, duración, kilogramos, unidades y merma de Envasado.
- Línea temporal consultable por OF.
- Fechas almacenadas con zona horaria y presentadas en Buenos Aires.

## Jefatura

- Rol `JEFATURA` de sólo lectura operativa.
- Resumen diario para reunión: WIP, esperas, finalizados, calidad, envasado y alertas.
- Tiempo actual por tanque con semáforos configurables.
- Cierre diario persistido con observaciones del jefe.
- Exportación del resumen en PDF y Excel.

## Seguridad y continuidad

- JWT, contraseñas con hash y bloqueo por intentos fallidos.
- Separación lógica por empresa.
- PostgreSQL persistente y respaldo previo a migraciones.
- Docker Compose con proxy único de acceso.
- Auditoría de operaciones sensibles.
