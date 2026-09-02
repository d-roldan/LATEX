---
name: docker-stack
description: Gestiona el stack completo de Docker Compose — build, inicio, parada, logs y configuración inicial. Usar esta skill cuando se pida iniciar o detener la app, reconstruir contenedores, ver logs, o configurar el proyecto desde cero con Docker.
---

# Skill: Gestionar Stack Docker

Gestiona el entorno Docker Compose completo (Nginx + NestJS + PostgreSQL).

## Operaciones comunes:

### Iniciar / reconstruir el stack
```bash
docker compose up --build -d
```

### Detener el stack
```bash
docker compose down
```

### Configuración inicial (ejecutar después del primer `up`)
```bash
docker compose exec backend npm run prisma:migrate
docker compose exec backend npm run prisma:seed
```

### Ver logs del backend en tiempo real
```bash
docker compose logs -f backend
```

### Ver todos los logs en tiempo real
```bash
docker compose logs -f
```

### Reiniciar un servicio individual
```bash
docker compose restart backend
# o: frontend, db, nginx
```

## Recordatorio de arquitectura:
```
Navegador → Nginx :80 → /api/*  → NestJS :3000 → PostgreSQL :5432
                      → /*      → React SPA (Nginx estático)
```

## Cómo reportar resultados:

- Confirmar qué comando se ejecutó y si todos los contenedores están saludables
- Si un contenedor falla al iniciar: mostrar sus logs y sugerir una solución
- Si es una configuración nueva: recordar al usuario ejecutar migrate + seed

## Idioma:
- Toda comunicación, explicación y reporte debe ser en **español**. Esto incluye mensajes de error traducidos, sugerencias de corrección y confirmaciones.

## Notas:
- Servicios disponibles: `backend`, `frontend`, `db`, `nginx`
- El archivo `.env` debe existir en la raíz del proyecto (copiar desde `.env.example` si falta)
- `JWT_SECRET` debe estar configurado — la validación de inicio rechaza secretos débiles en producción
- Credenciales de demo tras el seed: `owner@disal.local` / `ChangeMe123!`
