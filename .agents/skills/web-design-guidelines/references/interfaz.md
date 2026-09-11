# Criterios de interfaz para LATEX

Adaptación en español de los temas de accesibilidad, navegación, interacción y presentación de Vercel, con criterios específicos de pantallas de planta. Aplicar los que correspondan al componente, sin imponer un rediseño global.

## Semántica y teclado

Usar botones para acciones y enlaces para navegación, conservando apertura en otra pestaña. Preferir controles HTML nativos frente a contenedores con manejadores de clic. Cada control debe tener un nombre accesible; etiquetar botones de sólo icono y asociar etiquetas a campos.

Mantener foco visible y recorrido de teclado coherente. Un modal debe recibir foco, contenerlo cuando corresponda, cerrarse por los mecanismos previstos y devolverlo al control de origen. Los encabezados fijos y avisos no deben tapar el elemento enfocado.

Conservar jerarquía de encabezados, estructura de tablas y una ruta accesible al contenido principal. Dar texto alternativo significativo a imágenes informativas y ocultar iconos puramente decorativos a tecnologías de asistencia. Ofrecer alternativas textuales a medios relevantes.

## Estados y mensajes

No expresar estado de tanque, alarma o disponibilidad únicamente con color. Combinar texto y señales visuales legibles. Diferenciar carga inicial, operación pendiente, error, lista vacía y ausencia de telemetría. El cero es un dato distinto de la falta de señal.

Anunciar cambios importantes con mecanismos accesibles sin convertir cada lectura periódica de peso en una interrupción. Seleccionar regiones `aria-live` para eventos que requieren atención. Evitar notificaciones duplicadas por cada consulta.

Escribir etiquetas y errores en español, con acciones concretas: indicar qué campo corregir o cómo reintentar. Mantener la terminología de planta, OF, OE y equipos. Conservar mayúsculas técnicas sin imponer el estilo inglés de títulos a textos en español.

## Formularios y acciones

Configurar tipo de campo, nombre, autocompletado y teclado virtual según el dato. Permitir pegar y usar gestores de contraseñas. Asociar mensajes de validación a su campo y llevar el foco al primer error cuando corresponda.

Al enviar, indicar progreso y evitar envíos duplicados. Una validación pendiente o un permiso ausente deben tener una explicación comprensible; no depender de un botón inactivo sin contexto. Preservar confirmaciones de transiciones relevantes y advertencias de datos sin guardar según la operación.

Ampliar la zona táctil de controles pequeños mediante su contenedor o etiqueta sin superponer acciones. Probar números con decimales, códigos largos, textos vacíos y valores máximos previstos por el contrato.

## Distribución y pantallas

Probar los tamaños afectados: monitor Full HD de planta, escritorio, tablet y móvil. Revisar que las acciones de un equipo sigan visibles en estados con más contenido. Mantener el objetivo sin desplazamiento de las vistas operativas que lo requieren; permitir desplazamiento propio en reportes o administración cuando sea parte del diseño.

Usar flex o grid antes de medir posiciones con JavaScript. Manejar textos largos y mínimos de ancho en hijos flexibles. No resolver un recorte ocultando contenido necesario con `overflow: hidden`; comprobar que la acción siga disponible.

En diálogos y paneles, cuidar desplazamiento interno, bordes del dispositivo y zonas seguras. Mantener el contraste de selectores nativos en Windows y temas oscuros. Permitir ampliar la página; no desactivar el zoom para conservar un diseño rígido.

## Navegación y estado

Conservar en URL la planta activa y los filtros compartibles según el router vigente. Comprobar recarga, atrás, adelante y enlaces directos. No convertir datos sensibles o estados transitorios de formularios en parámetros de URL.

Mostrar de forma inequívoca la planta elegida. Después de cambiarla, evitar títulos de una planta con datos de otra. Mantener estados de foco y selección al actualizar una lista.

## Tipografía, imágenes y rendimiento

Usar `Intl.NumberFormat` e `Intl.DateTimeFormat` con criterios coherentes de locale y zona horaria. Alinear cifras y usar dígitos de ancho tabular cuando facilite comparar pesos o cantidades. Mostrar unidades junto al valor, sin confundir formato visual con el número enviado a la API.

Reservar espacio para imágenes para reducir saltos. Cargar diferidamente las que quedan fuera de pantalla cuando convenga y priorizar sólo recursos realmente críticos. No cargar grandes bibliotecas por un detalle visual pequeño.

Evaluar paginación o virtualización para listas grandes cuando la medición lo justifique. Evitar alternar lecturas y escrituras del DOM y cálculos costosos en cada pulsación. Verificar que cualquier optimización conserve accesibilidad y búsqueda.

## Movimiento e interacción táctil

Respetar `prefers-reduced-motion`. Mantener animaciones breves, interrumpibles y dirigidas a una propiedad concreta; evitar transiciones indiscriminadas. Los efectos decorativos no deben competir con un aviso operativo.

Ofrecer alternativas de clic y teclado a acciones por arrastre o gestos. Usar `autoFocus` con criterio, especialmente en móvil, donde puede abrir el teclado y ocultar contenido. Revisar estados de foco, hover, pulsación y deshabilitado con contraste suficiente.

## Entrega de revisión

Para cada problema registrar ubicación, comportamiento observado y cambio necesario. Separar requisitos operativos de preferencias estéticas. Una captura correcta no prueba navegación por teclado, permisos ni envío del formulario; informar qué interacciones se verificaron.
