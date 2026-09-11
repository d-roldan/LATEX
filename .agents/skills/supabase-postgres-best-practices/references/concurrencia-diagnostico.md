# Conexiones, concurrencia y diagnóstico

Adaptación de las reglas `conn-*`, `lock-*` y `monitor-*` de Supabase.

## Conexiones

Reutilizar el cliente Prisma y su pool conforme al ciclo de vida del backend. Crear un cliente por solicitud puede agotar conexiones. Dimensionar el total teniendo en cuenta réplicas, procesos de pruebas, tareas y reserva operativa, no sólo una instancia.

Medir conexiones activas, ociosas y en transacción. Usar límites y tiempos de espera acordes a las operaciones; `idle_in_transaction_session_timeout` resuelve un problema distinto de limitar una consulta con `statement_timeout`. No imponer valores arbitrarios que cancelen una migración o un reporte válido.

Un pool externo es una opción si hay necesidad demostrada. Verificar versión y modo de PgBouncer u otra herramienta antes de configurar sentencias preparadas: la compatibilidad depende de esa combinación y del cliente. No deshabilitar características globalmente por una regla histórica.

## Transacciones y bloqueos

Mantener dentro de la transacción sólo el trabajo que debe ser atómico. Las llamadas a servicios externos prolongan los bloqueos y no se revierten con rollback. Elegir aislamiento y reintentos según la garantía requerida, sin repetir efectos externos.

Adquirir bloqueos en un orden estable cuando varias operaciones toquen los mismos recursos. Para un trasvase, revisar el orden de origen y destino. Gestionar errores de interbloqueo con reintentos acotados únicamente si la operación completa puede repetirse de forma segura.

Las advisory locks coordinan procesos que cooperan con la misma convención. Preferir alcance transaccional cuando corresponda y documentar la clave; no protegen frente a escrituras que ignoren el protocolo.

`SKIP LOCKED` es útil para repartir trabajo en una cola. No aplicarlo a una consulta operativa que necesita todos los equipos: omitir una fila bloqueada podría mostrar un estado incompleto.

## Medir antes de corregir

Empezar por el SQL real, parámetros representativos y un plan estimado. `EXPLAIN (ANALYZE, BUFFERS)` ejecuta la sentencia y consume recursos. Usarlo sobre consultas adecuadas en un entorno autorizado; no ejecutarlo sobre una mutación sólo para visualizar el plan.

Comparar estimaciones y filas reales, número de bucles, ordenamientos, lecturas y tiempo. Un índice utilizado no prueba por sí solo una mejora. Medir con un volumen representativo y distinguir caché fría de caliente.

`pg_stat_statements` puede ayudar a encontrar consultas frecuentes y costosas si está disponible. Habilitarlo puede requerir configuración y reinicio: no hacerlo como efecto secundario de una revisión. Evitar exponer parámetros o resultados sensibles al compartir métricas.

## Mantenimiento

`ANALYZE` actualiza estadísticas y `VACUUM` trata versiones de filas obsoletas. Revisar autovacuum, transacciones largas y crecimiento antes de ejecutar mantenimiento manual. `VACUUM FULL` reescribe y bloquea la tabla; no es una limpieza rutinaria inocua.

Explicar cada propuesta con la evidencia que la respalda, el coste y la forma de comprobarla. Separar diagnóstico leído, SQL preparado y cambios realmente aplicados.
