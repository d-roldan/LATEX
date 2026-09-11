# Seguridad del backend y de las integraciones

Adaptación de la referencia de OpenAI para Express al backend NestJS de LATEX. Revisar versión efectiva, módulos instalados y controles en Nginx antes de atribuir ausencias al código de Express.

## Entradas, autenticación y autorización

Tratar body, query, parámetros, cabeceras, archivos y datos de servicios externos como no confiables. Comprobar tipos reales, tamaños, rangos, arrays y propiedades permitidas. Rechazar ambigüedades cuando un parámetro único llega repetido o como objeto.

Revisar validación del JWT, expiración, secreto o clave y cualquier comprobación de emisor o audiencia que el contrato requiera. No incluir secretos en el payload. Diferenciar rol administrativo de excepciones explícitas como `isSystemOwner`; verificar el comportamiento real de guards y servicios.

Autorizar cada recurso por su contexto permitido. En operaciones de planta, el identificador enviado no prueba la asignación del usuario. Probar accesos directos, históricos, exportaciones y mutaciones, además de las rutas visibles.

Para Node-RED, revisar autenticación por planta, límites de lectura, valores finitos, equipos habilitados y rechazo individual según el contrato. Evitar registrar cabeceras con claves y no aceptar una lectura sólo porque el request viene de la red interna.

## Cookies, CORS y proxy

Si se usan cookies, revisar HttpOnly, Secure, SameSite, alcance, duración y revocación. `Secure` depende de HTTPS real; una configuración pensada para producción puede impedir el login en un entorno local HTTP. Si se usan sesiones de servidor, evaluar almacenamiento y ciclo de vida adecuados.

Las solicitudes que cambian datos autenticadas con cookies requieren un diseño de protección CSRF apropiado. CORS controla qué orígenes pueden leer respuestas en el navegador, no autoriza operaciones por sí solo.

Configurar orígenes permitidos explícitamente cuando corresponda. No reflejar sin validación el origen recibido al usar credenciales. Revisar `trust proxy` conforme a la topología de Nginx; confiar en cualquier cabecera reenviada puede alterar IP, protocolo y límites por cliente.

## Inyecciones y destinos

Usar Prisma y consultas parametrizadas. Revisar usos de SQL sin procesar, especialmente variantes inseguras e identificadores interpolados. No confundir parámetros de valores con validación de nombres de tablas o columnas.

Evitar construir comandos de shell con entradas del usuario; cuando un proceso externo sea necesario, usar una API de argumentos y una lista permitida apropiada. Validar también opciones que puedan cambiar el comportamiento del programa invocado.

Para solicitudes salientes con destinos controlables, revisar esquemas, hosts, redirecciones y acceso a servicios internos según la función. Una validación de texto inicial puede ser insuficiente si una redirección cambia el destino.

Los redirects, plantillas y nombres de archivos deben usar destinos permitidos. No renderizar una plantilla escogida arbitrariamente por el usuario ni convertir texto en código de plantilla.

## Archivos y contenido

Comprobar que las rutas resueltas permanezcan dentro del directorio autorizado. Validar nombres, tamaño, tipo real y uso previsto de archivos. Extensión y MIME declarado por el cliente no bastan por sí solos.

Al servir cargas, evitar que contenido activo se ejecute con privilegios del origen de la aplicación. Elegir descarga, cabeceras y origen de almacenamiento según el caso. Revisar límites del middleware de carga y del proxy.

## Disponibilidad, cabeceras y errores

Revisar límites de tamaño, tiempo y frecuencia en autenticación, API e ingreso de telemetría. No tratar como ataque la cadencia normal de Node-RED ni aplicar límites que corten la operación.

Comprobar cabeceras de seguridad y `Content-Type` en las respuestas relevantes. Revisar exposición de `x-powered-by`, mensajes de error, trazas y detalles de base. Considerar controles equivalentes ya presentes en Nginx antes de añadir middleware duplicado.

No exponer el inspector de Node ni habilitar análisis HTTP inseguro en producción. Mantener dependencias críticas con versiones conocidas y comprobar vulnerabilidades con evidencia actual cuando la auditoría lo requiera.

No denunciar falta de TLS sólo por observar un servidor local HTTP: identificar dónde termina TLS en el despliegue real. No introducir HSTS u otros cambios persistentes sin entender el dominio y el alcance de despliegue.
