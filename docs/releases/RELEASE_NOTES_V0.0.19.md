# DISAL Planta de Látex · V0.0.19

[← Índice de versiones](README.md)

Fecha: 14 de septiembre de 2026.

## Resumen

Esta versión incorpora temas claro y oscuro en el frontend industrial, adopta el modo claro como presentación inicial y mejora el contraste de las pantallas operativas para conservar la lectura a distancia.

## Temas y navegación

- Se agregó un control accesible para alternar entre modo claro y oscuro en el acceso, la aplicación principal y la vista `/tv`.
- La preferencia queda guardada en el navegador y se restaura antes de renderizar la aplicación para evitar cambios visuales durante la carga.
- Se actualiza el color de interfaz del navegador según el tema activo.
- El menú lateral en modo claro usa texto negro en el selector de planta, enlaces normales y activos, datos del usuario y controles.
- Los popups operativos y de notificaciones muestran títulos, etiquetas, campos y contenido en negro cuando el tema es claro.

## Paneles operativos

- Se intensificó el color de fondo asociado al estado de cada tanque en ambos temas para facilitar su reconocimiento desde lejos.
- Se mejoró el contraste de peso, material, OF, descripción, capacidad y demás datos operativos en modo claro.
- Se eliminó la línea horizontal que aparecía debajo de `Kg (bruto)` en resoluciones amplias y pantallas de TV.
- Los botones de acción tienen fondos sólidos y un comportamiento uniforme al pasar el cursor: se elevan levemente, oscurecen su color y conservan el color de sus caracteres.
- En `/tv`, los controles de pantalla completa y tema ahora forman un único grupo con separación constante, evitando superposiciones cuando cambia la etiqueta de pantalla completa.

## Verificación y despliegue

- La verificación estricta de TypeScript y el build de producción de Vite finalizaron correctamente.
- El frontend fue reconstruido en el stack Docker local sin reiniciar la base de datos ni el backend.
- Nginx y la aplicación respondieron correctamente en `http://localhost:8081`.
- Se verificaron los estilos calculados de tarjetas, botones, popups y controles de `/tv` en modo claro.

## Consideraciones de actualización

- Esta versión no incluye migraciones ni cambios de esquema o backend.
- El repositorio mantiene incidencias de formato preexistentes, principalmente finales de línea CRLF; no afectan el build de producción de esta versión.
- El despliegue verificado corresponde al entorno Docker local, no a producción.
