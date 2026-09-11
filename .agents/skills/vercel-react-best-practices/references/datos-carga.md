# Consultas, dependencias y carga de código

Adaptación de las categorías de operaciones asíncronas, tamaño del bundle y consultas del cliente de Vercel.

## Evitar esperas innecesarias

Iniciar operaciones independientes en paralelo. Si una depende del identificador devuelto por otra, conservar esa dependencia; no usar paralelismo sólo para reducir líneas de código. Elegir `Promise.all` si el resultado requiere que todas funcionen y `Promise.allSettled` si se deben conservar resultados parciales y tratar cada error.

Comprobar condiciones locales baratas antes de iniciar consultas remotas. Mover una espera a la rama que realmente necesita su resultado. No adelantar solicitudes de datos privados antes de establecer el contexto autorizado.

En TanStack Query, modelar dependencias con claves y `enabled` apropiados. Evitar repetir en un `useEffect` una solicitud que la capa de consultas ya gestiona. No instalar SWR para seguir un ejemplo de la fuente: el proyecto dispone de TanStack Query.

## Claves e invalidación

Incluir en la clave toda variable que cambie el resultado: planta, filtros, paginación y contexto de acceso cuando corresponda. El siguiente ejemplo es esquemático:

```typescript
const clave = ['equipos', plantId, filtros];
```

Al cambiar de planta, impedir que una respuesta tardía se presente como perteneciente a la nueva selección. Usar la cancelación y el aislamiento de la biblioteca actual. No eliminar dependencias de hooks para ocultar solicitudes repetidas.

Después de una mutación, invalidar las consultas pertinentes o actualizar la caché con un resultado confirmado. Una actualización optimista necesita estrategia de rollback, versión y manejo del conflicto. En transiciones industriales, preservar la confirmación del backend.

Configurar `staleTime`, intervalo de consulta y reintentos según la frescura del dato. El peso actual, el historial cerrado y la lista de usuarios no necesitan necesariamente la misma política. No alargar el intervalo de telemetría sin considerar la operación.

## Tamaño del bundle

Inspeccionar imports y salida de compilación. Evitar archivos índice que arrastren dependencias costosas cuando existe una entrada pública específica. No importar rutas internas de una librería si no forman parte de su API estable.

Usar `React.lazy` e `import()` con rutas analizables por Vite para pantallas o recursos pesados de uso ocasional. Rodear la carga con `Suspense` y un estado de error apropiado. No usar `next/dynamic` en Vite.

Posponer librerías de exportación o visualización hasta que se necesiten si esto reduce una carga inicial medida. Mantener accesible la acción mientras se carga y evitar solicitudes repetidas. Precargar al enfocar o anticipar una navegación sólo cuando el beneficio justifique el tráfico adicional.

No añadir scripts de terceros para medir un problema que las herramientas locales permiten observar. Revisar qué variables `VITE_*` terminan en el bundle; todo valor expuesto al cliente es público.

## Suscripciones y almacenamiento

Registrar listeners globales una sola vez por suscripción y retirarlos en la limpieza. Usar listeners pasivos sólo si la interacción no necesita cancelar el comportamiento predeterminado.

Guardar en almacenamiento local únicamente preferencias necesarias, con validación y una estructura que pueda evolucionar. Manejar valores inválidos y fallos de acceso. No usar el almacenamiento como fuente confiable de autorización ni como caché sin alcance de planta.

Las recomendaciones de renderizado en servidor y caché por petición de Next.js quedan fuera de esta edición para Vite. Si la arquitectura cambia en el futuro, revisar las fuentes y versiones antes de incorporar esas reglas.
