# Manual del Supervisor

**Versión documentada:** V0.0.13

**Actualización:** 1 de agosto de 2026

## Objetivo del rol

El Supervisor organiza el trabajo diario, controla el avance de las casillas, mantiene actualizadas las asignaciones y atiende excepciones de producción, materiales, calidad y entrega.

## Acceso

Ingresar con una cuenta de rol `SUPERVISOR`. Este perfil puede utilizar:

- Tablero;
- Producción;
- Clientes;
- Órdenes de Producción;
- Recursos;
- Materiales;
- Reportes;
- Copiloto IA;
- Calendario.

No tiene acceso a Usuarios, Auditoría ni Mi Producción. Esta última es exclusiva del Operario.

## Uso desde computadora, tablet o celular

- En computadora, el menú lateral puede contraerse.
- En tablet y celular, se abre desde el botón superior y aparece como lista vertical.
- Formularios, tarjetas y ventanas emergentes se ajustan al ancho disponible.
- Los popups extensos permiten desplazamiento con mouse, trackpad o gesto táctil.
- La campana de notificaciones y sus opciones permanecen dentro de la pantalla.

## Rutina recomendada

1. Revisar notificaciones y alertas del Tablero.
2. Abrir Producción y comprobar quién está trabajando.
3. Identificar operarios con tareas disponibles que no iniciaron ninguna.
4. Revisar etapas pausadas, bloqueadas o sin responsable.
5. Atender controles de calidad pendientes.
6. Verificar compromisos, atrasos y prioridades.
7. Confirmar asignaciones, consumos y stock.
8. Cerrar trabajos terminados y preparar entregas.

## Notificaciones

La campana superior puede informar:

- nuevas etapas asignadas;
- etapas completadas;
- controles de calidad pendientes;
- controles rechazados y enviados a retrabajo.

El número sobre la campana representa notificaciones no leídas. Al seleccionar una notificación, la aplicación abre el registro relacionado y resalta la orden o etapa cuando corresponde. Las notificaciones también pueden marcarse todas como leídas.

## Tablero

El Tablero resume producción, cumplimiento, carga, horas, costos y alertas. Utilizar los filtros de período para comparar resultados y la franja de atención operativa para localizar pausas, bloqueos, atrasos y trabajos sin responsable.

Los costos reales representan principalmente materiales consumidos. No incluyen necesariamente mano de obra, impuestos, logística ni gastos generales.

## Producción

La pantalla Producción es el centro de control operativo y se actualiza automáticamente cada 30 segundos.

### Indicadores superiores

Los indicadores aparecen antes del Mapa operativo de casillas:

- **En proceso:** cantidad de etapas realmente activas.
- **Pausadas:** órdenes globalmente pausadas.
- **Atrasadas:** órdenes abiertas con fecha de compromiso vencida.
- **Operarios sin asignación de trabajo:** operarios que no tienen tareas accionables.

### Popup En proceso

El indicador **En proceso** funciona como botón. Su popup está organizado por operario y muestra:

- nombre del trabajador;
- etapa exacta que está ejecutando;
- código y nombre de la OP;
- modelo de casilla y cliente;
- cantidad de asignaciones activas;
- etapas en proceso sin responsable.

Más abajo, una sección ámbar identifica operarios que no ejecutan ninguna etapa pero tienen trabajo asignado y no bloqueado. Para cada uno informa las etapas:

- listas para iniciar;
- pausadas;
- pendientes de retrabajo.

Esta diferencia es importante:

- **Operario trabajando:** tiene al menos una etapa `EN_PROCESO`.
- **Operario esperando iniciar:** no tiene ninguna etapa `EN_PROCESO`, pero sí una asignación `DISPONIBLE`, `PAUSADA` o `RETRABAJO`.
- **Operario sin asignación de trabajo:** no tiene tareas accionables asociadas.

El popup utiliza un único desplazamiento. El encabezado y el botón de cierre permanecen accesibles mientras se recorre el contenido.

### Mapa operativo de casillas

Cada tarjeta muestra:

- código, título, modelo y cliente;
- porcentaje global de avance;
- etapas activas, pausadas o en retrabajo;
- responsables actuales;
- cantidad de etapas bloqueadas por dependencias.

Una casilla puede tener varias etapas activas al mismo tiempo. El estado global de la orden sirve para clasificarla, pero la fuente operativa es cada etapa.

### Seguimiento histórico

Cada tarjeta funciona como botón. Al abrirla se puede consultar:

- quién creó la orden;
- quién realizó cada asignación;
- quién inició, pausó, reanudó o completó una etapa;
- sesiones de trabajo;
- motivos de pausa y observaciones;
- materiales consumidos;
- avance y estado de todas las etapas.

### Atención operativa y cola

La pantalla también presenta:

- etapas pausadas;
- bloqueos con responsables;
- etapas disponibles o en retrabajo sin responsable;
- operarios con trabajo pendiente de iniciar;
- próximas órdenes ordenadas por prioridad;
- órdenes atrasadas y días de demora.

## Control de calidad

Cuando Control de Calidad queda disponible, aparece una tarjeta destacada.

### Aprobar

1. Seleccionar **Revisar control de calidad**.
2. Elegir una calificación de 1 a 5.
3. Agregar una observación si es necesaria.
4. Confirmar la aprobación.

### Rechazar y enviar a retrabajo

1. Cambiar a la opción de rechazo.
2. Seleccionar la etapa que debe corregirse.
3. Escribir una observación clara.
4. Confirmar el rechazo.

El sistema reabre la etapa elegida, ajusta dependencias posteriores y notifica al operario correspondiente. No rechazar un control sin identificar con precisión el trabajo que debe corregirse.

## Clientes

Permite crear, editar y dar de baja clientes, además de administrar CUIT, rubro, dirección, notas y múltiples contactos. Evitar duplicados y mantener actualizado el responsable del proyecto.

## Presupuestos y órdenes

Presupuesto y producción forman parte de una misma orden y comparten código.

La lista ofrece las pestañas Todos, Presupuestos, En Producción, Cerrados y Sin Orden de Compra. También permite buscar, filtrar y ordenar por prioridad, estado y otros campos.

### Fase comercial

- Preparar ítems, materiales, horas y tarifas.
- Definir vigencia, plazo, descuentos e impuestos.
- Registrar la orden de compra cuando exista.
- Marcar el presupuesto como enviado.
- Aprobar, rechazar o dejar vencer.

Al aprobar se seleccionan modelo, fecha de compromiso y prioridad. La escala de prioridad va de 1, Mínima, a 5, Urgente.

### Fase productiva

- Planificar fechas.
- Asignar operarios y recursos.
- Controlar etapas, eventos y consumos.
- Administrar comentarios y adjuntos.
- Resolver control de calidad.
- Finalizar y cerrar la entrega.

Órdenes finalizadas, entregadas o canceladas pueden tener restricciones de edición.

## Asignaciones y dependencias

Las asignaciones se administran desde **Órdenes de Producción > Ficha > Orden de Producción**.

En cada tarjeta de etapa se puede:

- agregar uno o varios responsables;
- reemplazar un responsable;
- quitarlo con confirmación;
- consultar asignaciones actuales;
- leer y agregar comentarios de coordinación.

Las altas, cambios y bajas conservan autor y fecha. Una etapa se habilita cuando se cumplen sus dependencias, aunque ya tenga responsable asignado.

Armado Final requiere completar Chasis, Piso, Paredes, Techo, Aberturas, Eléctrica, Sanitaria y Pintura.

## Estados de etapa

| Estado | Acción esperada |
|---|---|
| BLOQUEADA | Resolver dependencias previas |
| DISPONIBLE | Confirmar responsable e iniciar |
| EN_PROCESO | Supervisar avance |
| PAUSADA | Revisar motivo y reanudar cuando corresponda |
| COMPLETADA | Confirmar resultado y sucesoras |
| RETRABAJO | Corregir y completar nuevamente |
| CANCELADA | No continuar |

## Comentarios y eventos

Los comentarios permiten coordinar detalles específicos de una etapa. Los eventos operativos registran creación, asignación, inicio, pausa, reanudación, finalización, cambios de estado, consumos y notas.

Registrar motivos de pausa y observaciones concretas. Evitar mensajes ambiguos que no permitan reconstruir lo ocurrido.

## Materiales

El Supervisor puede administrar materiales, ajustar stock y revisar movimientos. Los consumos deben registrarse sobre la orden y etapa correctas. Al corregir o eliminar un consumo, verificar el efecto sobre stock y costos.

## Adjuntos

Los archivos se dividen en:

- **Adjuntos para operadores:** planos, imágenes o documentos necesarios para ejecutar el trabajo.
- **Adjuntos internos:** documentación reservada a perfiles de gestión.

El límite actual es 10 MB por archivo. Los operarios acceden únicamente a los adjuntos habilitados para ellos y en modo lectura.

No depender de este almacenamiento para originales críticos hasta confirmar persistencia y copias de seguridad de archivos.

## Entrega y remito

Antes del cierre:

1. Confirmar producción y calidad completas.
2. Revisar el checklist.
3. Registrar notas y firma cuando corresponda.
4. Completar el cierre de entrega.
5. Generar o descargar el remito imprimible.

## Reportes

Revisar horas, productividad, costos, desvíos, carga por operario y atrasos. Usar los desvíos como señal de investigación y confirmar siempre la calidad de los datos fuente.

## Copiloto IA

Puede resumir atrasos, carga, costos, materiales y producción. Las conversaciones quedan guardadas y cada respuesta puede mostrar fuentes internas y accesos directos.

Es una herramienta de solo lectura. Confirmar las recomendaciones contra la orden o reporte correspondiente.

## Calendario

Las fechas de compromiso provienen de las órdenes. Los eventos manuales se guardan localmente en el navegador y no se comparten automáticamente con otros usuarios o dispositivos.

## Restricciones del Supervisor

- No administra usuarios desde la pantalla Usuarios.
- No accede a Auditoría.
- No utiliza Mi Producción.
- No modifica la cuenta protegida del sistema.
- Toda operación queda limitada a la empresa asociada a su sesión.

## Buenas prácticas

- Revisar Producción al inicio y al cierre de cada turno.
- No dejar etapas disponibles sin responsable.
- Investigar operarios con trabajo asignado que no iniciaron ninguna etapa.
- Registrar prioridades y fechas realistas.
- Exigir motivos claros de pausa y retrabajo.
- Confirmar consumos antes del cierre.
- No aprobar calidad sin una revisión efectiva.
