# DISAL Planta de Látex · V0.0.23

Fecha: 17 de septiembre de 2026.

## Resumen

Esta versión mejora las tarjetas y los flujos operativos de Fabricación, Laboratorio y Envasado. Distingue el SEMI fabricado del material utilizado en Envasado, corrige la visualización del nivel de los tanques, formaliza los motivos de fuera de servicio y amplía las solicitudes de ajuste de Laboratorio con múltiples motivos, materiales, cantidades y edición posterior.

## Fabricación y Envasado

- El campo que Fabricación registraba como material pasa a mostrarse como `SEMI`.
- Durante el envasado, la tarjeta muestra simultáneamente el número de SEMI informado por Fabricación y el número de Material informado por Envasado.
- La orden de envasado acepta exactamente 6 u 8 dígitos.
- El Material de Envasado acepta exactamente 4 o 5 dígitos.
- Las mismas reglas se aplican al inicio, a una nueva OE y a la corrección de la OE activa, tanto en frontend como en backend.

## Indicador de nivel

- La escala cromática del tanque permanece fija: rojo en la zona inferior, amarillo en la zona media y verde en la superior.
- El nivel visible sube o baja recortando esa escala, sin comprimir ni desplazar los colores.
- Se agregó una transición suave entre colores y se respeta la preferencia del sistema para reducir movimiento.

## Fuera de servicio

- El motivo obligatorio se limita a `Mantenimiento` o `Lavado`.
- Las observaciones permanecen como texto libre opcional, con un máximo de 500 caracteres.
- El backend rechaza cualquier motivo distinto de los dos valores permitidos.

## Solicitudes de ajuste de Laboratorio

- Laboratorio puede seleccionar uno o más motivos de ajuste mediante casillas.
- Cada solicitud admite uno o más materiales, con número de material y cantidad positiva en kilogramos de hasta tres decimales.
- Se pueden agregar o quitar renglones antes de enviar la solicitud.
- La tarjeta de Fabricación muestra los motivos vigentes y la lista completa de materiales y cantidades mientras el tanque está en `AJUSTE`.
- Los ajustes creados antes de esta versión conservan visible su motivo anterior.
- Fabricación recibe una notificación al generarse la solicitud.

## Corrección de ajustes

- Mientras el tanque continúa en `AJUSTE`, Laboratorio dispone de la acción `Editar ajuste`.
- La acción abre un diálogo con motivos, materiales y cantidades ya precargados.
- La corrección reemplaza la información de la solicitud vigente; no crea una segunda decisión ni cambia el estado del tanque.
- La operación está autorizada únicamente para `LABORATORIO` y `ADMIN`, vuelve a comprobar el acceso a empresa y planta y exige que el tanque siga en `AJUSTE`.
- La versión del tanque se incrementa de forma atómica para evitar que una edición se cruce con la devolución a Laboratorio realizada por Fabricación.
- Cada corrección queda registrada en auditoría y genera una nueva notificación para Fabricación.

## Base de datos y compatibilidad

- Se incorpora `QualityAdjustmentItem` para persistir cada material, su posición y la cantidad en kilogramos vinculada a la decisión de calidad.
- `QualityDecision.adjustmentReasons` conserva la selección múltiple de motivos.
- Las migraciones son aditivas, mantienen los registros existentes y eliminan los renglones asociados sólo cuando se elimina su decisión de calidad.
- El texto consolidado del motivo se conserva en el campo histórico anterior para mantener compatibilidad con estados, auditorías y notificaciones existentes.
- En una actualización de otro entorno se deben aplicar, en orden, las migraciones `20260917090000_add_quality_adjustment_items` y `20260917100000_add_quality_adjustment_reasons` mediante `prisma migrate deploy`. No se requieren seeds ni resets.

## Verificación realizada

- El schema Prisma fue validado y el cliente Prisma se regeneró correctamente.
- El backend compiló correctamente.
- Se aprobaron 52 pruebas automatizadas distribuidas en 9 suites.
- TypeScript del frontend finalizó sin errores.
- Backend y frontend compilaron desde imágenes Docker con instalación limpia de dependencias.
- El backend quedó saludable y la aplicación y `/api/auth/status` respondieron HTTP 200 mediante `http://localhost:8081`.
- Se verificó en los logs que las rutas de creación y edición de ajustes quedaron registradas.
- Las migraciones se aplicaron correctamente en el Docker local sin reinicializar ni sembrar la base.

## Consideraciones

- No se ejecutó un E2E que modificara tanques de la base operativa local; la transición y la corrección se cubrieron con validación de tipos y pruebas unitarias enfocadas.
- El build local de Vite fuera de Docker continúa afectado por una dependencia incompleta del entorno de desarrollo (`@alloc/quick-lru`); el build limpio dentro de Docker finalizó correctamente.
- El lint y el chequeo global de Prettier siguen informando deuda previa, principalmente finales de línea CRLF y formato histórico. El lint funcional limitado a los archivos modificados no detectó errores distintos de formato.
- La actualización verificada corresponde al Docker local; aplicar las migraciones y verificaciones operativas antes de promoverla a otro entorno.
