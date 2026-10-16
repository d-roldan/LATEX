---
name: e2e-test
description: Ejecutar o adaptar pruebas E2E con Playwright cuando se solicita validar un flujo completo o se modifican transiciones operativas, navegación o integración entre sectores.
---

# Validar flujos E2E

Primero identificar el flujo solicitado y revisar `e2e/README.md`, `e2e/package.json` y los escenarios de `e2e/tests/`. `npm test` ejecuta Playwright Test; `npm run test:list` sólo enumera casos. Las pruebas con escrituras tienen un preflight obligatorio que comprueba el Compose descartable `latex-e2e` antes de llamar a la API.

`e2e/flujo-completo.js` cubre el flujo comercial y metalúrgico heredado (presupuesto, OT y operario), tiene URL y credenciales demo fijadas y abre un navegador visible. No demuestra cobertura del flujo de tanques de látex. Revisar también `orders-panel-e2e.js` y `reproducir-incidente.js` antes de elegirlos; no asumir que sus destinos o datos coinciden con el entorno actual.

Para tanques, adaptar o crear una prueba enfocada en el cambio y verificar fabricación, laboratorio, aprobación/ajuste/rechazo y envasado o trasvase según la planta. Incluir permisos y aislamiento entre plantas cuando esos aspectos cambien.

Antes de ejecutar un script que muta datos, comprobar que apunta a un entorno de pruebas apropiado para la solicitud. No ejecutar semillas, migraciones o resets automáticamente. Leer configuración y credenciales sin publicarlas. Usar Playwright headless por defecto, salvo que se pida ver el navegador.

Con dependencias y entorno aislado disponibles, usar `npm run test:industrial` o un `--grep` enfocado. Instalar dependencias o navegador sólo si faltan y el trabajo los necesita. Conservar evidencias bajo `output/`.

Reportar en español el flujo realmente cubierto, entorno, resultado y limitaciones. Si no existe cobertura para el flujo pedido, indicarlo y preparar la prueba correspondiente; no sustituirla por el flujo comercial.
