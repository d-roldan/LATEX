# Arquitectura e interfaces HTTP

Adaptación de las categorías de arquitectura, inyección de dependencias y diseño de API de Kadajett.

## Módulos y responsabilidades

Agrupar por funcionalidad como lo hace el repositorio. Un módulo debe declarar sus proveedores, exportar lo necesario e importar los módulos de los que depende. Evitar declarar el mismo servicio en varios módulos: puede crear instancias distintas y separar accidentalmente su estado.

Detectar ciclos entre módulos y servicios. `forwardRef` puede resolver una dependencia técnica, pero antes comprobar si la responsabilidad compartida pertenece a otro módulo o si se puede invertir una dependencia. No rediseñar toda la aplicación para corregir un ciclo localizado.

Mantener controladores centrados en el contrato HTTP y servicios en operaciones de negocio. Extraer una consulta compleja o un componente especializado cuando tenga un límite claro y se reutilice; no añadir repositorios vacíos que sólo reenvíen cada método de Prisma.

Los eventos desacoplan efectos secundarios, pero no garantizan por sí mismos entrega ni transacciones. Un historial obligatorio no debe depender de un evento en memoria que se pueda perder. Un cambio que requiera entrega duradera necesita un diseño explícito, como una bandeja transaccional, y forma parte de otro alcance.

## Dependencias

Preferir inyección por constructor. Las interfaces de TypeScript desaparecen al compilar: usar una clase, símbolo o token real si se inyecta una abstracción. No recurrir a `ModuleRef.get()` como mecanismo general para ocultar dependencias.

Mantener interfaces pequeñas que describan la capacidad requerida. Las implementaciones reales y sus dobles de prueba deben respetar forma de resultados, errores y efectos del contrato. Un doble que siempre funciona no prueba la gestión de errores.

Usar proveedores compartidos sin almacenar en ellos el usuario o la planta de una solicitud. Los servicios singleton se reutilizan entre peticiones. Pasar el contexto necesario explícitamente o seguir el mecanismo existente; cambiar a ámbito de solicitud sólo si la necesidad compensa su coste y propagación.

## Entradas y salidas

Usar DTO con validadores y verificar cómo se configura `ValidationPipe` en el arranque. Revisar `whitelist`, rechazo de propiedades desconocidas y transformación según el contrato existente. La anotación de tipo TypeScript no valida JSON recibido.

Aplicar pipes para parámetros y conversiones conocidas. No transformar una cadena arbitraria a número sin comprobar finitud, rango y formato; cuidar valores cero, negativos y decimales en pesos.

Definir explícitamente las propiedades devueltas. Un objeto de Prisma puede contener campos internos que no deben salir por HTTP. Usar selección de campos o DTO de respuesta coherente; `@Exclude` sólo funciona si se ejecuta la serialización correspondiente, no por existir en una clase que nunca se instancia.

No cambiar de manera silenciosa los nombres o la forma de respuestas usadas por frontend o Node-RED. Si se necesita un cambio incompatible, diseñar compatibilidad o versionado con el alcance solicitado. No añadir un esquema de versionado nuevo a toda la API por una corrección menor.

## Aspectos compartidos

Usar guards para autenticación y autorización; pipes para entrada; filtros para errores; interceptores para medición o transformación transversal. Respetar el orden y la configuración de NestJS. No duplicar en cada controlador el mismo bloque de captura de excepciones o formato de errores.

Mantener los mensajes al usuario en español y los identificadores de contrato estables. Los comentarios deben explicar decisiones locales, no repetir el nombre de la función.
