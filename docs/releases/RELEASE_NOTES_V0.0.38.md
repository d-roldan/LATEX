# DISAL Planta de Látex · V0.0.38

[← Índice de versiones](README.md)

Fecha: 15 de octubre de 2026.

## Resumen

Esta versión mejora la lectura a distancia de la tarjeta destacada del tanque en la pantalla TV de envasado de Látex.

## Pantalla TV de envasado

- La barra de nivel se ubica junto al título del tanque. Los datos operativos aprovechan el ancho recuperado y aumentan su tamaño de letra según el espacio disponible.
- Los valores de la tarjeta destacada usan colores más oscuros para mejorar el contraste sobre el fondo celeste.
- La velocidad se muestra en `Env/min` y se trunca a un máximo de dos decimales, sin redondear el tercer decimal. Si no hay una lectura vigente, se conserva «Sin señal».

## Base de datos y actualización

- No hay migraciones, variables de entorno nuevas ni cambios en los contratos de telemetría.
- Para actualizar una instalación existente desde un tag publicado, seguir `docs/ACTUALIZACION_SERVIDOR.md` y reconstruir el frontend. Esta publicación actualiza los repositorios Git; no despliega cambios en el servidor productivo.

## Verificación realizada

- ESLint y Prettier de los archivos frontend modificados correctos; compilación TypeScript y Vite correcta mediante el build de Docker.
- Pantalla TV comprobada visualmente en 1920×1080, 1920×850 y 1366×768, sin recortes visibles de los datos.
- Frontend local reconstruido en Docker Compose y ruta TV comprobada por HTTP 200.
- Se comprobó el truncamiento con lecturas de ejemplo, incluida `12,349` → `12,34 Env/min`. El entorno local no tenía una lectura de velocidad vigente para verificar la señal real en pantalla.
