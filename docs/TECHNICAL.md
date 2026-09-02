# Documentación técnica — DISAL INDUSTRIA METALÚRGICA

## 1. Stack

### Frontend

- React 18.3
- TypeScript
- Vite 6
- React Router 6
- TanStack Query 5
- Axios
- Recharts
- Lucide React

### Backend

- NestJS 10
- TypeScript
- Prisma 5
- PostgreSQL 16
- JWT
- bcrypt
- Multer
- class-validator

### Infraestructura

- Docker Compose
- Nginx 1.27
- PostgreSQL Alpine

## 2. Arquitectura

El proyecto es un monolito modular, no un conjunto de microservicios.

```text
Cliente web
  -> Nginx exterior
      -> React SPA
      -> /api -> NestJS -> Prisma -> PostgreSQL
```

El frontend y backend se construyen como imágenes separadas, pero el dominio backend se ejecuta en un único proceso NestJS.

## 3. Autenticación

### Login

`POST /api/auth/login`

Acepta email, nombre completo o nombre de usuario corto y contraseña mediante el campo `identifier`. Las tres alternativas se comparan sin distinguir mayúsculas de minúsculas. El nombre de usuario corto es único dentro de cada empresa, se normaliza a minúsculas y admite letras, números, puntos, guiones y guiones bajos. Si el identificador coincide con más de un usuario activo entre empresas, el acceso se rechaza.

```json
{
  "identifier": "Nombre Apellido",
  "password": "contraseña"
}
```

La respuesta contiene:

```json
{
  "accessToken": "jwt",
  "user": {
    "id": "id",
    "companyId": "company",
    "fullName": "Nombre",
    "email": "usuario@empresa",
    "username": "nombre.usuario",
    "role": "DUENO",
    "companyName": "DISAL INDUSTRIA METALÚRGICA",
    "isProtected": false,
    "isSystemOwner": false
  }
}
```

El JWT contiene `sub`, `companyId`, `role`, `email`, `username`, `fullName`, `isProtected`, `isSystemOwner` y `sessionVersion`.

El frontend guarda la sesión en `localStorage` bajo `disal.session`. Si encuentra la clave heredada `disal.session`, la migra una sola vez y la elimina.

### Seguridad

- Rate limiting global del backend: 120 solicitudes por minuto. Las solicitudes autenticadas se agrupan mediante una huella SHA-256 del JWT y las públicas por IP; al superar el límite se responde `429 Too Many Requests`.
- Login: 5 intentos por minuto por IP.
- Bloqueo por contraseña incorrecta: las cuentas comunes se bloquean durante 15 minutos al alcanzar 5 fallos consecutivos; `ADMIN` y `DUENO`, al alcanzar 10. Un ingreso correcto reinicia el contador de la cuenta. El login informa explícitamente el bloqueo y el tiempo restante.
- Asistente de IA: 5 solicitudes por minuto por sesión y un máximo de 2 consultas simultáneas por usuario. Cada llamada externa a OpenAI tiene un timeout de 60 segundos.
- Adjuntos: 10 subidas cada 10 minutos por sesión y 10 MB por archivo. Se guardan fuera del webroot, en un volumen dedicado, y solo se descargan mediante un endpoint con JWT, empresa, asignación y visibilidad verificadas. HTML, SVG, ejecutables y combinaciones extensión/MIME no permitidas se rechazan.
- Nginx agrega una segunda capa por IP: 10 solicitudes por segundo para la API general, 5 por minuto para login y 10 por minuto para IA, con ráfagas controladas y límites de conexiones concurrentes.
- El backend confía en un único proxy (`trust proxy = 1`) para recuperar la IP enviada por Nginx. No debe exponerse directamente a redes no confiables.
- Los contenedores de backend, PostgreSQL y Nginx tienen límites configurables de CPU, memoria y cantidad de procesos en Docker Compose.
- Contraseñas: bcrypt 6, entre 6 y 72 caracteres para creación, cambio y restablecimiento. Para cuentas `ADMIN` y `DUENO` se recomienda usar 12 o más.
- JWT: expiración configurable; valor habitual 8 horas.
- La versión de sesión se verifica contra PostgreSQL en cada solicitud. Desactivar un usuario, cambiar su rol o cambiar/restablecer su contraseña revoca todos sus JWT anteriores.
- Logout normal elimina el token del navegador; los eventos sensibles anteriores fuerzan su revocación en el servidor.
- Sin refresh token.
- El backend filtra datos comerciales para `OPERARIO` y los endpoints de reportes, clientes, recursos, estadísticas y auditoría aplican roles explícitos.
- CSP restringida, formatos activos fuera de adjuntos, `nosniff`, política de permisos y protección contra framing.
- Auditoría de dependencias de producción al 05/08/2026: backend y frontend sin vulnerabilidades altas o críticas conocidas; permanecen avisos moderados que requieren actualizaciones mayores controladas.

Los límites de recursos se configuran mediante `BACKEND_MEMORY_LIMIT`, `BACKEND_CPU_LIMIT`, `DB_MEMORY_LIMIT`, `DB_CPU_LIMIT`, `NGINX_MEMORY_LIMIT` y `NGINX_CPU_LIMIT`. Los valores de referencia están documentados en `.env.example`.

## 4. Roles

| Capacidad | OPERARIO | SUPERVISOR | DUENO | ADMIN |
|---|:-:|:-:|:-:|:-:|
| Mi Producción | Sí | Sí | Sí | Sí |
| Dashboard y control de producción | No | Sí | Sí | Sí |
| Clientes y órdenes | No | Sí | Sí | Sí |
| Recursos y materiales | No | Sí | Sí | Sí |
| Reportes, calendario e IA | No | Sí | Sí | Sí |
| Usuarios | No | No | Sí | Sí |
| Auditoría visible | No | No | Sí | Sí |
| Configuración de empresa | No | No | Sí | Sí |

El backend permite al supervisor consultar ciertos datos de usuarios y auditoría necesarios para operación, aunque esas pantallas no aparecen en su navegación.

`isSystemOwner` omite las restricciones de `RolesGuard`. `ADMIN` sigue limitado a su `companyId`.

## 5. API

Todas las rutas se prefijan con `/api`.

### Auth

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/auth/login` | Público |
| GET | `/auth/status` | Público |
| GET | `/auth/me` | JWT |
| POST | `/auth/logout` | JWT |
| PATCH | `/auth/change-password` | JWT |

### Companies

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/companies/status` | JWT |
| GET | `/companies/me` | JWT |
| GET | `/companies/settings` | JWT |
| PATCH | `/companies/settings` | DUENO, ADMIN |
| GET | `/companies/access-matrix` | JWT |

La configuración incluye umbrales de desvío, checklist de entrega, prefijo de órdenes y prioridad predeterminada.

### Users

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/users/status` | JWT |
| GET | `/users` | DUENO, SUPERVISOR, ADMIN |
| POST | `/users` | DUENO, ADMIN |
| PATCH | `/users/toggle-active` | DUENO, ADMIN |
| PATCH | `/users/:id/role` | DUENO, ADMIN |
| PATCH | `/users/:id/profile` | DUENO, ADMIN |
| PATCH | `/users/:id/password` | DUENO, ADMIN |
| DELETE | `/users/:id` | DUENO, ADMIN |

Las cuentas protegidas y el propietario del sistema tienen restricciones adicionales en el service.

### Clients

| Método | Ruta |
|---|---|
| GET | `/clients/status` |
| GET | `/clients` |
| GET | `/clients/:id` |
| POST | `/clients` |
| PATCH | `/clients/:id` |
| DELETE | `/clients/:id` |
| POST | `/clients/:id/contacts` |
| PATCH | `/clients/:id/contacts/:contactId` |
| DELETE | `/clients/:id/contacts/:contactId` |

Requieren DUENO, SUPERVISOR o ADMIN.

### Orders

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/orders/status` | Estado del módulo |
| GET | `/orders/stats` | Estadísticas |
| GET | `/orders` | Listado y filtros |
| GET | `/orders/:id` | Detalle completo |
| POST | `/orders` | Crear presupuesto u orden |
| PATCH | `/orders/:id` | Editar |
| PATCH | `/orders/:id/commercial-status` | Cambiar estado comercial |
| PATCH | `/orders/:id/production-status` | Cambiar estado productivo |
| POST | `/orders/:id/approve` | Aprobar y habilitar producción |
| POST | `/orders/:id/assignments` | Asignar recurso u operario; admite `orderStageId` |
| PATCH | `/orders/:id/assignments/:assignmentId` | Editar responsable o etapa mediante `orderStageId` |
| DELETE | `/orders/:id/assignments/:assignmentId` | Quitar asignación |
| POST | `/orders/:id/events` | Registrar evento |
| POST | `/orders/:id/consumptions` | Registrar consumo |
| PATCH | `/orders/:id/consumptions/:consumptionId` | Editar consumo |
| DELETE | `/orders/:id/consumptions/:consumptionId` | Eliminar consumo |
| POST | `/orders/:id/close-delivery` | Cerrar entrega |
| POST | `/orders/:id/attachments` | Subir archivo |
| PATCH | `/orders/:id/attachments/:attachmentId` | Editar metadatos |
| DELETE | `/orders/:id/attachments/:attachmentId` | Eliminar archivo |
| DELETE | `/orders/:id` | Eliminar orden cuando las reglas lo permiten |

Lectura y gestión general: DUENO, SUPERVISOR y ADMIN. Eventos y consumos también admiten OPERARIO, pero el service valida su relación con la orden.

### Materials

| Método | Ruta |
|---|---|
| GET | `/materials/status` |
| GET | `/materials` |
| POST | `/materials` |
| PATCH | `/materials/:id` |
| POST | `/materials/:id/adjust-stock` |
| DELETE | `/materials/:id` |

### Resources

| Método | Ruta |
|---|---|
| GET | `/resources/status` |
| GET | `/resources` |
| POST | `/resources` |
| PATCH | `/resources/:id` |
| DELETE | `/resources/:id` |

### Operation logs

| Método | Ruta |
|---|---|
| GET | `/operation-logs/status` |
| GET | `/operation-logs` |
| GET | `/operation-logs/order/:orderId` |

### Reports

| Método | Ruta | Parámetros |
|---|---|---|
| GET | `/reports/status` | — |
| GET | `/reports/dashboard` | `months` o `from`/`to` |
| GET | `/reports/productivity` | — |

### Audit

`GET /audit-logs`

Filtros:

- `entityType`
- `action`
- `limit`, entre 1 y 200

Backend: DUENO, SUPERVISOR y ADMIN. Frontend: pantalla visible solamente para DUENO y ADMIN.

### AI assistant

Disponible para DUENO, SUPERVISOR y ADMIN.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/ai-assistant/conversations` | Lista las últimas 50 conversaciones del usuario autenticado |
| POST | `/ai-assistant/conversations` | Crea una conversación |
| GET | `/ai-assistant/conversations/:id` | Recupera una conversación con todos sus mensajes |
| DELETE | `/ai-assistant/conversations/:id` | Elimina una conversación y sus mensajes |
| POST | `/ai-assistant/conversations/:id/messages` | Envía un mensaje y persiste la respuesta |
| POST | `/ai-assistant/chat` | Compatibilidad con clientes anteriores; crea o continúa una conversación |

Todos los accesos se filtran simultáneamente por empresa y usuario del JWT. El
modelo no recibe ni puede elegir esos identificadores.

La integración usa Responses API con `store: false`, herramientas estrictas y
salida JSON Schema. Las consultas permitidas son resúmenes ejecutivos,
analítica productiva, búsqueda y detalle de órdenes e inventario de materiales.
No existe una herramienta de SQL libre ni operaciones de escritura.

La respuesta incluye:

- texto principal;
- evidencia enlazable a pantallas internas;
- contexto efectivamente consultado;
- advertencias y preguntas sugeridas;
- modelo, latencia e indicador de fallback.

La conversación completa permanece en PostgreSQL hasta que el usuario la
elimina, pero no se envía completa al proveedor. Cada turno utiliza una ventana
con los 12 mensajes más recientes y un máximo adicional de 24.000 caracteres,
priorizando siempre el final de la conversación. Se permiten como máximo tres
rondas de herramientas y una síntesis final sin nuevas consultas. La respuesta
está limitada a 1.800 tokens.

## 6. Modelo de datos

La entidad central es `Order`. Consultar [data-model.md](data-model.md) para el inventario completo.

No existen `Quotation` ni `WorkOrder` como modelos separados.

El historial del copiloto utiliza:

- `AiConversation`: propietario, empresa, título y fechas de actividad.
- `AiMessage`: rol, contenido, evidencia, contexto, sugerencias, advertencias,
  modelo, latencia y estado de fallback.

La eliminación de una conversación elimina sus mensajes en cascada.

## 7. Archivos adjuntos

- Endpoint multipart con campo `file`.
- Tamaño máximo: 10 MB.
- Destino: `./public/uploads`.
- URL almacenada: `/uploads/<archivo>`.
- Exposición: `/api/uploads/<archivo>`.

Limitación crítica: Compose no monta volumen para `public/uploads`.

## 8. Variables de entorno

```env
NODE_ENV=development
TZ=America/Buenos_Aires

POSTGRES_DB=DISAL_industria
POSTGRES_USER=DISAL_app
POSTGRES_PASSWORD=definir_secreto
POSTGRES_PORT=5433
DATABASE_URL=postgresql://DISAL_app:secreto@disal-db:5432/DISAL_industria?schema=public

BACKEND_PORT=3000
JWT_SECRET=secreto_largo_aleatorio
JWT_EXPIRES_IN=8h
CORS_ORIGIN=http://localhost:8081

OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

SYSTEM_OWNER_COMPANY_ID=seed_company_disal
SYSTEM_OWNER_USERNAME=admin@disal.local
SYSTEM_OWNER_FULL_NAME=Administrador DISAL INDUSTRIA METALURGICA
SYSTEM_OWNER_PASSWORD=definir_secreto

VITE_API_BASE_URL=/api
HTTP_PORT=8081
```

Notas:

- `SYSTEM_OWNER_COMPANY_ID` conserva temporalmente el ID del seed heredado.
- Compose usa `OPENAI_API_KEY`. Durante la transición también admite la variable heredada como fallback.
- No versionar `.env`.

## 9. Docker

```powershell
docker compose config --quiet
docker compose up --build -d
docker compose ps
```

Inicialización:

```powershell
docker compose exec disal-backend npm run prisma:migrate
docker compose exec disal-backend npm run prisma:seed
docker compose exec disal-backend npm run security:ensure-system-owner
```

Logs:

```powershell
docker compose logs -f disal-backend
docker compose logs -f disal-nginx
```

Detener:

```powershell
docker compose down
```

No usar `docker compose down -v` salvo que se quiera eliminar deliberadamente la base.

## 10. Migraciones

El comando actual `prisma:migrate` ejecuta:

1. normalización de enums;
2. `prisma db push`.

Esto no equivale a un flujo clásico `prisma migrate deploy`. Antes de producción conviene normalizar la estrategia de migraciones.

## 11. Backups

Ejemplo:

```powershell
docker compose exec -T disal-db pg_dump -U DISAL_app DISAL_industria > DISAL_backup.sql
```

Una copia no se considera válida hasta probar su restauración.

## 12. Limitaciones técnicas

- HTTP sin TLS.
- Adjuntos no persistentes ante recreación del backend.
- Calendario manual local al navegador.
- `/tv` visualmente público, datos protegidos por JWT.
- Sin refresh token.
- Sin recuperación de contraseña.
- Sin pruebas automatizadas suficientes para certificar rendimiento.
- Branding y seed heredados.
- Servicios Compose conservan nombres `DISAL-*`.
