# LATEX V0.0.41

**Fecha de publicación:** 16 de octubre de 2026

## Resumen

Esta versión completa la publicación de los cambios funcionales de `V0.0.39` y corrige la validación de CI incorporada en esa versión. Integra también la actualización de una imagen del README realizada en el GitHub personal.

## Correcciones

- La CI obtiene explícitamente el objeto del tag anotado antes de verificar la nota de versión.
- El lint del backend revisa los archivos TypeScript modificados desde la base de la ejecución. El build y las 108 pruebas del backend continúan ejecutándose en cada tag.
- El checkout del backend incluye el historial necesario para calcular ese alcance.

## Base de datos

No se agregan migraciones ni cambios de esquema. No se ejecutan seeds durante esta publicación.

## Variables de entorno y configuración

Sin cambios respecto de `V0.0.40`.

## Actualización

Para una instalación existente, usar `V0.0.41` y seguir `docs/ACTUALIZACION_SERVIDOR.md`. Si se actualiza desde una versión anterior a `V0.0.39`, aplicar también las indicaciones de esa nota y reconstruir backend y frontend. Esta corrección del workflow no requiere una operación adicional sobre la base de datos ni el Node-RED externo.

Esta publicación actualiza los repositorios Git. No actualiza el servidor productivo. El Docker local ya ejecuta los cambios de aplicación de esta serie; el workflow y la documentación de esta versión no alteran los contenedores.

## Verificaciones realizadas

- Los cambios de aplicación acumulados fueron comprobados en `V0.0.39`: 14 suites y 108 pruebas del backend, compilación de backend y frontend, lint del frontend, PDF de prueba, configuración E2E y servicios locales, según esa nota.
- Se revisó la diferencia del workflow y se comprobaron los remotos y sus tags anotados antes de preparar esta versión.
- La CI de `V0.0.40` detectó dos problemas de validación: el checkout del tag no exponía el objeto anotado y el lint general marcaba formato heredado de otro seed. La CI de `V0.0.41` se comprobará después del push.

## Limitaciones conocidas

Los escenarios E2E industriales siguen pendientes de un entorno `latex-e2e` descartable.
