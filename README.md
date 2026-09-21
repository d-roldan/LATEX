# DISAL · Control de Planta de Látex

Sistema web industrial para operar y supervisar los nueve tanques `TK101`–`TK109` de DISAL. Coordina Fabricación, Laboratorio y Envasado, ofrece monitoreo en tiempo real y conserva la trazabilidad histórica de cada lote y cambio de estado.

# Panel de control
![image](https://github.grupodisal.com.ar/user-attachments/assets/197821bb-6200-45f8-8d8b-57e4de2fc424)

# Seguimiento histórico
![image](https://github.grupodisal.com.ar/user-attachments/assets/9f2a7ea8-4e5b-4093-b729-5a5b2bfd7607)

## Funcionalidad principal

- Paneles independientes para Fabricación, Laboratorio, Envasado, Monitoreo y Jefatura.
- Acceso por usuario y rol, con autorización validada también en el backend.
- Administrador con acceso integral, historial y gestión de usuarios.
- Máquina de estados transaccional con control de concurrencia por versión.
- Registro de OF, material, descripción, análisis de calidad, peso específico, OE, línea y formato.
- Historial de estados y auditoría de correcciones con usuario, fecha, motivo y valores anterior/nuevo.
- Recepción de pesos desde Node-RED aproximadamente cada dos segundos.
- Pesos conservados sólo en memoria: las muestras de balanza no se escriben en PostgreSQL.
- Interfaz responsive, menú lateral desplegable, confirmaciones internas y modo pantalla completa.
- Vista Full HD de nueve tanques y reloj sin desplazamiento vertical.
- Vista pública de sólo lectura para televisores, con planta explícita en `/tv?plant=CODIGO`.
- Notificaciones por sector con sonido configurable, navegación y resaltado del tanque involucrado.
- Duración visible por estado, semáforos configurables y línea temporal completa por OF.
- Resumen diario para reunión, cierre persistido y exportación PDF/Excel.
- Registro de cantidad planificada, turno, prioridad, kilogramos envasados, unidades y merma.
- Fotografías puntuales del peso en cada transición, sin persistir la telemetría continua.

## Tanques

| Tanque | Identificador de balanza |
|---|---|
| TK101 | `TK101` |
| TK102 | `TK102` |
| TK103 | `TK103` |
| TK104 | `TK104` |
| TK105 | `TK105` |
| TK106 | `TK106` |
| TK107 | `TK107` |
| TK108 | `TK108` |
| TK109 | `TK109` |

Las capacidades se calculan con una densidad máxima de diseño de `1,5 kg/L`: TK101–TK102 (40.000 L) admiten 60.000 kg; TK103–TK104 (30.000 L), 45.000 kg; TK105–TK107 (20.000 L), 30.000 kg; y TK108–TK109 (7.000 L), 10.500 kg.

## Flujo operativo

```text
VACÍO → FABRICANDO → LABORATORIO → APROBADO → ENVASANDO → VACÍO
                         │
                         ├─→ AJUSTE → LABORATORIO
                         └─→ RECHAZADO → VACÍO

VACÍO ↔ FUERA DE SERVICIO
```

| Rol | Permisos principales |
|---|---|
| `FABRICACION` | Iniciar lotes, corregir datos, enviar a laboratorio y gestionar servicio |
| `LABORATORIO` | Aprobar, solicitar ajuste o rechazar |
| `ENVASADO` | Iniciar/cambiar OE y finalizar el proceso |
| `MONITOREO` | Consultar planta e históricos sin modificar el proceso |
| `JEFATURA` | Resumen diario, monitoreo, historial, cierres y exportaciones sin operar tanques |
| `ADMIN` | Acceso completo y administración de usuarios |

## Pantalla pública para televisores

La vista `/tv` no selecciona una planta por omisión. Al abrirla sin parámetros muestra las plantas disponibles para configurar el televisor. La dirección elegida debe conservarse como favorito o página de inicio del dispositivo:

| Planta | Dirección |
|---|---|
| Látex | `/tv?plant=LATEX` |
| Terplast | `/tv?plant=TERPLAST` |
| Slurry | `/tv?plant=SLURRY` |
| Enduido | `/tv?plant=ENDUIDO` |

El nombre y el código de la planta permanecen visibles en el encabezado. `/monitoreo?plant=CODIGO` redirige a la misma pantalla sin perder el parámetro.

## Tecnología

- Frontend: React 18, TypeScript, Vite y TanStack Query.
- Backend: NestJS 10, Prisma, JWT y validación de DTO.
- Base de datos: PostgreSQL 16.
- Infraestructura: Docker Compose y Nginx.

## Inicio rápido

Requisitos: Docker Desktop con Docker Compose.

```powershell
Copy-Item .env.example .env
```

Editar `.env` y definir contraseñas y claves seguras. Luego ejecutar:

```powershell
docker compose up -d --build
docker compose exec disal-backend npm run prisma:migrate
docker compose exec disal-backend npm run prisma:seed
docker compose exec disal-backend npm run security:ensure-system-owner
```

Abrir `http://localhost:<HTTP_PORT>`. El puerto predeterminado sugerido es `8081`.

Servicios resultantes:

- `disal-db`
- `disal-backend`
- `disal-frontend`
- `disal-nginx`
- `disal-node-red`

Durante el arranque también se ejecutan `disal-uploads-init` y `disal-migrate`. Ambos deben terminar con código `0`; no son servicios permanentes. La función, tecnología y comunicación de cada contenedor se explican en [Arquitectura de contenedores](docs/ARQUITECTURA_CONTENEDORES.md).

## Integración de pesos

Node-RED debe enviar un lote JSON a:

```text
POST /api/plant/telemetry/weights
Content-Type: application/json
X-Node-Red-Key: <NODE_RED_API_KEY>
```

Ejemplo mínimo:

```json
{
  "readings": [
    { "scaleKey": "TK101", "grossKg": 5070.125 },
    { "scaleKey": "TK102", "grossKg": 5950.000 }
  ]
}
```

El endpoint admite entre 1 y 100 lecturas por solicitud. Una balanza se marca sin señal después de 10 segundos sin nuevas lecturas.

El Compose incluye un Node-RED de prueba en `http://localhost:1880`. Su flujo **Simulador de pesos DISAL** sólo transmite cuando `DISAL_ENABLE_WEIGHT_SIMULATOR=true`; el valor predeterminado es `false`. Desde el editor se puede modificar el flujo o usar sus inyectores manuales, pero el simulador no debe habilitarse en un entorno conectado a señales reales.

## Documentación

- [Índice de documentación](docs/README.md)
- [Contexto real de la planta](CONTEXTO_PLANTA_LATEX.md)
- [Contexto y alcance integral](CONTEXTO_Y_ALCANCE_PROYECTO.md)
- [Especificación funcional](ESPECIFICACION_FUNCIONAL_PLANTA.md)
- [Requisitos funcionales y evolución recomendada](docs/REQUIREMENTS.md)
- [Instructivo de integración y base de datos](docs/INSTRUCTIVO_INTEGRACION_Y_BASE_DE_DATOS.md)
- [Arquitectura y función de los contenedores](docs/ARQUITECTURA_CONTENEDORES.md)
- [Contrato detallado de Node-RED](docs/NODE_RED_PESOS.md)
- [Consultas históricas PostgreSQL](docs/CONSULTAS_HISTORICAS.md)
- [API y transiciones operativas](docs/OPERACION_PLANTA.md)
- [Historial de versiones](docs/releases/README.md)

## Verificación

```powershell
Set-Location apps/backend
npm run build
npm test -- --runInBand

Set-Location ../frontend
npm run build
```

Estado verificado de esta versión:

- Backend compilado.
- Frontend compilado para producción.
- 52 pruebas automatizadas aprobadas.
- Stack Docker operativo y API saludable.

## Seguridad y respaldo

- `.env`, claves privadas, certificados y documentación privada están excluidos de Git.
- Las contraseñas de usuarios se almacenan mediante hash; nunca en texto plano.
- La base sólo se publica en `127.0.0.1` de forma predeterminada.
- Antes de cada despliegue o migración se debe generar y probar un respaldo PostgreSQL.
- No se deben reutilizar las credenciales de desarrollo en producción.

## Licencia

Software de uso interno de DISAL. No se concede permiso de distribución o explotación fuera de la organización sin autorización expresa.
