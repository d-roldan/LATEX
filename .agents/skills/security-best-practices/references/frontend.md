# Seguridad del frontend React y del navegador

Adaptación de las referencias de OpenAI para JavaScript de navegador y React. Evaluar las funciones que realmente usa el proyecto; no asumir SSR, service workers o contenido enriquecido si no existen.

## Configuración y sesiones

Todo lo incluido en el bundle puede leerlo el navegador. No introducir contraseñas, claves Node-RED, secretos JWT o credenciales de base en variables `VITE_*`, código, mapas de fuentes o configuración pública. Una clave expuesta no se vuelve privada al ofuscarla.

Revisar cómo se almacenan y transmiten tokens. `localStorage` y `sessionStorage` son accesibles por JavaScript y no resisten un XSS; además su contenido puede modificarse. No confiar en ellos para establecer roles o planta autorizada. Si se propone cambiar a cookies HttpOnly, diseñar también CSRF, expiración y compatibilidad del login: no es una sustitución aislada de una línea.

Proteger los recursos en el servidor. El menú, `ProtectedRoute` y los botones ayudan a la experiencia de uso, pero no impiden una llamada directa a la API. Revisar peticiones con identificadores de otras plantas y datos almacenados en caché tras cambiar de usuario.

## Texto, HTML y código

Usar el escape normal de React al mostrar texto. Evitar `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML` y `document.write` con contenido no confiable. Si una función realmente necesita HTML enriquecido, usar un saneador mantenido y configurado para ese contexto; comprobar también atributos y URLs.

No ejecutar datos como código con `eval`, `new Function`, temporizadores de cadena o atributos de manejadores generados a partir de texto. No asumir propiedades globales de `window` o `document` creadas por nombres de elementos: pueden colisionar con contenido del documento.

Al renderizar Markdown, revisar HTML embebido, enlaces e imágenes. Las bibliotecas y su configuración determinan si el resultado es seguro; usar React no hace seguros todos los plugins.

## URLs, ventanas y solicitudes

Validar protocolos y destinos de URLs no confiables antes de usarlas en navegación, `href`, `src`, iframes o solicitudes. Para retornos de login, preferir rutas locales permitidas; una cadena que empieza con `/` todavía puede necesitar revisión por variantes como `//host`.

No reenviar cabeceras de autenticación a un destino construido a partir de entrada del usuario sin verificar su origen. Evitar datos sensibles en query strings que quedan en historiales, logs y enlaces.

En `postMessage`, usar un `targetOrigin` explícito y validar `event.origin`, origen de ventana cuando corresponda y estructura del mensaje recibido. Tratar el contenido como entrada no confiable incluso si su formato parece correcto.

## Archivos y recursos externos

Un archivo de usuario puede contener contenido activo. Revisar previsualizaciones de HTML, SVG, PDF y URLs de objeto; no insertar archivos arbitrarios en el DOM del origen de la aplicación. Revocar URLs temporales cuando dejen de necesitarse y aplicar restricciones de iframe cuando correspondan.

Minimizar JavaScript externo. Cuando se carguen recursos de CDN, evaluar versiones fijadas e integridad cuando el proveedor la permita. Revisar dependencias y scripts de construcción dentro del alcance de la auditoría.

## Defensas del navegador

Revisar CSP, restricciones de enmarcado, tipo de contenido y otras cabeceras en el punto que entrega la aplicación, incluido Nginx. CSP complementa el tratamiento seguro de contenido; no lo sustituye. Introducir políticas de forma compatible y comprobar que no rompan recursos o flujos necesarios.

Trusted Types puede ayudar donde el navegador y la aplicación lo soporten. No presentarlo como una capacidad universal ni instalarlo como solución automática.

Si existen service workers, revisar origen, HTTPS, alcance y caché de información autenticada. No cachear respuestas de usuarios de forma compartida. Si se usa autenticación con cookies, revisar CSRF junto con el backend y no tratar CORS como sustituto.
