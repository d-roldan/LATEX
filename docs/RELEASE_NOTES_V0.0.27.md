# DISAL Planta de Látex · V0.0.27

Fecha: 18 de septiembre de 2026.

## Resumen

Esta versión incorpora una pantalla integral de Auditoría para centralizar el seguimiento de accesos, actividad de usuarios, cambios administrativos y movimientos operativos de planta. La información queda disponible exclusivamente para el Super Usuario y combina los registros transversales del software con la trazabilidad industrial existente.

## Acceso y autorización

- Se agregó la opción `Auditoría` al menú únicamente cuando la sesión pertenece al Super Usuario del sistema.
- La ruta del frontend requiere explícitamente `isSystemOwner`; un administrador común es redirigido fuera de la pantalla.
- La API aplica la misma comprobación en el servidor y devuelve HTTP 403 a cualquier usuario que no sea Super Usuario, aunque tenga perfil `ADMIN`.
- El endpoint histórico anterior de auditoría también queda restringido al Super Usuario para evitar accesos alternativos.

## Seguimiento de usuarios

- La pantalla informa el último ingreso correcto de cada usuario y la cantidad de días transcurridos desde ese acceso.
- Identifica usuarios que nunca ingresaron, usuarios sin actividad durante 30 días, cuentas deshabilitadas y bloqueos temporales vigentes.
- Muestra la cantidad histórica de accesos correctos, el último movimiento realizado y los intentos fallidos pendientes de cada cuenta.
- Los accesos exitosos, intentos fallidos, rechazos por cuenta bloqueada y bloqueos por exceso de intentos quedan identificados explícitamente en la bitácora.

## Tablero de auditoría

- Se incorporaron indicadores de usuarios activos, falta de ingreso reciente, alertas de seguridad y movimientos del período.
- Un gráfico resume el volumen de actividad diaria de los últimos 14 días seleccionados.
- La bitácora unifica eventos generales del sistema y movimientos operativos de planta, ordenados cronológicamente.
- Cada movimiento informa responsable, fecha, acción, elemento afectado y contexto de planta, tanque u orden de fabricación cuando corresponde.
- Los registros con información adicional permiten desplegar motivo, valores anteriores, valores posteriores y metadatos.

## Filtros y navegación

- La actividad puede filtrarse por rango de fechas, origen, tipo de movimiento, responsable y planta.
- La búsqueda textual contempla órdenes de fabricación, tanques, personas, identificadores y motivos.
- La tabla dispone de paginación configurable en 25, 50 o 100 movimientos.
- La actividad de usuarios puede filtrarse por nombre, cuenta, perfil y situación de acceso.
- La pantalla se adapta a escritorio, tablet y móvil; las tablas conservan desplazamiento propio cuando el ancho es reducido.

## Seguridad de la información

- Antes de responder a la interfaz se ocultan recursivamente campos que puedan contener contraseñas, hashes, tokens, secretos, autorizaciones o claves de integración.
- La auditoría se limita a la empresa de la sesión autenticada.
- No se incorporan migraciones ni tablas nuevas: la funcionalidad aprovecha `AuditLog` y `PlantAuditLog` existentes.

## Verificación realizada

- El backend y el frontend compilaron correctamente tanto en el entorno local como durante la construcción de sus imágenes Docker.
- Se aprobaron 61 pruebas automatizadas distribuidas en 12 suites.
- Se agregaron pruebas específicas para denegar la auditoría a un administrador común, autorizar al Super Usuario y registrar accesos correctos y fallidos.
- La integración local respondió HTTP 200 para el Super Usuario y HTTP 403 para un administrador común.
- La pantalla se verificó visualmente con datos reales a 1440 px, sin desborde horizontal del documento.
- Los contenedores de backend y frontend quedaron actualizados; el backend permaneció saludable y la aplicación respondió HTTP 200 mediante `http://localhost:8081/`.

## Consideraciones

- El lint y el formato enfocados en los archivos de esta actualización finalizaron correctamente.
- Los chequeos globales continúan informando deuda histórica de formato y finales de línea CRLF en archivos no pertenecientes a esta entrega.
