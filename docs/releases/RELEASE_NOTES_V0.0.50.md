# LATEX V0.0.50

**Fecha de publicación:** 10 de noviembre de 2026.

[← Historial de versiones](README.md)

## Resumen

Látex permite pausar el envasado de un tanque, utilizar Devree con otro y luego reanudar la OE pendiente. El servidor mantiene un único tanque envasando a la vez. La TV de Envasado deja de mostrar los indicadores estimados de fin de tanque y litros retirados durante el día.

## Nuevas funcionalidades

- **Pausar envasado** cambia el tanque a `ENVASADO_PAUSADO` sin cerrar la OE ni declarar vacío el tanque. **Reanudar envasado** conserva esa misma OE y sólo se permite cuando Devree está libre.
- La pausa y la reanudación quedan registradas como períodos de estado y cambios auditados. La pizarra de Envasado identifica los tanques pausados; el panel, la TV y el Historial muestran el nuevo estado.
- Las rutas operativas de pausa y reanudación requieren rol `ENVASADO` o `ADMIN`, acceso a la planta y la versión vigente del tanque.

## Mejoras y correcciones

- El backend impide que dos tanques de Látex ocupen Devree simultáneamente al iniciar, reanudar o reabrir un envasado por retroceso administrativo. La interfaz informa cuando la línea está ocupada.
- Después de reanudar, la velocidad de Devree sólo se muestra si la lectura se produjo desde el inicio del período activo; no se reutiliza una lectura obtenida mientras se envasaba otro tanque.
- Se retiran de la TV de Látex los indicadores de fin estimado del tanque y litros estimados retirados hoy. Los demás datos de la TV continúan visibles.

## Cambios técnicos

- Se amplía la máquina de estados de `Tank` con `ENVASADO_PAUSADO`. La `PackagingOrder` permanece abierta durante la pausa. La protección de Devree usa un bloqueo transaccional por planta y comprueba el estado vigente antes de ocupar la línea.
- Se actualizan el manual de Envasado, la operación de planta, el modelo de datos y los requisitos para describir el nuevo flujo.

## Base de datos

- La migración `20261110120000_pause_latex_packaging` agrega el valor `ENVASADO_PAUSADO` al enum PostgreSQL `TankState`. No modifica filas existentes ni requiere carga de datos.
- La migración se aplicó y verificó en el Compose **local**. No se aplicó en producción. Antes de actualizar un servidor persistente, seguir el respaldo, ensayo y ventana de `docs/ACTUALIZACION_SERVIDOR.md`.

## Variables de entorno y configuración

Sin cambios.

## Actualización

Tag objetivo: `V0.0.50`. Seguir [ACTUALIZACION_SERVIDOR.md](../ACTUALIZACION_SERVIDOR.md): respaldar y ensayar la migración, aplicarla con escritores controlados y reconstruir **backend y frontend**. Comprobar pausa, ocupación de Devree, reanudación de la misma OE, Historial y TV. No reconstruir ni detener el Node-RED externo desde este Compose.

## Verificaciones realizadas

- `node scripts/check-release-toolchain.mjs`: herramientas alineadas con los lockfiles.
- Prisma: `validate` y `generate` correctos; `migrate status` mostró sólo esta migración pendiente antes de aplicarla y la base local quedó al día después.
- Backend: compilación local y build Docker correctos; 20 suites y 184 pruebas aprobadas. Lint y Prettier de los TypeScript modificados correctos.
- Frontend: comprobación de tipos, lint y Prettier de los archivos modificados correctos; build Docker de producción correcto.
- En el Compose local, backend saludable; la TV y su API de tanques respondieron HTTP 200. Se observó la TV sin los dos indicadores. La ruta de pausa rechazó una solicitud sin sesión con HTTP 401.
- `git diff --check` sin errores de whitespace.

## Limitaciones conocidas

- No se ejecutó una pausa real sobre un tanque operativo durante la validación: las transiciones permitidas y rechazadas se cubrieron con pruebas del servicio. La aplicación registra la maniobra; no controla físicamente la envasadora ni las válvulas.
- La duración de la OE continúa siendo el tiempo transcurrido entre apertura y cierre e incluye las pausas; los períodos activos y pausados se distinguen en el historial.
- Publicar esta versión en GitHub no actualiza el servidor productivo.
