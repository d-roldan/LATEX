# Manual del Dueño / Administrador

**Versión documentada:** V0.0.13

**Actualización:** 1 de agosto de 2026

## Objetivo del rol

El perfil Dueño o Administrador tiene acceso completo a la gestión comercial, productiva y administrativa de la empresa. Además de operar órdenes, puede administrar usuarios, consultar auditoría y supervisar indicadores globales.

## Acceso y seguridad

1. Abrir la dirección de la aplicación entregada por el administrador técnico.
2. Ingresar con una cuenta de rol `DUENO` o `ADMIN`.
3. Cambiar la contraseña inicial desde el menú de usuario.
4. Cerrar sesión al terminar, especialmente en equipos compartidos.

La cuenta protegida del sistema no debe eliminarse, suspenderse ni compartirse. Ante pérdida de acceso, solicitar el restablecimiento a otro Dueño o Administrador autorizado.

## Uso desde computadora, tablet o celular

La aplicación adapta paneles, formularios y ventanas emergentes al tamaño de pantalla.

- En computadora, el menú lateral puede contraerse.
- En tablet y celular, el menú se abre desde el botón superior y se presenta como una lista vertical.
- Las ventanas emergentes tienen desplazamiento propio cuando el contenido supera la altura disponible.
- El desplegable de notificaciones permanece dentro de la pantalla.

## Navegación disponible

| Sección | Uso principal |
|---|---|
| Tablero | Indicadores ejecutivos y alertas |
| Producción | Estado de planta y seguimiento operativo |
| Clientes | Datos comerciales y contactos |
| Órdenes de Producción | Presupuestos, fabricación y entregas |
| Recursos | Personas, máquinas y capacidad |
| Materiales | Inventario, costos y movimientos |
| Reportes | Productividad, horas, costos y desvíos |
| Copiloto IA | Consultas analíticas de solo lectura |
| Calendario | Compromisos y eventos |
| Usuarios | Cuentas, roles y accesos |
| Auditoría | Historial de acciones y cambios |

La sección **Mi Producción** es exclusiva del perfil Operario y no forma parte de la navegación del Dueño o Administrador.

## Notificaciones

La campana superior informa eventos relevantes para el usuario, entre ellos:

- una nueva etapa asignada;
- una etapa completada;
- un control de calidad pendiente;
- un control de calidad rechazado y enviado a retrabajo.

El contador indica notificaciones no leídas. Al abrir una notificación relacionada con una orden o etapa, la aplicación dirige al registro correspondiente y lo resalta. También se pueden marcar todas como leídas.

## Tablero ejecutivo

El tablero presenta indicadores filtrables por período:

- órdenes activas y nivel de cumplimiento;
- carga y utilización de operarios;
- etapas pausadas, bloqueadas o sin responsable;
- órdenes próximas a vencer o atrasadas;
- horas estimadas y registradas;
- costos estimados y reales;
- desvíos y rentabilidad estimada;
- clientes y trabajos destacados.

Los costos reales se basan principalmente en consumos de materiales registrados. No representan una contabilidad integral de mano de obra, impuestos, logística o gastos generales.

## Producción y seguimiento de planta

La pantalla **Producción** concentra el estado operativo actual.

### Indicadores superiores

- **En proceso:** cantidad real de etapas activas. Funciona como botón.
- **Pausadas:** órdenes cuyo estado productivo está pausado.
- **Atrasadas:** órdenes abiertas con compromiso vencido.
- **Operarios sin asignación de trabajo:** usuarios operarios sin tareas accionables.

Al abrir **En proceso**, el popup muestra:

- cada operario que está trabajando;
- la etapa exacta que ejecuta;
- la OP, casilla, modelo y cliente;
- operarios que no trabajan actualmente pero tienen etapas asignadas y no bloqueadas;
- tareas listas para iniciar, pausadas o pendientes de retrabajo;
- etapas activas sin responsable.

El popup se actualiza cada 30 segundos y puede desplazarse con mouse, trackpad o gesto táctil.

### Mapa operativo

Cada tarjeta representa una casilla y muestra código, modelo, cliente, avance, etapas activas, responsables y dependencias bloqueadas. Al seleccionarla se abre el seguimiento histórico con asignaciones, eventos, pausas, sesiones, consumos y estado de las etapas.

### Atención y prioridades

La misma pantalla destaca controles de calidad pendientes, pausas, bloqueos, etapas sin responsable, operarios con trabajo pendiente, próximas órdenes por prioridad y órdenes atrasadas.

## Clientes

Permite crear, editar y dar de baja clientes. Cada registro puede incluir:

- razón social y CUIT;
- rubro;
- teléfonos, correo y dirección;
- notas;
- múltiples contactos con nombre, función y datos de contacto.

Evitar duplicados y mantener actualizado el contacto responsable de cada proyecto.

## Presupuestos y órdenes de producción

El sistema utiliza una única orden para la fase comercial y la fase productiva. Esto conserva el mismo código y la trazabilidad completa.

### Crear un registro

Desde **Órdenes de Producción** se puede crear:

- un presupuesto que comienza en fase comercial;
- una orden directa de producción.

La lista se divide en Todos, Presupuestos, En Producción, Cerrados y Sin Orden de Compra. Puede buscarse, filtrarse y ordenarse, incluida la prioridad.

### Fase comercial

Estados disponibles:

| Estado | Significado |
|---|---|
| BORRADOR | Preparación interna |
| ENVIADO | Presupuesto presentado al cliente |
| APROBADO | Aceptado y habilitado para producción |
| RECHAZADO | No aceptado |
| VENCIDO | Fuera de vigencia |

El presupuesto puede incluir ítems, materiales previstos, horas y tarifas, validez, plazo, orden de compra, subtotal, descuentos, impuestos y total.

Al aprobarlo se solicita modelo de casilla, fecha de compromiso y prioridad. La prioridad utiliza una escala de 1 a 5: Mínima, Baja, Normal, Alta y Urgente.

### Fase productiva

Estados globales:

- PENDIENTE;
- PLANIFICADA;
- EN_PROCESO;
- PAUSADA;
- FINALIZADA;
- ENTREGADA;
- CANCELADA;
- RETRABAJO.

La fuente operativa principal es el estado de cada etapa. Una orden puede tener varias etapas en proceso al mismo tiempo.

## Etapas, asignaciones y comentarios

Desde **Ficha > Orden de Producción** se visualiza el flujo de fabricación.

En cada etapa puede:

- asignar uno o varios operarios;
- reemplazar o quitar responsables;
- consultar dependencias y estado;
- leer y agregar comentarios;
- revisar el historial de trabajo.

Las asignaciones registran autor y fecha. Las etapas se habilitan por dependencias, no solamente por tener un responsable. Armado Final requiere completar Chasis, Piso, Paredes, Techo, Aberturas, Eléctrica, Sanitaria y Pintura.

## Control de calidad y retrabajo

Cuando las terminaciones habilitan Control de Calidad, la pantalla Producción muestra una alerta prioritaria.

El responsable puede:

1. Abrir **Revisar control de calidad**.
2. Aprobar con una calificación de 1 a 5 y una observación opcional.
3. Rechazar indicando qué etapa debe reabrirse y agregando una observación.

El rechazo coloca la etapa seleccionada en retrabajo, bloquea nuevamente el flujo posterior cuando corresponde y notifica al operario afectado.

## Materiales y consumos

Materiales permite administrar nombre, categoría, unidad, costo unitario, stock y ajustes manuales.

Los consumos cargados en una orden:

- descuentan existencias;
- guardan el costo vigente como referencia histórica;
- impactan en reportes y costos reales;
- pueden corregirse o eliminarse según los permisos disponibles.

Antes de corregir un consumo, verificar el impacto sobre stock y costos.

## Adjuntos

Los archivos se separan en:

- **Adjuntos para operadores:** visibles desde Mi Producción.
- **Adjuntos internos:** visibles únicamente para perfiles de gestión.

Se admiten los tipos autorizados por el backend hasta 10 MB por archivo. No usar este módulo como archivo documental definitivo mientras la infraestructura no tenga persistencia de archivos verificada.

## Entrega y remito

Antes de cerrar una entrega:

1. Confirmar que la producción y el control de calidad estén completos.
2. Revisar el checklist de entrega.
3. Registrar notas y la condición de firma.
4. Completar el cierre de entrega.
5. Generar o descargar el remito imprimible.

Una orden entregada queda principalmente en modo consulta.

## Usuarios y accesos

Dueño y Administrador pueden:

- crear usuarios;
- editar nombre, correo y nombre de acceso;
- asignar roles;
- restablecer contraseñas;
- activar o suspender cuentas;
- eliminar usuarios cuando las reglas de integridad lo permitan.

Roles disponibles:

| Rol | Acceso |
|---|---|
| DUENO | Gestión integral y administración |
| ADMIN | Gestión integral y administración técnica |
| SUPERVISOR | Gestión comercial y productiva, sin Usuarios ni Auditoría |
| OPERARIO | Solo Mi Producción y sus etapas asignadas |

## Recursos

Recursos administra personas y máquinas, con tipo, sector, estado y notas. Los recursos pueden asignarse a órdenes y etapas. Las funciones de administración de perfiles y accesos están reservadas a Dueño o Administrador.

## Reportes

Los reportes incluyen horas, productividad, costos, desvíos, carga por operario, estados comerciales, estados productivos y atrasos. Interpretar los resultados junto con la calidad de los datos cargados.

## Copiloto IA

El Copiloto IA consulta datos internos sin modificarlos. Permite iniciar y conservar conversaciones, revisar fuentes internas, abrir registros relacionados y utilizar preguntas sugeridas.

El indicador **Solo lectura** confirma que no puede crear, editar ni eliminar datos. Si el proveedor de IA no está disponible, la aplicación identifica la respuesta local de respaldo. Toda recomendación debe confirmarse contra la orden o reporte fuente.

## Calendario

Combina fechas de compromiso con eventos manuales y recurrentes. Los eventos manuales se guardan en el navegador utilizado y no constituyen una agenda compartida entre usuarios o dispositivos.

## Auditoría

Registra usuario, entidad, acción, fecha y cambios asociados cuando corresponda. Utilizarla para investigar modificaciones y confirmar trazabilidad, no como reemplazo de copias de seguridad.

## Buenas prácticas

- No compartir cuentas.
- Mantener roles y usuarios activos al día.
- Revisar alertas y notificaciones diariamente.
- Registrar fechas, prioridades, responsables y consumos con información real.
- Verificar periódicamente las copias de seguridad.
- No exponer directamente PostgreSQL ni servicios internos a redes no confiables.
- Confirmar que los adjuntos críticos también existan en un almacenamiento documental seguro.
