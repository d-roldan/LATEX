---
name: e2e-test
description: Ejecuta o actualiza el test E2E de Playwright del flujo completo de produccion. Usar cuando se hagan cambios al flujo principal (presupuesto → OT → trabajo → aprobacion), al agregar features nuevas, o para verificar que el sistema funciona end-to-end antes de una entrega o deploy.
---

# Skill: Test E2E — Flujo Completo de Produccion

Verifica el ciclo completo del sistema ejecutando un test automatizado con Playwright en modo visual (headless: false), simulando datos reales de contexto metalurgico/industrial.

---

## Requisitos previos

Antes de ejecutar, verificar:

1. **Stack Docker corriendo**
   ```bash
   docker compose ps
   ```
   Deben estar `Up` y `healthy`: `disal-backend`, `disal-db`, `disal-frontend`, `disal-nginx`.

2. **Seed ejecutado** (datos demo en la DB)
   ```bash
   docker compose exec disal-backend npm run prisma:seed
   ```
   Si ya fue ejecutado previamente y falla con `Unique constraint`, esta bien — los datos ya existen.

3. **Migracion de schema actualizada** (si hubo cambios en schema.prisma)
   ```bash
   docker compose exec disal-backend npm run prisma:migrate
   ```
   Esto aplica: normalizacion de enums + `prisma db push`.

4. **Dependencias E2E instaladas**
   ```bash
   cd e2e && npm install && npx playwright install chromium
   ```

---

## Ejecutar el test

```bash
cd e2e && node flujo-completo.js
```

El navegador se abre en modo visible. El test tarda ~2-3 minutos. La salida en consola muestra el progreso paso a paso.

---

## Flujo que cubre el test

| Paso | Rol | Accion | Estado resultante |
|------|-----|--------|-------------------|
| 1 | Owner | Login | — |
| 2 | Owner | Crear presupuesto (Bridas DN200 PN16) | APROBADO |
| 3 | Owner | Verificar estado del presupuesto | — |
| 4 | Owner | Convertir presupuesto → OT | OT PENDIENTE |
| 5 | Owner | Asignar operario a la OT | OT PLANIFICADA |
| 6 | Operario | Login (Diego Fresador) | — |
| 7 | Operario | Iniciar trabajo en Mi Turno | OT EN_PROCESO |
| 8 | Operario | Entregar trabajo a supervision | OT FINALIZADA |
| 9 | Owner | Aprobar y cerrar OT (remito) | OT ENTREGADA |

---

## Credenciales de demo

| Rol | Email | Password |
|-----|-------|----------|
| Dueno/Owner | `owner@disal.local` | `ChangeMe123!` |
| Operario (con recurso) | `diego@disal.local` | `ChangeMe123!` |
| Supervisor | `supervisor@disal.local` | `ChangeMe123!` |
| Operario 1 (sin recurso) | `oper1@disal.local` | `ChangeMe123!` |

---

## Features implementadas (revision 2026-03-25)

### Presupuestos — Mejoras completas

#### 1. Botonera de validez del presupuesto
- Botonera rapida con opciones **+15d, +20d, +30d** que setea automaticamente `validUntil`
- Se muestra encima del campo de fecha de vencimiento en el formulario de creacion/edicion
- Al clickear un boton, calcula la fecha desde hoy y la asigna

#### 2. Tiempo de entrega estimado
- Nuevo campo `deliveryTimeDays` en la base de datos (Quotation model)
- Botonera rapida con opciones **+15d, +30d, +45d, +60d** para el tiempo estimado de entrega
- Se muestra en la tabla principal como columna "Entrega"
- Visible en el modal de gestion del presupuesto

#### 3. Nuevo estado VENCIDO
- Agregado al enum `QuotationStatus` en Prisma: `VENCIDO`
- El frontend detecta automaticamente presupuestos con `validUntil` expirado y los muestra como VENCIDO aunque no tengan el estado explicito
- Funcion `getDisplayStatus()` resuelve el estado visual combinando el estado de la DB con la fecha de validez
- Se puede filtrar por VENCIDO en la tabla
- Se puede setear manualmente desde el modal de gestion

#### 4. Colores de estados
Cada estado tiene un color visual consistente:
| Estado | Color | Badge |
|--------|-------|-------|
| BORRADOR | Gris (#6b7280) | default |
| ENVIADO | Naranja (#f59e0b) | warning |
| APROBADO | Verde (#10b981) | success |
| RECHAZADO | Rosa (#ef5d74) | destructive |
| VENCIDO | Rojo (#dc2626) | destructive |

#### 5. Horas estimadas de costeo (Costeo General)
- Nuevo modelo `CostingHour` en Prisma con: `label`, `hours`, `ratePerHour`, `position`
- Sub-items en la seccion "Costeo General" del formulario de presupuesto
- Presets rapidos: Soldadura, Pintura, Torneado, Mecanizado, Montaje, Plegado, Corte, Pulido
- Cada hora tiene: tipo de trabajo, cantidad de horas, valor por hora
- Total calculado automaticamente: `sum(hours * ratePerHour)`
- Visible en el modal de gestion como "Horas Estimadas de Costeo"

#### 6. Sistema de tickets de presupuestos
- Dashboard visual en la parte superior de la pagina de presupuestos
- Muestra contadores por estado: Total, Borradores, Enviados, Aprobados, Rechazados, Vencidos
- Muestra Abiertos vs Cerrados con separador visual
- Endpoint backend: `GET /quotations/stats` que calcula los conteos

#### 7. Validacion de presupuesto vencido al convertir a OT
- El backend ahora rechaza la conversion de presupuestos vencidos con error:
  `"Presupuesto vencido — no se puede convertir a OT"`
- Validacion en `work-orders.service.ts > createFromQuotation()`

### Reportes — Presupuestos generados vs cerrados

#### Grafico comparativo
- Nueva seccion en ReportsPage entre los KPIs y el cuerpo del reporte
- Dos tarjetas:
  1. **Presupuestos: Generados vs Cerrados** — barra visual con porcentaje de cierre y tasa
  2. **Desglose por Estado** — barras horizontales por estado con conteo
- Datos vienen del endpoint `GET /quotations/stats`
- Tasa de cierre mostrada como porcentaje grande con color dinamico

### Calendario — Eventos repetitivos y mejoras

#### 1. Eventos repetitivos
- Nuevo campo `recurrence` en eventos manuales con opciones:
  - No se repite
  - Todos los dias
  - Cada semana
  - Cada 2 semanas
  - Cada mes
- Configuracion de fin: por fecha limite o por cantidad maxima de repeticiones
- Instancias generadas dinamicamente al renderizar el calendario (no se almacenan)
- Icono de repeticion (Repeat) en los pills de eventos recurrentes
- Indicador visual con punto violeta (#8b5cf6) en eventos recurrentes

#### 2. Vista semanal
- Toggle de vista Mes/Semana en el header
- Vista semanal muestra 7 dias con celdas mas altas (500px) para ver mas detalle
- Navegacion por semana (prev/next avanza/retrocede 7 dias)

#### 3. Vista de detalle del dia
- Click en un dia abre un modal con todos los eventos de ese dia
- Muestra hora, titulo, descripcion
- Botones de editar/eliminar para eventos manuales
- Boton de agregar evento directamente desde el modal del dia
- Doble click en dia abre directamente el formulario de nuevo evento

#### 4. Mejoras visuales estilo Google Calendar
- Indicador de conteo de eventos cuando hay mas de 3 en un dia (badge circular)
- "+N mas" link cuando hay eventos ocultos en vista mensual
- Hover con efecto sutil y shadow en event pills
- Legend actualizada con badge de "Repetitivos"
- Dia actual con circulo azul mas prominente (26px)

---

## Aprendizajes criticos del sistema (no obvios en el codigo)

### 1. Relacion Usuario↔Recurso es por nombre — no por FK
El selector "Asignar Puesto" en la gestion de OT construye la lista de operarios disponibles buscando recursos cuyo `name` coincida exactamente (case-insensitive) con el `fullName` del usuario.

```js
// WorkOrdersPage.tsx ~linea 135
const r = res.find(x => x.name.trim().toLowerCase() === o.fullName.trim().toLowerCase());
```

**Consecuencia:** Si el usuario tiene un fullName que no coincide exactamente con ningun recurso HUMANO, no aparece en el selector y no puede ser asignado. `oper1@disal.local` (Matias Tornero) no tiene recurso matching y no puede ser asignado desde la UI.

**Operarios con recurso valido (seed):**
- `diego@disal.local` → Diego Fresador
- `lucas@disal.local` → Lucas Tornero
- `nicolas@disal.local` → Nicolas Soldador
- `ezequiel@disal.local` → Ezequiel Armador

### 2. El operario solo ve OTs asignadas a su userId
La pagina Mi Turno filtra con `?assignedToMe=true`. Si el operario que inicia sesion no tiene el `userId` de la asignacion, no ve la OT aunque sea su recurso.

### 3. El campo del token JWT es `accessToken` (no `access_token`)
La respuesta de `POST /api/auth/login` devuelve `{ accessToken: "...", user: {...} }`.
Si se consume la API directamente, usar `body.accessToken`.

### 4. El manage modal de presupuesto tiene race condition
Cuando se cambia el estado via "Fijar Estado" y luego se intenta usar "Convertir a OT" en el mismo modal abierto, el boton puede aparecer disabled porque `invalidateQueries` y `setManagedQuotation` compiten.

**Workaround aplicado en el test:** crear el presupuesto directamente en estado APROBADO desde el formulario de creacion (el select de estado esta disponible en el form).

### 5. El boton "Entregar Trabajo" no dice "Finalizar"
En Mi Turno, el boton para finalizar la operacion se llama **"Entregar Trabajo"** (no "Finalizar"). Aparece solo cuando la OT esta en estado `EN_PROCESO`.

### 6. Dos caminos de aprobacion final
- **Directo en tabla**: boton "Aprobar" → cambia status a `ENTREGADA` directamente. Solo aparece si OT esta en `FINALIZADA`.
- **Via gestion**: modal → seccion "Completar (Remito)" → "Aprobar y Finalizar (Cerrar OT)" → tambien lleva a `ENTREGADA` pero registra checklist, fecha y firma.

### 7. El seed puede fallar con Unique constraint — es normal
Si el seed ya fue ejecutado, vuelve a intentar upsert con IDs fijos y puede fallar en algunas entidades. Los datos del primer seed quedan intactos. No es un error bloqueante.

### 8. Presupuestos vencidos no pueden convertirse a OT
Validacion backend: si `validUntil < now()`, el endpoint `POST /work-orders/from-quotation/:id` rechaza con error 400. Esto previene la creacion de OTs desde presupuestos cuya validez comercial ha expirado.

### 9. Las horas de costeo son independientes de los sub-items
Los `CostingHour` (horas estimadas por tipo de trabajo) son un modelo separado de los `QuotationItem` (materiales/servicios). Un presupuesto puede tener ambos, solo uno, o ninguno. El total de horas de costeo se muestra por separado del costo de sub-items.

### 10. Eventos recurrentes del calendario son virtuales
Los eventos repetitivos se almacenan como un unico evento con regla de recurrencia en localStorage. Las instancias se generan dinamicamente al renderizar el calendario. Eliminar el evento padre elimina todas las repeticiones.

### 11. Rutas del sistema
| Pagina | URL | Roles |
|--------|-----|-------|
| Dashboard | `/` | Todos |
| Presupuestos | `/quotations` | SUPERVISOR, DUENO, ADMIN |
| Ordenes de Trabajo | `/work-orders` | SUPERVISOR, DUENO, ADMIN |
| Mi Turno | `/operator` | OPERARIO |
| Centro de Despacho | `/supervisor` | SUPERVISOR, DUENO, ADMIN |
| Clientes | `/clients` | SUPERVISOR, DUENO, ADMIN |
| Recursos | `/resources` | SUPERVISOR, DUENO, ADMIN |
| Materiales | `/materials` | SUPERVISOR, DUENO, ADMIN |
| Reportes | `/reports` | SUPERVISOR, DUENO, ADMIN |
| Calendario | `/calendar` | SUPERVISOR, DUENO, ADMIN |
| Usuarios | `/users` | DUENO, ADMIN |
| Auditoria | `/audit` | DUENO, ADMIN |

---

## Cambios en la base de datos (schema.prisma)

### Nuevos campos en Quotation
```prisma
deliveryTimeDays   Int?            // Tiempo estimado de entrega en dias
```

### Nuevo valor en QuotationStatus
```prisma
VENCIDO     // Vencido (validez expirada sin aprobacion)
```

### Nuevo modelo CostingHour
```prisma
model CostingHour {
  id          String    @id @default(cuid())
  quotationId String
  label       String    // Ej: "Soldadura", "Pintura", "Torneado"
  hours       Decimal   @db.Decimal(8, 2)
  ratePerHour Decimal   @db.Decimal(12, 2)
  position    Int       @default(0)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  quotation   Quotation @relation(...)
}
```

### Para aplicar los cambios
```bash
docker compose exec disal-backend npm run prisma:migrate
docker compose exec disal-backend npm run prisma:generate
```

---

## Endpoints API nuevos/modificados

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/quotations/stats` | Estadisticas de presupuestos (total, abiertos, cerrados, por estado) |
| POST | `/quotations` | Ahora acepta `deliveryTimeDays` y `costingHours[]` |
| PATCH | `/quotations/:id` | Ahora acepta `deliveryTimeDays` y `costingHours[]` |
| PATCH | `/quotations/:id/status` | Ahora acepta `VENCIDO` como estado valido |

---

## Estructura del test E2E

```
e2e/
├── flujo-completo.js    # Script principal Playwright (Node.js puro, sin framework)
├── package.json         # { playwright: ^1.x }
└── package-lock.json
```

El test usa Playwright directamente (sin `@playwright/test`) para simplificar la ejecucion con `node flujo-completo.js`. No requiere configuracion adicional.

---

## Si el test falla

| Sintoma | Causa probable | Solucion |
|---------|---------------|---------|
| "No hay clientes en la base de datos" | Seed no ejecutado | `docker compose exec disal-backend npm run prisma:seed` |
| "Boton Iniciar no visible" | Operario sin recurso matching | Usar `diego@disal.local` como operario |
| "Boton Confirmar sigue deshabilitado" | Race condition del manage modal | Crear presupuesto directamente en APROBADO |
| "Rate limit reached" | Limite de uso agotado | Esperar ~5 horas o usar API key propia |
| Stack no responde | Docker caido | `docker compose up -d` |
| "column does not exist" | Schema no migrado | `docker compose exec disal-backend npm run prisma:migrate` |

---

## Ampliar el test

Para agregar nuevos pasos al flujo (ej: registro de consumo de materiales, retrabajo):

1. Agregar la funcion despues del paso correspondiente en `e2e/flujo-completo.js`
2. Usar el patron existente: `esperar()` + selector con `locator().filter({ hasText })` + `isVisible()` con fallback
3. Actualizar la tabla de flujo en este SKILL.md
4. Correr el test completo para verificar que no se rompio nada previo

## Idioma
- Toda comunicacion en **espanol**
