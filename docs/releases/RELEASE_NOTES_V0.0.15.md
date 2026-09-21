# DISAL Planta de Látex · V0.0.15

[← Índice de versiones](README.md)

Fecha: 3 de septiembre de 2026.

## Resumen

Esta versión consolida el proyecto como sistema operativo y de trazabilidad para la planta de látex DISAL. Incorpora la experiencia completa para los sectores Fabricación, Laboratorio, Envasado, Monitoreo, Jefatura y Administración, junto con mejoras de integración, históricos e informes.

## Actualizaciones principales

- Incorporación del rol `JEFATURA` y del resumen diario de producción.
- Reconstrucción histórica del estado de los tanques según la fecha seleccionada.
- Línea temporal completa por OF, tiempos por etapa y semáforos configurables.
- Cierres diarios persistidos y exportaciones profesionales en PDF y Excel.
- Historial con buscador por OF, material, descripción, responsable o tanque y tabla desplazable.
- Registro de cantidades planificadas, turnos, prioridades, kilogramos envasados, unidades y merma.
- Fotografías puntuales del peso al producirse transiciones, sin guardar la telemetría continua en PostgreSQL.
- Node-RED incluido en Docker Compose con simulador de pesos para TK101–TK109.
- Escenario demostrativo con lotes, controles de calidad, históricos y órdenes de envasado.
- OF y OE normalizadas a 8 dígitos y materiales a 6 dígitos, normalmente iniciados en `60`.
- Capacidades actualizadas con factor de diseño `1,5 kg/L`:
  - TK101–TK102: 60.000 kg.
  - TK103–TK104: 45.000 kg.
  - TK105–TK107: 30.000 kg.
  - TK108–TK109: 10.500 kg.
- Rediseño Full HD de las tarjetas para mejorar legibilidad y conservar visibles las acciones.
- Fondo fijo por estado, borde fino y halo exterior sin animaciones ni parpadeos.
- Menú lateral desplegable, modo pantalla completa y confirmaciones internas.
- Eliminación de comandos TARA/CERO y de módulos heredados ajenos al alcance de planta.
- Nomenclatura e infraestructura normalizadas íntegramente a DISAL.

## Documentación

- Nueva especificación integral de contexto, arquitectura y alcance futuro.
- Contrato de integración de pesos desde Node-RED.
- Instructivo de acceso y consultas históricas de PostgreSQL.
- Modelo de datos y manual operativo actualizados.
- Definición de la evolución hacia trazabilidad PLC/SCADA, recetas, válvulas, cargas, InfluxDB y envasado.

## Verificación

- Compilación de backend y frontend.
- 23 pruebas automatizadas aprobadas.
- Stack Docker operativo con PostgreSQL, backend, frontend, Nginx y Node-RED.
- API de salud y exportaciones verificadas.

## Consideraciones de actualización

- Ejecutar la migración incluida antes de iniciar la nueva versión en otro entorno.
- Revisar y completar `.env` tomando `.env.example` como referencia.
- No reutilizar credenciales de desarrollo en producción.
- Generar un respaldo de PostgreSQL antes de migrar.
- El escenario `seed-demo-latex.sql` reemplaza datos operativos y debe utilizarse únicamente para demostración o pruebas controladas.
