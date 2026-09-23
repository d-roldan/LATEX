# DISAL Planta de Látex · V0.0.31

[← Índice de versiones](README.md)

Fecha: 23 de septiembre de 2026.

## Resumen

Esta versión actualiza la documentación del sistema. Aclara dónde se conserva la señal continua de peso y agrega manuales de usuario para Fabricación, Laboratorio, Envasado y Administrador, ilustrados con capturas de la aplicación en funcionamiento.

## Histórico de peso

- Se distingue el último peso que el backend mantiene en RAM para la vista en vivo del histórico continuo que el sistema industrial conserva en InfluxDB.
- Se aclara que el endpoint de recepción de LATEX no escribe las muestras en PostgreSQL ni en InfluxDB. El valor `persisted: false` corresponde a ese endpoint y no implica que el histórico de la señal sea volátil.
- La documentación de arquitectura, integración, requisitos y modelo de datos describe cómo LATEX consulta InfluxDB para reconstruir la evolución del peso y cómo PostgreSQL conserva los hitos operativos.

## Manuales de usuario

- Se incorporan cuatro manuales, uno por perfil: Fabricación, Laboratorio, Envasado y Administrador.
- Cada manual explica el ingreso, la lectura del panel, las acciones principales, las confirmaciones y las precauciones operativas de su perfil.
- Se describe qué es una tarjeta de tanque y qué información puede mostrar según su estado y sector.
- Las imágenes de referencia provienen del sistema en funcionamiento; no se incluyen los esquemas ficticios utilizados durante la preparación de los manuales.
- Las capturas muestran estados disponibles al momento de documentar. El formulario de trasvase no se ilustra porque esa acción no estaba disponible en el estado observado de la planta.

## Base de datos e integración

- No se modifican código, contratos de API, esquema de base de datos ni flujos de integración.
- No se requieren migraciones ni cambios de configuración para esta actualización documental.

## Verificación realizada

- Se comprobó que las imágenes enlazadas desde los cuatro manuales existen y que no quedan referencias a los esquemas SVG anteriores.
- Se verificó que los dos repositorios remotos estaban alineados en `main` con `V0.0.30` antes de crear esta versión.
- No se ejecutaron pruebas de aplicación porque no hay cambios de código.

## Consideraciones de actualización

- Distribuir los manuales según el perfil de cada usuario. Antes de imprimirlos, comprobar que las capturas y los datos de ejemplo sean adecuados para la circulación interna prevista.
- Una captura representa el estado de la interfaz en el momento de documentarla; los valores visibles no deben copiarse al registrar una operación nueva.
