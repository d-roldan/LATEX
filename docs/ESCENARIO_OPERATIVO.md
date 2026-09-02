# Escenario operativo DISAL

Escenario idempotente para comprender y probar el flujo de fabricación por etapas. No forma parte del seed limpio.

```powershell
docker compose exec -e DISAL_SAMPLE_PASSWORD="<password-local>" disal-backend npm run prisma:seed-disal-operational
```

El comando carga los datos operativos y, a continuación, los modelos, dependencias y etapas.

## Contenido

- 8 empresas cliente ficticias.
- 8 casillas activas, cada una con 12 etapas productivas.
- Modelos RC4400, RC4900 y RC6000 versionados.
- 5 operarios vinculados a recursos humanos.
- 10 recursos y 10 materiales.
- Asignaciones por etapa, dependencias, avances y bloqueos reales.

## Casillas y trabajo en curso

| Orden | Cliente | Modelo | Avance representado | Etapas activas | Responsable |
|---|---|---|---|---|---|
| `DISAL-2026-0001` | Agropecuaria Los Ombúes | RC4400 | Producción iniciada | Chasis | Martín Acosta |
| `DISAL-2026-0002` | Estancia La Esperanza | RC4900 | Techo completo | Eléctrica | Diego Ferreyra |
| `DISAL-2026-0003` | Servicios Ganaderos del Sur | RC6000 | Producción pausada | Paredes pausada | Nicolás Gómez |
| `DISAL-2026-0004` | Agrotransportes del Centro | RC4400 | Preparada para producción | Sin etapa activa | Lucas Benítez como asignación general |
| `DISAL-2026-0005` | Cabaña Santa Rosa | RC4900 | Componentes estructurales listos | Pintura | Sebastián Ríos |
| `DISAL-2026-0006` | Cooperativa Rural Norte | RC6000 | Fabricación paralela | Paredes y Aberturas | Martín Acosta / Lucas Benítez |
| `DISAL-2026-0007` | Campos del Horizonte | RC4400 | Techo completo | Eléctrica y Sanitaria | Diego Ferreyra / Nicolás Gómez |
| `DISAL-2026-0008` | Establecimiento Don Raúl | RC4900 | Terminaciones completas | Control de Calidad | Sebastián Ríos |

`ARMADO` permanece bloqueada hasta completar las ocho ramas requeridas. Luego se habilitan secuencialmente Terminaciones, Control de Calidad y Entrega.

## Operadores

| Usuario | Especialidad |
|---|---|
| `martin.acosta@disal.local` | Estructuras y soldadura |
| `lucas.benitez@disal.local` | Aberturas y carpintería metálica |
| `diego.ferreyra@disal.local` | Instalaciones eléctricas |
| `nicolas.gomez@disal.local` | Aislación y revestimientos |
| `sebastian.rios@disal.local` | Pintura y terminación |

La contraseña se recibe mediante `DISAL_SAMPLE_PASSWORD` y nunca se guarda en el repositorio.
