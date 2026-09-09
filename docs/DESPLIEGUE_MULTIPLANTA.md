# Instalación, actualización y recuperación multiplanta

## Datos persistentes

Compose usa `postgres_data` para PostgreSQL y `uploads_data` para adjuntos. En el host de desarrollo inspeccionado el 8/9/2026, los nombres resueltos son `planta-latex_postgres_data` y `planta-latex_uploads_data`; PostgreSQL estaba montado sobre el primero. Node-RED usa el bind mount `infra/node-red/data`; sus credenciales y flujos runtime deben respaldarse por separado y no reemplazarse con un checkout. En cualquier otro host se deben volver a obtener los nombres con `docker volume ls` y `docker volume inspect`; no cambiar uno sin copiar y verificar los datos.

## Instalación nueva

1. Completar `.env` y fijar tags/digests revisados de las imágenes.
2. En una base comprobablemente vacía ejecutar desde la imagen backend `npm run prisma:install-empty`. Este comando rechaza bases con tablas, materializa el esquema vigente, valida y sólo entonces registra la cadena histórica como baseline. Después, `prisma migrate deploy` debe informar que no hay migraciones pendientes.
3. Ejecutar el bootstrap/seed sólo en una instalación vacía y luego crear accesos explícitos. Los scripts demo no forman parte del arranque normal.
4. Iniciar con `docker compose up -d` y verificar cuatro plantas, 9/4/2/2 equipos y ausencia de integraciones nuevas habilitadas.

## Actualización de una base existente

1. Programar ventana de mantenimiento: clientes anteriores no conocen `TRASVASANDO`.
2. Hacer `pg_dump -Fc` a un directorio fuera del contenedor y copiarlo fuera del host. Respaldar adjuntos, `.env` seguro y runtime Node-RED.
3. Restaurar primero el dump en una base aislada y verificar consultas, IDs, lotes activos, historiales, ajustes, rechazos, servicios y cierres.
4. Auditar `_prisma_migrations`. Las migraciones históricas del repositorio no son una cadena inicial completa: para una base creada con `db push`, comparar su esquema y resolver como baseline sólo las migraciones cuyo resultado ya existe. Nunca usar `migrate resolve --applied` sin esa comparación.
5. Detener escrituras, desplegar la imagen identificada y ejecutar una sola vez `disal-migrate` (`prisma migrate deploy`). No ejecutar seeds.
6. Comparar inventario pre/post, iniciar servicios y ejecutar smoke tests por planta.

## Restauración ensayable

Crear una base aislada, ejecutar `pg_restore --clean --if-exists --no-owner`, iniciar la misma versión de aplicación y verificar relaciones e IDs, no sólo que el archivo sea no vacío. Registrar duración, checksum del backup, versión de imagen y resultado. Volver sólo la imagen es válido únicamente si entiende el esquema nuevo; si hubo escrituras posteriores al backup, restaurar exige decidir explícitamente cómo conciliarlas.

Quedan prohibidos en el procedimiento normal `docker compose down -v`, borrar volúmenes, `prisma migrate reset`, `db push --accept-data-loss` y seeds/demo. La recreación permitida es `docker compose up -d --force-recreate` conservando los volúmenes.
