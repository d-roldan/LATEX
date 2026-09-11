# Esquema y migraciones

Adaptación de las reglas `schema-*` de Supabase, preservando el esquema vigente de Prisma.

## Tipos y restricciones

Elegir tipos que expresen el dato. En cantidades que requieren precisión decimal, evaluar `numeric` y la representación `Decimal` de Prisma; no convertir automáticamente a coma flotante en JavaScript. Considerar unidades, rango y redondeo de pesos. Mantener consistencia con el contrato existente.

Definir cuándo una fecha representa un instante y cuándo una fecha civil; comprobar zona horaria en base, servidor y presentación. No migrar tipos temporales existentes sin revisar cómo se almacenaron los datos.

Usar restricciones de unicidad, claves externas y `CHECK` para invariantes que deban cumplirse aun con escrituras concurrentes. Los validadores del DTO no sustituyen la garantía de la base. Confirmar soporte de la expresión y de Prisma antes de editar el esquema.

PostgreSQL no crea automáticamente índices en las columnas que referencian una clave externa. Evaluar índices cuando las uniones o borrados relacionados lo necesiten. No duplicar índices ya cubiertos por otras claves.

## Claves e identificadores

La estrategia de clave afecta a compatibilidad, tamaño y escrituras. Preservar los identificadores existentes; no sustituir UUID, CUID o secuencias por una preferencia externa. Un identificador difícil de adivinar no concede autorización.

En SQL nuevo los nombres simples en minúsculas facilitan interoperabilidad. LATEX puede tener nombres entrecomillados generados por Prisma: usar su nombre exacto y respetar `@map`/`@@map` cuando existan. No renombrar tablas para cumplir una convención de la guía.

## Aplicar cambios de forma compatible

Leer la documentación de despliegue. Separar agregar estructura, rellenar datos y endurecer restricciones si una operación única causaría bloqueo o incompatibilidad. Revisar el efecto sobre lectores y escritores de la versión anterior.

PostgreSQL no admite `ADD CONSTRAINT IF NOT EXISTS`. Para scripts que necesiten comprobación previa, usar los mecanismos reales del catálogo o una migración versionada que se ejecute una sola vez. Confirmar nombre, tabla y definición; que exista una restricción con el mismo nombre no demuestra que sea la correcta.

Para claves externas o comprobaciones sobre tablas grandes, evaluar `NOT VALID` y validación posterior donde estén soportados. `CREATE INDEX CONCURRENTLY` tiene requisitos propios y no puede ejecutarse dentro de un bloque transaccional normal; revisar la herramienta de migración y la recuperación de índices inválidos.

No modificar migraciones ya aplicadas para ocultar divergencias. Una instalación vacía y una actualización de datos existentes tienen procedimientos distintos en LATEX. Probar ambos únicamente cuando el cambio de esquema lo requiera.

## Particionado e importaciones

Considerar particionado para tablas históricas grandes con un patrón claro de retención y filtrado. Evaluar poda de particiones, claves, mantenimiento e índices. No añadirlo a tablas pequeñas como medida preventiva.

Una restauración o importación debe identificar destino, formato, roles y compatibilidad. No asumir que un dump es inocuo ni restaurarlo sobre la base activa para probar una idea. Usar el procedimiento del proyecto y un entorno compatible con la solicitud.
