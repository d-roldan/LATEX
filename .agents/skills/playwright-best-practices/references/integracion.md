# Integración, sesiones y separación de datos

Adaptación de las referencias de Currents sobre autenticación, múltiples contextos, interceptación de red, pruebas de API y reloj.

## Autenticación y permisos

Usar una cuenta de pruebas por rol o por trabajador cuando las pruebas muten datos compartidos. El estado de sesión guardado mediante `storageState` contiene credenciales o tokens: almacenarlo en una carpeta ignorada, como `output/` de la raíz, y no adjuntarlo a informes públicos.

Crear contextos independientes para simular dos usuarios; dos pestañas en el mismo contexto comparten sesión. Configurar autenticación de la API conforme al mecanismo real: un token en almacenamiento web no se añade por sí solo a un `APIRequestContext`.

Verificar acceso permitido y denegado en la API además de visibilidad de controles. No dar por protegida una operación sólo porque no aparece en pantalla. Para LATEX, comprobar que un usuario asignado a una planta no obtiene datos o modifica equipos de otra al cambiar la URL o el identificador del recurso.

## Concurrencia y operaciones

En una transición que use control por versión, preparar dos clientes sobre la misma versión. Comprobar que el segundo cambio incompatible se rechaza y que queda un estado e historial coherentes. Obtener el contrato exacto del backend; no inventar códigos HTTP o campos.

Para Slurry verificar origen y destino del trasvase según las reglas existentes. Evitar compartir el mismo equipo entre pruebas paralelas. Reducir trabajadores si los datos no se pueden aislar todavía y documentar esa limitación.

## Red y telemetría

Registrar `page.route` antes de navegar o disparar la solicitud interceptada. Acotar las rutas simuladas para no ocultar errores de autenticación o endpoints distintos. Dejar pasar solicitudes ajenas al caso.

Las simulaciones de red prueban estados de interfaz; una respuesta simulada no demuestra que Node-RED, el backend y la base estén integrados. Mantener al menos una prueba de integración real en un entorno de pruebas cuando se modifique ese contrato.

Probar lecturas válidas, inválidas, pérdida de señal y recuperación. Comprobar unidades y planta del equipo. No asumir WebSocket: inspeccionar si el transporte real es HTTP periódico, eventos o sockets y usar la técnica correspondiente.

Para errores de conexión simular la respuesta fallida o abortar la petición concreta. Verificar que la interfaz distingue falta de señal, dato anterior y valor cero. Confirmar que un error no dispara reintentos infinitos ni notificaciones duplicadas.

Usar un reloj controlado cuando la versión instalada lo soporte y el escenario dependa de vencimientos. Modificar el reloj del navegador no modifica el del servidor: para caducidad en backend preparar datos o un reloj de pruebas del servicio, sin cambiar la hora del equipo.

## Archivos y servicios externos

Para descargar, crear la espera de `download` antes del clic y comprobar nombre, contenido y tipo del archivo. Para subir, usar archivos de prueba locales y verificar el resultado de la API además del texto del formulario.

Simular fallos de servicios ajenos cuando corresponda. Las pruebas unitarias y de interfaz aislada no deben depender de terceros reales. Declarar en el informe cuáles integraciones fueron simuladas.
