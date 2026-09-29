# DISAL Planta de Látex · V0.0.33

[← Índice de versiones](README.md)

Fecha: 29 de septiembre de 2026.

## Resumen

Esta versión incorpora un formulario de envasado específico para la planta de Sintéticos. La actualización conserva sin cambios el contrato operativo y las opciones de envasado del resto de las plantas.

## Envasado de Sintéticos

- El inicio, cambio y corrección de una orden de envasado solicita la orden de envasado, el material, la línea de envasado y el formato.
- Las líneas disponibles son `Linea 1`, `Linea 20` y `Linea 3`.
- Los formatos disponibles son `0.25L`, `0.5L`, `1L`, `4L` y `10L`.
- Dosificadora, filtro y descripción de envasado dejan de solicitarse únicamente en Sintéticos.
- El backend valida las opciones usando la planta real del tanque; el aislamiento no depende solamente de la interfaz.
- Látex y las demás plantas mantienen sus campos, opciones y validaciones actuales.

## Base de datos y actualización

- No se agregan migraciones ni se modifica el esquema Prisma.
- La actualización se aplica desplegando las nuevas versiones de backend y frontend.
- No corresponde ejecutar seeds ni resets de base de datos.

## Verificación realizada

- Los 14 suites y 74 tests unitarios del backend finalizaron correctamente.
- El backend compiló correctamente con NestJS.
- El frontend superó la comprobación de tipos y compiló correctamente con Vite.
- Los archivos modificados cumplen el formato de Prettier.
- La comprobación de lint continúa bloqueada por la configuración preexistente de ESLint 9, que no encuentra un archivo `eslint.config.*`.

## Consideraciones de actualización

- Después del despliegue, realizar una recarga completa de la aplicación si el navegador conserva recursos anteriores.
- Verificar en Sintéticos que las líneas y formatos coincidan con la nomenclatura operativa acordada.
- Confirmar que una orden creada en otra planta continúe solicitando dosificadora, filtro y descripción.
