# DISAL Planta de Látex · V0.0.16

Fecha: 3 de septiembre de 2026.

## Resumen

Esta versión incorpora notificaciones operativas entre Fabricación, Laboratorio y Envasado. Cada traspaso accionable informa al sector responsable, permite identificar el tanque desde la notificación y utiliza una señal sonora configurable. También incorpora una pantalla pública de monitoreo para televisores.

## Notificaciones por sector

- Fabricación avisa a Laboratorio cuando un tanque queda disponible para analizar.
- Laboratorio avisa a Envasado cuando un tanque es aprobado.
- Laboratorio avisa a Fabricación cuando un tanque requiere ajuste o fue rechazado.
- Envasado avisa a Fabricación cuando un tanque queda vacío y disponible para una nueva fabricación.
- Las notificaciones se crean dentro de la misma transacción que modifica el tanque.
- Al abrir una notificación se navega al panel correspondiente, se centra el tanque y se activa un parpadeo visible.
- Cada aviso puede marcarse individualmente como leído y existe una acción para marcar todos los avisos visibles.

## Sonido y preferencias

- Aviso sonoro automático para notificaciones recibidas mientras la aplicación está abierta.
- Selector con cinco tonos: Campana, Suave, Digital, Industrial y Urgente.
- Reproducción de vista previa al elegir un sonido.
- Controles para silenciar o reactivar los avisos.
- Persistencia local del tono elegido y del estado del sonido.

## Visibilidad y permisos

- Los usuarios `FABRICACION`, `LABORATORIO` y `ENVASADO` sólo reciben y consultan notificaciones destinadas a su propio sector.
- Los perfiles sectoriales no muestran controles para cambiar de filtro.
- El usuario `ADMIN` recibe notificaciones de los tres sectores y dispone de los filtros Todos, Fabricación, Laboratorio y Envasado.
- El usuario que ejecuta una transición no recibe una notificación duplicada de su propia acción.
- La separación por sector se valida tanto en frontend como en backend.

## Pantalla de planta

- Nueva vista pública de sólo lectura en `/tv`, preparada para televisores y modo pantalla completa.
- `/monitoreo` redirige a la nueva pantalla pública.
- La respuesta pública omite identificadores internos, versión de concurrencia y claves de balanza.
- Ajustes visuales para resoluciones HD y Full HD, incluyendo medidor de capacidad y datos de lote/envasado.

## Base de datos

- Nuevo tipo `TANK_ACTION_REQUIRED` para notificaciones operativas.
- Nuevos campos `tankId` y `targetSector` en `Notification`.
- Índice por empresa, sector y fecha de creación.
- Migración idempotente incluida en `20260903190000_add_plant_notifications`.

## Verificación

- Backend y frontend compilados para producción.
- 27 pruebas automatizadas aprobadas.
- Consulta autenticada del endpoint de notificaciones verificada.
- Migración aplicada sobre PostgreSQL local.
- Backend y frontend reconstruidos y desplegados con Docker Compose.
- API y frontend respondiendo correctamente en `http://localhost:8081`.

## Consideraciones de actualización

- Ejecutar la migración incluida antes de iniciar esta versión en otro entorno.
- El audio web se habilita con la primera interacción del usuario; el inicio de sesión cumple esta condición.
- Los avisos pendientes creados antes de un cambio de rol dejan de ser visibles si no pertenecen al sector actual del usuario.
- No se generan notificaciones retroactivas por transiciones anteriores a esta versión.
