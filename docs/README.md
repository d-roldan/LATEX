# Documentación · Planta de Látex DISAL

Este directorio reúne la documentación funcional, operativa y técnica del sistema. Los documentos distinguen entre el alcance vigente y la evolución prevista; una capacidad marcada como objetivo no debe interpretarse como implementada.

## Documentos principales

- [Plan de implementación multiplanta](PLAN_IMPLEMENTACION_MULTIPLANTA.md): cuatro plantas, trasvase, fuera de servicio, pesos Node-RED y migración segura.
- [Requisitos funcionales](REQUIREMENTS.md): alcance implementado, limitaciones y requisitos recomendados.
- [Operación y API de planta](OPERACION_PLANTA.md): roles, transiciones, persistencia y reglas de operación.
- [Modelo de datos](data-model.md): entidades vigentes y ampliaciones propuestas.
- [Integración y base de datos](INSTRUCTIVO_INTEGRACION_Y_BASE_DE_DATOS.md): instalación, configuración e integración técnica.
- [Contrato de pesos con Node-RED](NODE_RED_PESOS.md): formato y comportamiento de la telemetría actual.
- [Matriz PLC / SCADA / Node-RED / InfluxDB](MATRIZ_INTEGRACION_INDUSTRIAL.md): responsabilidades, inbox idempotente y relevamiento pendiente por señal.
- [Despliegue multiplanta](DESPLIEGUE_MULTIPLANTA.md): instalación vacía, baseline, actualización, backups y recuperación.
- [Arquitectura de contenedores](ARQUITECTURA_CONTENEDORES.md): función, tecnología, comunicación, puertos, persistencia y operación de cada servicio Docker.
- [Consultas históricas](CONSULTAS_HISTORICAS.md): ejemplos de consulta sobre PostgreSQL.
- [PWA](PWA.md): instalación y comportamiento sin conexión.
- [HTTPS local](HTTPS_LOCAL.md): configuración de acceso seguro en la red interna.
- [Ejemplo de accesos](accesses.example.md): plantilla sin credenciales reales.
- [Agentes de Codex](AGENTES_CODEX.md): roles en español para planificación, generación y diagnóstico de pruebas, revisión de planta y telemetría.

Los documentos maestros que describen el producto completo permanecen en la raíz del proyecto:

- [Contexto real de la planta](../CONTEXTO_PLANTA_LATEX.md).
- [Contexto y alcance integral](../CONTEXTO_Y_ALCANCE_PROYECTO.md).
- [Especificación funcional](../ESPECIFICACION_FUNCIONAL_PLANTA.md).

## Historial de versiones

- [V0.0.28](RELEASE_NOTES_V0.0.28.md) — recepción de muestras, métricas de Laboratorio, accesos por planta e inbox industrial idempotente.
- [V0.0.27](RELEASE_NOTES_V0.0.27.md) — auditoría integral y seguimiento de actividad para el Super Usuario.
- [V0.0.26](RELEASE_NOTES_V0.0.26.md) — trazabilidad gráfica del peso y mejoras del informe histórico.
- [V0.0.24](RELEASE_NOTES_V0.0.24.md) — trazabilidad ampliada por OF, InfluxDB e informe PDF.
- [V0.0.23](RELEASE_NOTES_V0.0.23.md) — tarjetas operativas, SEMI/Material y solicitudes de ajuste editables.
- [V0.0.22](RELEASE_NOTES_V0.0.22.md) — legibilidad, TV por planta, accesibilidad de diálogos y carga diferida.
- [V0.0.20](RELEASE_NOTES_V0.0.20.md) — datos propios de las órdenes de envasado y actualización inmediata de la PWA.
- [V0.0.19](RELEASE_NOTES_V0.0.19.md) — temas claro/oscuro y contraste de la interfaz industrial.
- [V0.0.18](RELEASE_NOTES_V0.0.18.md) — candidata multiplanta; no desplegada en producción.
- [V0.0.17](RELEASE_NOTES_V0.0.17.md) — mejoras visuales y simplificación del inicio de fabricación.
- [V0.0.16](RELEASE_NOTES_V0.0.16.md) — notificaciones entre sectores y pantalla TV.
- [V0.0.15](RELEASE_NOTES_V0.0.15.md) — consolidación de trazabilidad, Jefatura e integración inicial.

## Criterio de actualización

Cuando cambie el producto:

1. Actualizar los requisitos y el documento operativo correspondiente.
2. Actualizar el modelo de datos si cambia la información persistida.
3. Crear una nota de versión nueva dentro de este directorio.
4. Mantener explícita la diferencia entre comportamiento vigente, limitación y objetivo futuro.
