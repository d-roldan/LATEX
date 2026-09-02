# Manual del Operario

**Versión documentada:** V0.0.13

**Actualización:** 1 de agosto de 2026

## Objetivo del rol

El Operario utiliza **Mi Producción** para ejecutar únicamente las etapas que tiene asignadas, registrar consumos y observaciones, y mantener actualizado el estado real del trabajo.

## Ingreso y seguridad

1. Abrir la dirección de la aplicación entregada por el responsable.
2. Ingresar con el usuario asignado.
3. Confirmar que la pantalla inicial sea **Mis etapas asignadas**.
4. Cambiar la contraseña desde el menú de usuario si todavía utiliza una clave inicial.

No compartir la cuenta ni trabajar con el usuario de otra persona. Todos los eventos quedan registrados con el usuario autenticado.

## Uso desde computadora, tablet o celular

- La pantalla se adapta al tamaño disponible.
- En tablet y celular, el menú se abre desde el botón superior.
- Las tarjetas se ordenan en una columna cuando el ancho es reducido.
- Las ventanas de comentarios, confirmación y adjuntos permiten desplazamiento táctil.
- Las imágenes admiten zoom y desplazamiento.

## Notificaciones

La campana superior puede informar:

- una nueva etapa asignada;
- una etapa completada que habilita trabajo posterior;
- un control de calidad rechazado que requiere retrabajo.

El contador muestra notificaciones no leídas. Al seleccionar una notificación, la aplicación abre Mi Producción y resalta la etapa relacionada cuando corresponde.

## Mis etapas asignadas

La terminal muestra solamente etapas asociadas al operario autenticado. Cada tarjeta informa:

- código y nombre de la orden;
- cliente y modelo de casilla;
- etapa asignada;
- estado y avance global;
- dependencias pendientes;
- responsables;
- adjuntos disponibles;
- consumos registrados en esa etapa.

La pantalla separa **Trabajo disponible y en curso** de **Etapas completadas**. El buscador permite localizar una orden o trabajo dentro de las asignaciones visibles.

## Estados de etapa

| Estado | Significado | Acción |
|---|---|---|
| BLOQUEADA | Tiene dependencias pendientes | Esperar y revisar qué falta |
| DISPONIBLE | Puede comenzar | Verificar datos e iniciar |
| EN_PROCESO | Trabajo activo | Continuar, pausar o completar |
| PAUSADA | Trabajo detenido temporalmente | Reanudar cuando se resuelva el motivo |
| COMPLETADA | Etapa terminada | Consultar historial; no reiniciar |
| RETRABAJO | Requiere corrección | Revisar observación e iniciar corrección |
| CANCELADA | No continúa | No realizar trabajo |

## Regla de una etapa activa

Un operario puede estar asignado a varias órdenes, pero solo puede mantener una etapa con trabajo activo al mismo tiempo.

Si intenta iniciar otra mientras ya tiene una etapa `EN_PROCESO`, la aplicación muestra cuál está activa. Debe regresar a esa etapa para pausarla o completarla antes de comenzar una nueva.

## Antes de iniciar

1. Verificar el código y nombre de la casilla.
2. Confirmar que la etapa sea la correcta.
3. Leer descripción, comentarios y notas.
4. Revisar adjuntos, planos e imágenes.
5. Confirmar materiales, herramientas y condiciones de seguridad.
6. Comprobar que el estado sea Disponible o Retrabajo.
7. Seleccionar **Iniciar etapa**.

No iniciar una tarea solamente para quitarla de la lista. El estado debe reflejar trabajo real.

## Pausar

Seleccionar **Pausar** cuando el trabajo se interrumpa. Registrar un motivo claro, por ejemplo:

- espera de material;
- ajuste o falla de herramienta;
- prioridad indicada por el Supervisor;
- problema de equipo;
- consulta técnica;
- condición insegura.

Una etapa pausada deja de considerarse trabajo activo hasta su reanudación.

## Reanudar

Cuando se resuelva el motivo de la pausa:

1. Abrir la tarjeta correcta.
2. Confirmar que puede continuarse.
3. Seleccionar **Reanudar**.

La aplicación conserva las sesiones anteriores y crea continuidad en el historial.

## Completar

Antes de seleccionar **Completar**:

- comprobar el resultado;
- cargar consumos pendientes;
- agregar comentarios u observaciones necesarias;
- confirmar que no falte evidencia;
- revisar que la orden y etapa sean correctas.

La aplicación solicita confirmación y permite registrar una nota final. Completar una etapa recalcula el avance y puede habilitar sucesoras.

Completar una etapa no finaliza toda la casilla. Armado Final solo se habilita al terminar Chasis, Piso, Paredes, Techo, Aberturas, Eléctrica, Sanitaria y Pintura.

## Retrabajo

Si Control de Calidad rechaza una etapa:

1. Revisar la notificación y el comentario recibido.
2. Confirmar cuál es la etapa reabierta.
3. Leer las observaciones de calidad.
4. Iniciar la etapa en estado Retrabajo.
5. Registrar consumos y comentarios de la corrección.
6. Completarla nuevamente cuando esté verificada.

No corregir otra etapa distinta de la indicada sin confirmación del Supervisor.

## Comentarios de etapa

El botón de comentarios permite leer la conversación de una etapa y agregar información operativa.

Puede:

- crear comentarios;
- editar sus propios comentarios;
- eliminar sus propios comentarios;
- leer comentarios de otros participantes.

Usar comentarios para medidas, cambios acordados, problemas detectados, materiales alternativos o tareas pendientes. No incluir contraseñas ni información ajena al trabajo.

## Registrar materiales

En cada etapa se puede seleccionar un material, ingresar cantidad y agregar una nota.

Antes de registrar:

1. Confirmar material y unidad.
2. Medir la cantidad real.
3. Verificar que corresponda a esa etapa y casilla.
4. Seleccionar **Registrar consumo**.

La tarjeta muestra los consumos registrados en la etapa. Si hay un error, informar al Supervisor o corregirlo solamente cuando la interfaz y los permisos lo permitan.

No cargar valores aproximados cuando sea posible medir la cantidad real.

## Adjuntos

El Operario ve únicamente adjuntos habilitados para operadores. Los documentos marcados como internos no aparecen en Mi Producción.

- Las imágenes permiten ampliar, reducir y desplazar.
- Los PDF se muestran en un visor embebido.
- Otros archivos permitidos pueden abrirse según las capacidades del navegador.

Si un plano no abre, parece desactualizado o contradice una indicación, detener el trabajo e informar al Supervisor.

## Qué no puede hacer el Operario

- No accede al Tablero ejecutivo ni a Producción del Supervisor.
- No administra clientes, órdenes completas, recursos, materiales o usuarios.
- No consulta Reportes, Auditoría, Calendario ni Copiloto IA.
- No ve adjuntos internos.
- No modifica etapas que no estén asignadas a su usuario.

## Buenas prácticas

- Registrar inicio, pausa, reanudación y finalización en el momento real.
- Mantener una sola etapa activa.
- Verificar siempre el código antes de consumir materiales.
- Leer comentarios y adjuntos antes de comenzar.
- Explicar con claridad pausas y retrabajos.
- Informar inconsistencias al Supervisor.
- Cerrar sesión en equipos compartidos.

## Si algo no funciona

- Actualizar la pantalla y comprobar la conexión.
- Revisar la campana de notificaciones.
- Confirmar que la etapa siga asignada al usuario correcto.
- Si está bloqueada, revisar dependencias en la tarjeta.
- Si no puede iniciar, comprobar que no exista otra etapa activa.
- Si el problema continúa, informar código de OP, nombre de etapa y mensaje mostrado al Supervisor.
