# Documentación · Planta de Látex DISAL

Este directorio reúne la documentación funcional, operativa y técnica del sistema. Los documentos distinguen entre el alcance vigente y la evolución prevista; una capacidad marcada como objetivo no debe interpretarse como implementada.

## Documentos principales

### Manuales de usuario

- [Manual de Fabricación](MANUAL_USUARIO_FABRICACION.md): inicio y corrección de fabricaciones, envío a Laboratorio, ajustes, rechazados y servicio.
- [Manual de Laboratorio](MANUAL_USUARIO_LABORATORIO.md): recepción de muestras, aprobación, ajustes, rechazos y correcciones.
- [Manual de Envasado](MANUAL_USUARIO_ENVASADO.md): inicio y cambio de OE, correcciones, finalización y trasvase.
- [Manual de Administrador](MANUAL_USUARIO_ADMINISTRADOR.md): usuarios, accesos, asistencia operativa, resumen, historial y auditoría.

### Documentación funcional y técnica

- [Plan de implementación multiplanta](PLAN_IMPLEMENTACION_MULTIPLANTA.md): cuatro plantas, trasvase, fuera de servicio, pesos Node-RED y migración segura.
- [Requisitos funcionales](REQUIREMENTS.md): alcance implementado, limitaciones y requisitos recomendados.
- [Operación y API de planta](OPERACION_PLANTA.md): roles, transiciones, persistencia y reglas de operación.
- [Modelo de datos](data-model.md): entidades vigentes y ampliaciones propuestas.
- [Integración y base de datos](INSTRUCTIVO_INTEGRACION_Y_BASE_DE_DATOS.md): instalación, configuración e integración técnica.
- [Contrato de pesos con Node-RED](NODE_RED_PESOS.md): formato y comportamiento de la telemetría actual.
- [Integración de inyectoras Woojin · ENVASES](INTEGRACION_ENVASES_WOOJIN.md): contrato de telemetría, provisión y puesta en marcha industrial.
- [Base de datos CMS de Woojin](BASE_DATOS_CMS_WOOJIN.md): estructura, finalidad y límites de las once tablas de `disal_cms`.
- [Origen de temperaturas del CMS Board Woojin](ORIGEN_TEMPERATURAS_WOOJIN.md): recorrido estático de `Setting` y `Current`, correspondencia de las ocho tarjetas y límites para integrarlas.
- [Análisis de secuencias de disparos Woojin](ANALISIS_SHOT_NUMBER_WOOJIN.md): continuidad de `Shot_Number`, duplicados y límites para atribuir históricos a una IP.
- [Flujo completo de Node-RED externo para ENVASES](FLUJO_NODERED_EXTERNO_ENVASES.md): JSON importable, configuración, prueba manual y límites de atribución de ciclos.
- [Simulador local Woojin · ENVASES](SIMULADOR_ENVASES_WOOJIN.md): datos de demostración, controles y aislamiento de la fuente real.
- [Matriz PLC / SCADA / Node-RED / InfluxDB](MATRIZ_INTEGRACION_INDUSTRIAL.md): responsabilidades, inbox idempotente y relevamiento pendiente por señal.
- [Despliegue multiplanta](DESPLIEGUE_MULTIPLANTA.md): instalación vacía, baseline, actualización, backups y recuperación.
- [Migraciones Prisma](MIGRACIONES.md): procedimientos separados para desarrollo, instalación y bases existentes.
- [Preparación y publicación de versiones](RELEASE_PROCESS.md): numeración, notas, tag anotado, remotos y verificación.
- [Actualización controlada del servidor](ACTUALIZACION_SERVIDOR.md): runbook para seleccionar un tag,
  respaldar, migrar, verificar y aplicar rollback en una instalación existente.
- [Arquitectura de contenedores](ARQUITECTURA_CONTENEDORES.md): función, tecnología, comunicación, puertos, persistencia y operación de cada servicio Docker.
- [Consultas históricas](CONSULTAS_HISTORICAS.md): ejemplos de consulta sobre PostgreSQL.
- [PWA](PWA.md): instalación y comportamiento sin conexión.
- [HTTPS local](HTTPS_LOCAL.md): configuración de acceso seguro en la red interna.
- [Ejemplo de accesos](accesses.example.md): plantilla sin credenciales reales.
- [Agentes de Codex](AGENTES_CODEX.md): roles en español para planificación, generación y diagnóstico de pruebas, revisión de planta y telemetría.
- [Validación proporcional al cambio](ESTRATEGIA_VALIDACION.md): cómo elegir pruebas, builds y comprobaciones de integración según el riesgo sin repetir verificaciones innecesarias.

Los documentos maestros que describen el producto completo permanecen en la raíz del proyecto:

- [Contexto real de la planta](../CONTEXTO_PLANTA_LATEX.md).
- [Contexto y alcance integral](../CONTEXTO_Y_ALCANCE_PROYECTO.md).
- [Especificación funcional](../ESPECIFICACION_FUNCIONAL_PLANTA.md).

## Historial de versiones

- [Historial completo de versiones](releases/README.md): índice ordenado de todas las notas disponibles.
- [Versión vigente · V0.0.44](releases/RELEASE_NOTES_V0.0.44.md): historial y receta Woojin por inyectora con corrección del lint de CI.

## Criterio de actualización

Cuando cambie el producto:

1. Actualizar los requisitos y el documento operativo correspondiente.
2. Actualizar el modelo de datos si cambia la información persistida.
3. Crear la nota nueva dentro de `docs/releases/` y agregarla a su índice.
4. Mantener explícita la diferencia entre comportamiento vigente, limitación y objetivo futuro.
