# Privilegios y separación por empresa y planta

Adaptación de las reglas `security-*` de Supabase para una base PostgreSQL autogestionada.

Dar al rol de la aplicación los permisos que necesita. Distinguir el usuario que aplica migraciones del que atiende solicitudes. No asumir que una conexión con superusuario o propietario verifica correctamente políticas de acceso.

En LATEX, revisar primero cómo el backend aplica identidad, roles, empresa y asignación de plantas. Un filtro recibido del navegador no demuestra permiso. Consultas por identificador, exportaciones, históricos y mutaciones deben aplicar el mismo alcance efectivo.

## RLS cuando corresponda

RLS puede añadir una barrera en la base, pero incorporarlo exige diseñar identidad, roles y conexión. No añadir políticas con `auth.uid()` a este proyecto: esa función pertenece a un contexto de Supabase Auth que no se ha establecido aquí.

Antes de recomendar RLS, comprobar si existe y qué rol ejecuta cada consulta. Los propietarios y roles con privilegios especiales pueden eludir políticas en determinadas condiciones. Probar la política con el rol efectivo de la aplicación y datos de al menos dos ámbitos.

Una variable de sesión que identifica al usuario o planta necesita un mecanismo confiable y limpieza correcta al reutilizar conexiones. Una sesión residual puede mezclar identidades. Si se diseña esta solución, establecer el contexto con alcance transaccional compatible con el pool y verificar que no pueda falsificarse desde la solicitud.

Evaluar `USING` para visibilidad y `WITH CHECK` para escrituras según el comando. Comprobar lectura, inserción, modificación y borrado: que un usuario no pueda ver una fila no demuestra por sí solo que todas las escrituras estén protegidas.

## Rendimiento y funciones

Las columnas consultadas por políticas pueden necesitar índices. Evitar funciones costosas por fila cuando puedan calcularse una vez sin cambiar la semántica. Revisar planes con el rol adecuado.

Las funciones con `SECURITY DEFINER` requieren revisión de propietario, permisos y `search_path`. No usarlas como atajo para evitar una denegación. Mantener separadas operaciones administrativas y acceso normal.

Documentar qué barreras existen en backend y cuáles en base. No afirmar aislamiento por RLS si sólo se inspeccionó un filtro de Prisma.
