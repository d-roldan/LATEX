# DISAL Planta de Látex · V0.0.17

Fecha: 6 de septiembre de 2026.

## Resumen

Esta versión mejora la visualización de las pantallas de Jefatura y Usuarios, y simplifica el inicio de una fabricación eliminando datos que no forman parte de la operación real.

## Resumen diario

- Se corrigió el recorte de la parte inferior al utilizar el modo pantalla completa en resoluciones Full HD.
- El contenido ahora dispone de desplazamiento vertical propio y conserva el ancho dentro del área visible.
- La corrección no altera el diseño sin scroll de las pantallas operativas de planta.

## Gestión de usuarios

- El título de Gestión de Equipo queda centrado en pantallas de escritorio.
- Las acciones del encabezado tienen un espacio independiente a la derecha y ya no se superponen con el título.
- En tablet y móvil, las acciones se muestran debajo del título para mantener una distribución clara.

## Inicio de fabricación

- Se eliminaron del popup los campos Prioridad, Turno e Inicio planificado.
- Estos valores dejaron de incluirse en la solicitud enviada por el frontend.
- La prioridad conserva el valor predeterminado definido por el backend.

## Verificación

- Frontend validado con TypeScript y compilado para producción.
- Imagen del frontend reconstruida con Docker Compose.
- Contenedor `disal-frontend` recreado y verificado en ejecución.
- Bundle actualizado comprobado a través de Nginx en `http://localhost:8081`.

## Consideraciones de actualización

- Esta versión no requiere migraciones de base de datos.
- Después del despliegue puede ser necesaria una recarga forzada del navegador para descartar recursos anteriores de la caché.
