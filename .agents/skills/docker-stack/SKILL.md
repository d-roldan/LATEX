---
name: docker-stack
description: Gestionar Docker Compose cuando se solicita iniciar, detener, reconstruir o diagnosticar contenedores del proyecto o preparar su entorno local.
---

# Gestionar Docker Compose

Trabajar desde la raíz del repositorio. Consultar `docker-compose.yml` y `docker compose config --services` para confirmar servicios. Incluye `disal-backend`, `disal-frontend`, `disal-db`, `disal-nginx`, `disal-node-red` y el migrador `disal-migrate`.

- Estado: `docker compose ps -a`.
- Inicio o reconstrucción autorizados: `docker compose up -d --build`; limitar a los servicios afectados si corresponde.
- Logs acotados: `docker compose logs --tail 100 disal-backend`.
- Reinicio del backend: `docker compose restart disal-backend`.
- Detención solicitada: `docker compose down`, sin eliminar volúmenes.

Leer `docs/DESPLIEGUE_MULTIPLANTA.md` antes de una instalación o actualización con cambios de base. El migrador es un trabajo de una sola ejecución: comprobar su salida exitosa, no exigir que permanezca Up. No ejecutar seeds automáticamente. Consultar la skill `db-check` si el trabajo incluye schema o migraciones.

Si falta `.env`, preparar la configuración a partir de `.env.example` sin sobrescribir una existente. No imprimir secretos. Obtener el puerto publicado de la configuración vigente; no asumir puerto 80. Verificar servicios y respuesta de la aplicación después del cambio y comunicar resultados en español.
