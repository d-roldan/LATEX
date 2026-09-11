---
name: playwright-best-practices
description: Escribir, revisar y depurar pruebas Playwright de flujos completos, API, permisos, regresión visual o accesibilidad. Usar al crear pruebas de navegador o corregir fallos intermitentes; no para ejecutar validaciones unitarias del backend.
license: MIT
metadata:
  author: currents.dev
  language: es
  adaptation: Edición en español adaptada a LATEX
---

# Buenas prácticas de Playwright

Aplicar esta guía junto con `../e2e-test/SKILL.md`: aquella identifica el flujo y el entorno del proyecto; ésta orienta el diseño y diagnóstico de las pruebas. Comunicar planes, comentarios nuevos y resultados en español. Conservar identificadores de API y comandos.

Esta edición adapta y condensa las referencias de Currents para la aplicación web de LATEX. No es una traducción íntegra del catálogo original. Consultar [procedencia y licencia](ORIGEN.md).

## Elegir las referencias

| Trabajo | Leer |
| --- | --- |
| Nuevos escenarios, selectores, esperas y datos | [Diseño de pruebas](references/diseno-pruebas.md) |
| Sesiones, roles, plantas, red y telemetría | [Integración y aislamiento](references/integracion.md) |
| Fallos intermitentes, capturas y ejecución automatizada | [Diagnóstico y evidencia](references/diagnostico.md) |

## Procedimiento

1. Identificar el comportamiento esperado y un entorno de pruebas compatible con la solicitud. Leer la configuración y la versión instalada de Playwright antes de elegir APIs.
2. Separar el ciclo de tanques del módulo comercial heredado. En LATEX, cubrir el cambio concreto entre fabricación, laboratorio, envasado o trasvase según la planta.
3. Preparar datos aislados, verificar el destino y escribir comprobaciones observables. No ejecutar seeds, migraciones o resets como parte automática de una prueba.
4. Ejecutar el caso afectado. Investigar cualquier fallo mediante la evidencia; ampliar la ejecución a los casos relacionados si el cambio lo justifica.
5. Informar casos aprobados, fallidos y omitidos por separado. No quitar comprobaciones, ampliar tolerancias sin explicación ni convertir un fallo en `skip` para obtener un resultado verde.

Desde `e2e/`, una vez configurada una suite de Playwright Test:

```powershell
npx --no-install playwright test --reporter=list
```

Actualmente `e2e/npm test` es un marcador pendiente y los scripts heredados no equivalen a una suite de tanques. No afirmar que el comando anterior funciona hasta comprobar que existen configuración y pruebas compatibles. Usar ejecución sin ventana por defecto; mostrar el navegador si se solicita o resulta necesario para el diagnóstico.
