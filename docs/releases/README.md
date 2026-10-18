# Historial de versiones

[← Volver a la documentación principal](../README.md)

Esta carpeta reúne todas las notas de versión disponibles del sistema DISAL Planta de Látex. Las versiones se presentan de la más reciente a la más antigua.

Para la próxima versión, seguir [el procedimiento de publicación](../RELEASE_PROCESS.md) y [la plantilla de notas](TEMPLATE.md). La plantilla no representa una versión publicada.

| Versión                             | Fecha      | Contenido principal                                                                                                                       |
| ----------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [V0.0.43](RELEASE_NOTES_V0.0.43.md) | 18/10/2026 | Historial y receta Woojin por inyectora, flujo externo preparado y documentación del origen de temperaturas.                              |
| [V0.0.42](RELEASE_NOTES_V0.0.42.md) | 17/10/2026 | Planta ENVASES y TV de inyectoras Woojin, simulador Node-RED local, telemetría y autogestión de plantas del administrador.              |
| [V0.0.41](RELEASE_NOTES_V0.0.41.md) | 16/10/2026 | Corrección de la verificación de tags y lint proporcional en CI; incluye los cambios de aplicación de V0.0.39.                           |
| [V0.0.40](RELEASE_NOTES_V0.0.40.md) | 16/10/2026 | Corrección de formato del seed de demostración para completar el lint general del backend en CI.                                          |
| [V0.0.39](RELEASE_NOTES_V0.0.39.md) | 16/10/2026 | OF y OE en TV, PDF del historial por OF, agitación sin materiales y procedimientos de validación y publicación.                            |
| [V0.0.38](RELEASE_NOTES_V0.0.38.md) | 15/10/2026 | Mejor contraste, distribución y tamaño de los datos del tanque destacado en TV; velocidad en Env/min truncada a dos decimales.          |
| [V0.0.37](RELEASE_NOTES_V0.0.37.md) | 15/10/2026 | Velocidad Devree, filtros en la pizarra, pantallas TV por sector y perfiles de InfluxDB por planta.                                        |
| [V0.0.36](RELEASE_NOTES_V0.0.36.md) | 09/10/2026 | Pizarras de fabricación y envasado para Látex, con secuencia global de Devree y autocompletado de OF.                                     |
| [V0.0.35](RELEASE_NOTES_V0.0.35.md) | 30/09/2026 | Mejoras de interfaz, resumen por OF y gráfico histórico de peso para Sintéticos.                                                          |
| [V0.0.34](RELEASE_NOTES_V0.0.34.md) | 29/09/2026 | Endpoint consolidado y microcaché compartido para tableros Grafana multiplanta.                                                           |
| [V0.0.33](RELEASE_NOTES_V0.0.33.md) | 29/09/2026 | Formulario y validaciones de envasado específicos para la planta de Sintéticos.                                                           |
| [V0.0.32](RELEASE_NOTES_V0.0.32.md) | 28/09/2026 | Inicio efectivo del análisis de Laboratorio, Látex Viejo y Sintéticos, mejoras de interfaz y visualización de sólo lectura para Jefatura. |
| [V0.0.31](RELEASE_NOTES_V0.0.31.md) | 23/09/2026 | Manuales por perfil con capturas reales y aclaración del histórico de pesos en InfluxDB.                                                  |
| [V0.0.30](RELEASE_NOTES_V0.0.30.md) | 22/09/2026 | Auditoría por período, resumen e historial paginado por usuario, y trazabilidad cronológica de Laboratorio.                               |
| [V0.0.29](RELEASE_NOTES_V0.0.29.md) | 21/09/2026 | Dosificadora y filtro por orden de envasado, con mejoras de legibilidad en modo TV.                                                       |
| [V0.0.28](RELEASE_NOTES_V0.0.28.md) | 21/09/2026 | Recepción de muestras, métricas de Laboratorio, accesos por planta e inbox industrial idempotente.                                        |
| [V0.0.27](RELEASE_NOTES_V0.0.27.md) | 18/09/2026 | Auditoría integral y seguimiento de actividad para el Super Usuario.                                                                      |
| [V0.0.26](RELEASE_NOTES_V0.0.26.md) | 18/09/2026 | Trazabilidad gráfica del peso y mejoras del informe histórico.                                                                            |
| [V0.0.24](RELEASE_NOTES_V0.0.24.md) | 17/09/2026 | Trazabilidad ampliada por OF, InfluxDB e informe PDF.                                                                                     |
| [V0.0.23](RELEASE_NOTES_V0.0.23.md) | 17/09/2026 | Tarjetas operativas, SEMI/Material y solicitudes de ajuste editables.                                                                     |
| [V0.0.22](RELEASE_NOTES_V0.0.22.md) | 15/09/2026 | Legibilidad, TV por planta, accesibilidad de diálogos y carga diferida.                                                                   |
| [V0.0.20](RELEASE_NOTES_V0.0.20.md) | 15/09/2026 | Datos propios de las órdenes de envasado y actualización inmediata de la PWA.                                                             |
| [V0.0.19](RELEASE_NOTES_V0.0.19.md) | 14/09/2026 | Temas claro/oscuro y contraste de la interfaz industrial.                                                                                 |
| [V0.0.18](RELEASE_NOTES_V0.0.18.md) | 09/09/2026 | Candidata multiplanta; no desplegada en producción.                                                                                       |
| [V0.0.17](RELEASE_NOTES_V0.0.17.md) | 06/09/2026 | Mejoras visuales y simplificación del inicio de fabricación.                                                                              |
| [V0.0.16](RELEASE_NOTES_V0.0.16.md) | 03/09/2026 | Notificaciones entre sectores y pantalla TV.                                                                                              |
| [V0.0.15](RELEASE_NOTES_V0.0.15.md) | 03/09/2026 | Consolidación de trazabilidad, Jefatura e integración inicial.                                                                            |

Los tags `V0.0.21` y `V0.0.25` existen en Git, pero no tienen una nota Markdown histórica en el repositorio. No se generan documentos retrospectivos sin una fuente verificable de su alcance.

## Convención

- Las notas nuevas se crean como `docs/releases/RELEASE_NOTES_Vx.x.x.md`.
- Cada nota debe enlazar nuevamente a este índice.
- El índice de `docs/` mantiene sólo el acceso al historial completo y a la versión vigente.
- La nota debe distinguir funcionalidad incorporada, migraciones, verificación y consideraciones de actualización.
- El tag anotado debe usar el contenido completo de la nota mediante
  `git tag -a Vx.x.x --cleanup=verbatim -F docs/releases/RELEASE_NOTES_Vx.x.x.md`; un título
  resumido no reemplaza la nota del tag. `--cleanup=verbatim` es obligatorio para que Git no elimine
  los encabezados Markdown que comienzan con `#`.
