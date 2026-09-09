# Documentación · Planta de Látex DISAL

Este directorio reúne la documentación funcional, operativa y técnica del sistema. Los documentos distinguen entre el alcance vigente y la evolución prevista; una capacidad marcada como objetivo no debe interpretarse como implementada.

## Documentos principales

- [Plan de implementación multiplanta](PLAN_IMPLEMENTACION_MULTIPLANTA.md): cuatro plantas, trasvase, fuera de servicio, pesos Node-RED y migración segura.
- [Requisitos funcionales](REQUIREMENTS.md): alcance implementado, limitaciones y requisitos recomendados.
- [Operación y API de planta](OPERACION_PLANTA.md): roles, transiciones, persistencia y reglas de operación.
- [Modelo de datos](data-model.md): entidades vigentes y ampliaciones propuestas.
- [Integración y base de datos](INSTRUCTIVO_INTEGRACION_Y_BASE_DE_DATOS.md): instalación, configuración e integración técnica.
- [Contrato de pesos con Node-RED](NODE_RED_PESOS.md): formato y comportamiento de la telemetría actual.
- [Despliegue multiplanta](DESPLIEGUE_MULTIPLANTA.md): instalación vacía, baseline, actualización, backups y recuperación.
- [Consultas históricas](CONSULTAS_HISTORICAS.md): ejemplos de consulta sobre PostgreSQL.
- [PWA](PWA.md): instalación y comportamiento sin conexión.
- [HTTPS local](HTTPS_LOCAL.md): configuración de acceso seguro en la red interna.
- [Ejemplo de accesos](accesses.example.md): plantilla sin credenciales reales.

Los documentos maestros que describen el producto completo permanecen en la raíz del proyecto:

- [Contexto real de la planta](../CONTEXTO_PLANTA_LATEX.md).
- [Contexto y alcance integral](../CONTEXTO_Y_ALCANCE_PROYECTO.md).
- [Especificación funcional](../ESPECIFICACION_FUNCIONAL_PLANTA.md).

## Historial de versiones

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
