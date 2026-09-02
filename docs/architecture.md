# Arquitectura del sistema — DISAL INDUSTRIA METALÚRGICA

## Descripción

El sistema es un monolito modular desplegado mediante Docker Compose. No utiliza microservicios: existe una aplicación backend NestJS, una SPA React, una base PostgreSQL y un reverse proxy Nginx.

```text
Navegador
   |
   v
Nginx :HTTP_PORT
   |-- /*      --> Frontend Nginx interno --> React SPA
   `-- /api/* --> NestJS :3000 --> Prisma --> PostgreSQL :5432
```

## Frontend

Ubicación: `apps/frontend`.

- React 18 y TypeScript.
- Vite como herramienta de build.
- React Router v6.
- TanStack Query para estado remoto, caché y refresco.
- Axios con interceptor JWT.
- Recharts para gráficos.
- CSS global, Tailwind y componentes propios.

Las rutas se definen en `src/app/router/AppRouter.tsx`. La autorización visual usa `ProtectedRoute`; la seguridad definitiva se aplica siempre en el backend.

### Rutas

| Ruta | Roles |
|---|---|
| `/login` | Pública |
| `/tv` | Componente público; los datos requieren JWT |
| `/` | Usuario autenticado; la navegación normal la usa gestión |
| `/supervisor` | DUENO, SUPERVISOR, ADMIN |
| `/clients` | DUENO, SUPERVISOR, ADMIN |
| `/orders` | DUENO, SUPERVISOR, ADMIN |
| `/resources` | DUENO, SUPERVISOR, ADMIN |
| `/materials` | DUENO, SUPERVISOR, ADMIN |
| `/reports` | DUENO, SUPERVISOR, ADMIN |
| `/calendar` | DUENO, SUPERVISOR, ADMIN |
| `/ai-assistant` | DUENO, SUPERVISOR, ADMIN |
| `/users` | DUENO, ADMIN |
| `/audit` | DUENO, ADMIN |
| `/operator` | Todos los roles autenticados |

## Backend

Ubicación: `apps/backend`.

NestJS organiza el código por dominios:

- `auth`
- `companies`
- `users`
- `clients`
- `orders`
- `cabin-models`
- `resources`
- `operation-logs`
- `materials`
- `reports`
- `audit`
- `ai-assistant`

Preocupaciones transversales:

- JWT mediante `JwtAuthGuard`.
- Permisos mediante `RolesGuard` y `@Roles`.
- Validación global con transformación, whitelist y rechazo de campos no declarados.
- Throttle global de 120 solicitudes por minuto por sesión autenticada o IP, con límites específicos para login, IA y adjuntos.
- Login limitado a 5 intentos por minuto por IP.
- Prefijo global `/api`.

## Persistencia

PostgreSQL 16 y Prisma 5.

El aislamiento lógico se realiza con `companyId`. Las consultas de negocio reciben el `companyId` del JWT. Esto prepara una evolución multiempresa, pero no constituye todavía una plataforma SaaS ni permite a `ADMIN` operar globalmente entre empresas.

La entidad central es `Order`, que contiene dos fases opcionales:

- Comercial: presupuesto, vigencia, ítems, horas y aprobación.
- Producción: modelo versionado de casilla, grafo de etapas, responsables, sesiones de trabajo, consumos y entrega.

El catálogo se compone de `CabinModel`, `CabinModelRevision`, `CabinStageTemplate` y `CabinStageDependency`. Al crear una casilla, el backend copia esa revisión a `OrderStage` y `OrderStageDependency`; por eso los cambios futuros de plantilla no reescriben el historial.

La transición de una etapa se valida en el backend. Al completar una etapa se liberan las sucesoras cuyos prerrequisitos estén completos, se recalcula el avance ponderado y se deriva el estado global de la orden. `ARMADO` funciona como barrera de sincronización de las ocho ramas de fabricación e instalaciones.

## Archivos

Los adjuntos se guardan en `apps/backend/public/uploads` dentro del contenedor y se sirven bajo `/api/uploads`.

Limitación: Docker Compose no monta actualmente un volumen para esa carpeta. Antes de producción debe agregarse persistencia o almacenamiento externo.

## Calendario

- Compromisos de órdenes: derivados de `Order.commitmentDate`.
- Eventos manuales y recurrencias: guardados en `localStorage`.

Los eventos manuales no se sincronizan entre usuarios, navegadores ni dispositivos.

## Copiloto IA

El copiloto conserva conversaciones por usuario y empresa. Cada respuesta se
guarda con su evidencia, fuentes de contexto, advertencias, sugerencias, modelo
y latencia para poder auditar qué vio el usuario.

- Con `OPENAI_API_KEY`: usa Responses API y herramientas tipadas para consultar
  el contexto estrictamente necesario.
- Sin clave o ante una falla externa: produce un resumen ejecutivo local de
  respaldo y lo identifica como tal.
- Las herramientas disponibles consultan reportes, producción, órdenes y
  materiales mediante Prisma y servicios internos.
- `companyId` y `userId` siempre provienen del JWT. No se aceptan desde el
  mensaje ni desde los argumentos generados por el modelo.
- No ejecuta SQL libre, no modifica datos operativos y no entrega al modelo una
  conexión de base de datos.
- La salida es estructurada: respuesta, evidencia navegable, limitaciones y
  preguntas de seguimiento.

La ventana muestra historial persistente, estados de procesamiento, modo de
solo lectura, acceso a los registros citados y una adaptación responsive.

## Infraestructura

Servicios de Compose:

- `disal-db`: PostgreSQL.
- `disal-backend`: API NestJS.
- `disal-frontend`: build React servido por Nginx interno.
- `disal-nginx`: reverse proxy exterior.

Los nombres de servicio conservan temporalmente el prefijo heredado `DISAL`; los contenedores locales usan nombres `DISAL-*`.

PostgreSQL y los adjuntos tienen volúmenes persistentes (`postgres_data` y `uploads_data`). Nginx escucha HTTP; HTTPS no está implementado.

## Seguridad y límites

- JWT con expiración configurable.
- Sin refresh token.
- Revocación de JWT mediante `sessionVersion` persistente para bajas, cambios de rol y cambios de contraseña.
- CORS por lista de orígenes.
- Contraseñas con bcrypt 6 y longitud de 6 a 72 caracteres; para cuentas privilegiadas se recomienda usar 12 o más.
- Cuenta de propietario protegida.
- Auditoría de acciones sensibles.
- Rate limiting global de 120 solicitudes por minuto por sesión autenticada o IP; los excesos reciben `429`.
- Login limitado a 5 intentos por minuto por IP.
- Bloqueo persistente de 15 minutos después de 5 contraseñas incorrectas consecutivas, o 10 para `ADMIN` y `DUENO`; el contador se reinicia al autenticar correctamente.
- IA limitada a 5 solicitudes por minuto, 2 ejecuciones simultáneas por usuario y 60 segundos por llamada externa.
- Adjuntos privados fuera del webroot, con descarga autenticada, aislamiento por empresa, visibilidad por rol, lista de formatos y límite de 10 MB.
- Nginx agrega límites por IP y por conexiones antes de que el tráfico alcance NestJS.
- Docker Compose restringe CPU, memoria y procesos de los servicios principales.
- El backend corre sin privilegios, con filesystem de solo lectura y volumen de escritura exclusivo para adjuntos.
- No hay recuperación automática de contraseña.
- La ruta frontend `/tv` debe revisarse antes de exponer la aplicación.
