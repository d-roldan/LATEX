# Datos, errores, permisos y operación

Adaptación de las categorías de datos, seguridad, pruebas, rendimiento y despliegue de Kadajett. Los ejemplos originales de TypeORM se sustituyen por criterios aplicables a Prisma; no se presume equivalencia entre ambas APIs.

## Transacciones y concurrencia

Cuando varias escrituras deben aceptarse juntas, usar el mecanismo transaccional de Prisma existente. Todas las escrituras de la operación deben usar el cliente recibido por la transacción; una llamada al cliente global queda fuera de ella.

En LATEX, revisar que transición, versión e historial se actualicen de forma coherente. La lectura inicial de un estado no impide que otro usuario lo modifique antes de guardar. Mantener la condición de versión o bloqueo del código vigente y comprobar conflictos.

Para trasvases, verificar origen y destino juntos y un orden estable al bloquear recursos. Mantener transacciones cortas. Evitar llamadas HTTP, correo o procesos externos dentro de ellas: el rollback de PostgreSQL no revierte esos efectos.

Seleccionar los campos necesarios, paginar listas y evitar consultas por cada elemento dentro de bucles. Usar relaciones o consultas agrupadas según soporte de Prisma 5.22 y medir el SQL resultante. Seguir `../supabase-postgres-best-practices/SKILL.md` para índices y planes; las migraciones se coordinan con `../db-check/SKILL.md`.

## Permisos y validación

Confirmar identidad antes de autorizar. Verificar pertenencia del recurso a la planta y empresa permitidas además del rol. La ausencia de decorador a nivel de método no implica ausencia de guard: revisar clase y configuración global.

Validar las lecturas de Node-RED conforme al contrato por planta, límites de lote, valores finitos y equipos habilitados. No reutilizar credenciales de una planta para otra ni registrar claves recibidas.

Proteger JWT y configuración en el servidor, respetar su expiración y revisar la validación efectiva. Configurar límites de solicitudes acordes al tráfico: el ingreso periódico de pesos tiene un patrón distinto del login. No introducir un límite global que interrumpa la operación normal.

El JSON de una API no se ejecuta por sí mismo como HTML. Evaluar XSS donde el contenido se renderiza o interpreta; no alterar indiscriminadamente descripciones del negocio con un saneador que no corresponde a su contexto.

## Errores y efectos asíncronos

Usar excepciones HTTP conocidas o errores de dominio convertidos de forma consistente. No devolver un objeto con un mensaje de error y HTTP 200 para una operación fallida. Mantener el tratamiento existente de conflictos y denegaciones.

Los handlers HTTP asíncronos y las tareas lanzadas sin espera tienen distintas rutas de error. Esperar operaciones necesarias y gestionar rechazos de procesos en segundo plano. No silenciar excepciones ni instalar un manejador global que mantenga un proceso corrupto sin diagnóstico.

Los filtros deben ocultar credenciales, consultas sensibles y trazas internas al cliente, conservando suficiente contexto en logs protegidos. Registrar identificador de operación y contexto mínimo útil; no cuerpos completos por defecto.

## Rendimiento y ciclo de vida

Medir antes de añadir caché. Si se cachean datos de usuario o planta, la clave y la invalidación deben incluir su alcance. No reutilizar resultados autorizados para otro usuario. Diferenciar telemetría efímera de datos históricos persistidos.

Validar configuración al arrancar y esperar las inicializaciones imprescindibles. Gestionar cierre de conexiones y tareas al apagar Docker. Distinguir disponibilidad del proceso de capacidad para responder con sus dependencias.

La carga diferida, colas y patrones de microservicios son opciones cuando un problema demostrado los necesita. No instalar esos componentes como requisito de buenas prácticas.

## Pruebas

Usar `@nestjs/testing` cuando se necesite verificar el ensamblado de proveedores; probar funciones o clases puras directamente cuando sea suficiente. Aislar servicios externos en pruebas unitarias y comprobar errores, tiempos de espera y respuestas incompatibles.

Una prueba HTTP de integración debe incluir guards, pipes y persistencia relevante. Utilizar las herramientas ya instaladas; Supertest es una opción si se decide incorporarlo, no una dependencia supuesta. Cerrar la aplicación y conexiones al terminar. Priorizar casos que prueben denegación, conflicto y rollback de la operación afectada.
