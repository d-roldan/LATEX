# DISAL Planta de Látex · V0.0.35

[← Índice de versiones](README.md)

Fecha: 30 de septiembre de 2026.

## Resumen

Esta versión mejora la identificación de planta en las pantallas operativas, la gestión de usuarios
y la lectura resumida del historial por orden de fabricación. También adapta el gráfico histórico
de peso de Sintéticos al esquema real publicado en InfluxDB.

## Cambios principales

- Los títulos de Fabricación, Laboratorio, Envasado, Historial y Estado de producción incluyen el
  código de la planta y se elimina el encabezado duplicado de los paneles.
- Gestión de Equipo incorpora búsqueda y orden ascendente o descendente por columna.
- Historial permite contraer los estados en una fila por OF, con cantidad de ajustes y órdenes de
  envasado, conservando el acceso al popup de trazabilidad.
- Sintéticos consulta el bucket `SINTETICO`, el measurement `TK N° NN` correspondiente al tanque y
  el field `value`. Las demás plantas conservan su perfil anterior.

## Base de datos y actualización

- No se agregan migraciones ni se modifica el esquema Prisma.
- La actualización requiere reconstruir `disal-frontend` y `disal-backend`.
- Para mostrar gráficos, el backend debe tener el ID de organización correcto y un token de
  InfluxDB con permiso de lectura sobre el bucket `SINTETICO`.

## Verificación realizada

- Frontend: ESLint, Prettier, TypeScript y build de producción correctos.
- Backend: 14 suites y 76 tests correctos, incluido el perfil de consulta de Sintéticos.
- Build de NestJS y archivos backend modificados verificados con ESLint y Prettier.
- Contenedores locales reconstruidos; backend saludable y aplicación disponible por Nginx.
