# LATEX V0.0.40

**Fecha de publicación:** 16 de octubre de 2026

## Resumen

Esta versión corrige el formato de un archivo de datos de demostración que hacía fallar el lint general del backend en la CI incorporada con `V0.0.39`. Incluye todas las funcionalidades y documentos de esa versión.

## Correcciones

- Se aplica el formato de Prettier a `apps/backend/prisma/seed-disal-operational.ts`, sin cambiar los datos ni la lógica del seed.

## Base de datos

No se agregan migraciones ni cambios de esquema. El seed no se ejecuta durante esta publicación.

## Variables de entorno y configuración

Sin cambios respecto de `V0.0.39`.

## Actualización

Para una instalación existente, usar `V0.0.40` y seguir `docs/ACTUALIZACION_SERVIDOR.md`. Si se actualiza desde una versión anterior a `V0.0.39`, aplicar las indicaciones de esa nota y reconstruir backend y frontend. Esta corrección de formato no requiere una operación adicional sobre la base de datos ni el Node-RED externo.

Esta publicación actualiza los repositorios Git. No actualiza el servidor productivo.

## Verificaciones realizadas

- `V0.0.39`: 14 suites y 108 pruebas del backend, compilación de backend y frontend, lint del frontend, PDF de prueba, configuración E2E y servicios locales comprobados según su nota.
- Para esta corrección se comprobó el diff del seed y se ejecutaron Prettier y ESLint sobre el archivo afectado.
- La CI de `V0.0.39` aprobó frontend y configuración E2E; el job backend falló por diez errores de formato del seed. La CI de `V0.0.40` se comprobará después del push.

## Limitaciones conocidas

Los escenarios E2E industriales siguen pendientes de un entorno `latex-e2e` descartable. El lint general del backend en el checkout local de Windows marca CRLF en otros archivos existentes; la CI usa un checkout Linux.
