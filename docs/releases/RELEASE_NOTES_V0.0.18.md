# DISAL Planta de Látex · V0.0.18

[← Índice de versiones](README.md)

Fecha: 9 de septiembre de 2026.

## Resumen

Esta versión incorpora operación multiplanta, integra los flujos de datos de Node-RED para todas las plantas y adapta la interfaz a la nueva navegación sin perder legibilidad en los paneles operativos.

## Operación multiplanta

- Se agregó el modelo de plantas y la asignación explícita de usuarios a cada planta.
- Se incorporaron Látex, Terplast, Slurry y Enduido con 9, 4, 2 y 2 equipos iniciales respectivamente.
- El selector de planta persiste la selección en la URL y separa las cachés y consultas por planta.
- Las pantallas de operación, historial, administración y notificaciones respetan la planta activa.
- Se agregó el trasvase transaccional de Slurry y el estado `TRASVASANDO`, sin generar órdenes ficticias.
- Enduido queda sin telemetría ni pesos simulados; los tags físicos pendientes permanecen deshabilitados.

## Integración y datos

- Se agregó una API de ingreso Node-RED identificada por planta, con credenciales protegidas y rechazo individual de lecturas inválidas.
- Los flujos de Node-RED envían datos diferenciados para todas las plantas configuradas.
- Se mantuvo compatibilidad temporal con el flujo histórico de Látex.
- Se agregó la migración multiplanta, una corrección de equipos Terplast, el instalador para bases vacías y un migrador único en Docker Compose.
- Se documentaron despliegue, recuperación, operación y configuración de pesos por planta.

## Interfaz e identidad visual

- La grilla operativa utiliza todo el ancho disponible con un máximo legible de cinco paneles por fila.
- Se corrigió el recorte de acciones cuando un equipo se encuentra en estado `ENVASANDO`.
- Se rediseñó el selector de plantas con bordes redondeados, iconografía sin superposición y contraste correcto en el menú desplegable.
- Se eliminó el texto “Control industrial” del encabezado del selector.
- Se incorporó el logo de Grupo DISAL en las pantallas principales y de acceso.
- Se agregó la marca D como favicon, con transparencia real tanto en el exterior como en su abertura interior.

## Verificación y despliegue

- Frontend y backend compilados para producción.
- Migraciones Prisma validadas e instalación sobre base vacía comprobada con `migrate deploy` idempotente.
- Stack local actualizado mediante Docker Compose.
- Frontend y recursos de identidad verificados mediante Nginx en `http://localhost:8081`.

## Consideraciones de actualización

- Esta versión incluye migraciones de base de datos; se recomienda respaldar la base antes de actualizar.
- Los nombres de equipos nuevos y los mapeos físicos de Terplast y Slurry deben confirmarse antes de un despliegue productivo.
- El despliegue realizado y verificado corresponde al entorno Docker local, no a producción.
