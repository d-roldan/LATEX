# Especificación funcional · Control de Planta de Látex DISAL

## 1. Propósito

Esta especificación define el comportamiento funcional del sistema que representa, opera y audita los tanques de la planta de látex DISAL. El backend es la fuente de verdad del proceso; las interfaces solicitan operaciones, pero no pueden modificar estados por sí solas.

## 2. Alcance

El sistema incluye autenticación y autorización por rol, operación sectorial, monitoreo general, administración de usuarios, estado actual e histórico de nueve tanques, recepción de pesos desde Node-RED y auditoría de cambios.

Quedan fuera del alcance actual:

- Configuración definitiva de capacidades; se completará al conocer las dimensiones reales.
- Persistencia de las muestras de peso.
- Comandos de TARA y CERO.
- Automatización directa sobre válvulas, bombas o balanzas.

## 3. Equipos controlados

La instalación contiene exactamente nueve tanques:

| Orden | Nombre | `scaleKey` | Capacidad nominal | Máximo en pantalla |
|---:|---|---|---:|---:|
| 1 | TK101 | `TK101` | 40.000 L | 60.000 kg |
| 2 | TK102 | `TK102` | 40.000 L | 60.000 kg |
| 3 | TK103 | `TK103` | 30.000 L | 45.000 kg |
| 4 | TK104 | `TK104` | 30.000 L | 45.000 kg |
| 5 | TK105 | `TK105` | 20.000 L | 30.000 kg |
| 6 | TK106 | `TK106` | 20.000 L | 30.000 kg |
| 7 | TK107 | `TK107` | 20.000 L | 30.000 kg |
| 8 | TK108 | `TK108` | 7.000 L | 10.500 kg |
| 9 | TK109 | `TK109` | 7.000 L | 10.500 kg |

La capacidad máxima en kilogramos se calcula con el factor conservador `1,5 kg/L` indicado para el peso específico del producto.

Cada tanque posee identificador interno, empresa, número, nombre, `scaleKey`, capacidad opcional, estado, versión de concurrencia, lote activo y fechas de creación/actualización.

## 4. Roles y pantallas

| Rol | Pantalla inicial | Alcance |
|---|---|---|
| `FABRICACION` | Fabricación | Operaciones de elaboración y servicio |
| `LABORATORIO` | Laboratorio | Decisiones de calidad |
| `ENVASADO` | Envasado | Órdenes y cierre de envasado |
| `MONITOREO` | Monitoreo | Consulta de planta e historial |
| `JEFATURA` | Resumen diario | Reunión diaria, monitoreo, trazabilidad, cierres y exportaciones |
| `ADMIN` | Administración | Acceso a todas las pantallas y usuarios |

Las rutas y botones respetan el rol, pero la autorización definitiva se realiza en cada endpoint del backend. Una petición directa sin permiso debe responder `403`.

## 5. Estados

Estados admitidos: `VACIO`, `FABRICANDO`, `LABORATORIO`, `AJUSTE`, `RECHAZADO`, `APROBADO`, `ENVASANDO` y `FUERA_DE_SERVICIO`.

### 5.1 Flujo normal

```text
VACIO → FABRICANDO → LABORATORIO → APROBADO → ENVASANDO → VACIO
```

### 5.2 Caminos alternativos

```text
LABORATORIO → AJUSTE → LABORATORIO
LABORATORIO → RECHAZADO → VACIO
VACIO → FUERA_DE_SERVICIO → VACIO
```

No se permite sacar de servicio un tanque con lote activo. Mientras se encuentra fuera de servicio no se puede iniciar una fabricación.

## 6. Reglas generales

Toda operación que modifica información debe:

1. Autenticar al usuario y autorizar su rol.
2. Leer el tanque dentro de la empresa del usuario.
3. Verificar el estado de origen.
4. Comparar la versión recibida con la vigente.
5. Ejecutar el cambio dentro de una transacción.
6. Cerrar el período histórico anterior y abrir el nuevo.
7. Registrar auditoría cuando corresponda.
8. Incrementar la versión del tanque.
9. Devolver el resultado confirmado por el backend.

Si otra operación modificó el tanque primero, la solicitud desactualizada responde `409` y la pantalla refresca los datos.

Las confirmaciones se muestran mediante diálogos propios de la aplicación. No se permiten alertas o confirmaciones nativas del navegador. Al abrirse, el diálogo lleva el foco al primer control útil, contiene el recorrido con `Tab` y `Shift+Tab`, permite cerrar con `Escape` cuando la operación no está guardándose y devuelve el foco al control que lo abrió.

## 7. Fabricación

### 7.1 Inicio

Sólo puede iniciarse desde `VACIO`. El formulario requiere OF de exactamente 8 dígitos, código de SEMI de exactamente 6 dígitos y descripción de hasta 180 caracteres.

Al confirmar se crea un `ProductionLot`, se asocia como lote activo, el tanque cambia a `FABRICANDO`, se abre el histórico y se audita la creación.

### 7.2 Envío a laboratorio

Desde `FABRICANDO` o `AJUSTE`, Fabricación puede enviar el lote a `LABORATORIO`. La OF, material y descripción se conservan.

### 7.3 Corrección del lote

Fabricación puede corregir OF, material o descripción sin crear un lote nuevo. Debe indicar un motivo obligatorio. La auditoría conserva valores anterior y nuevo, usuario y fecha.

### 7.4 Rechazado y servicio

Un tanque `RECHAZADO` puede registrarse como vaciado, finalizando el lote y volviendo a `VACIO`. Desde `VACIO` se puede marcar `FUERA_DE_SERVICIO` con motivo obligatorio, limitado a `Mantenimiento` o `Lavado`, y observaciones opcionales de hasta 500 caracteres; desde allí sólo puede volver a servicio.

## 8. Laboratorio

Laboratorio sólo puede actuar sobre un tanque en estado `LABORATORIO`.

### 8.1 Aprobación

Requiere legajo de exactamente 6 dígitos y peso específico mayor que cero, con máximo 3 decimales. Cambia el tanque a `APROBADO` y actualiza el lote.

### 8.2 Ajuste

El resultado `AJUSTE` requiere seleccionar uno o más motivos de proceso y cargar una lista de uno o más materiales. Cada material registra su número y la cantidad positiva en kilogramos, con hasta 3 decimales. Laboratorio puede agregar tantos renglones como necesite y, mientras el tanque permanezca en `AJUSTE`, puede reabrir la solicitud en un diálogo con los datos precargados para corregir motivos, materiales o cantidades. La corrección reemplaza la solicitud vigente, incrementa la versión operativa y queda auditada. La tarjeta de Fabricación muestra los motivos y la lista vigentes. Fabricación realiza la corrección y devuelve el tanque a Laboratorio.

### 8.3 Rechazo

Resultados admitidos: `RECHAZADO_RECUPERAR` y `RECHAZADO_DESTRUIR`. Para recuperación debe indicarse la acción prevista. Ambos resultados cambian el estado a `RECHAZADO` y quedan registrados en `QualityDecision`.

## 9. Envasado

### 9.1 Inicio

Sólo puede iniciarse desde `APROBADO`. Requiere OE de 6 u 8 dígitos, material de 4 o 5 dígitos, línea de hasta 80 caracteres y formato de hasta 40 caracteres. Se crea una `PackagingOrder`, se registra usuario/hora y el tanque cambia a `ENVASANDO`. La tarjeta conserva visible el SEMI informado por Fabricación y muestra también el material de Envasado.

### 9.2 Nueva OE y corrección

Una nueva OE cierra la anterior, calcula su duración y abre la siguiente sin vaciar el tanque. Corregir OE, línea o formato no crea otra orden: requiere motivo y deja auditoría anterior/nuevo.

### 9.3 Finalización

Finalizar envasado cierra la orden activa, calcula su duración, finaliza el lote, desasocia el lote activo y devuelve el tanque a `VACIO`.

## 10. Monitoreo

Monitoreo es de sólo lectura. Para cada tanque muestra nombre, estado, peso bruto, conectividad, OF, material, descripción, peso específico, OE, línea, formato y capacidad o estado pendiente. También ofrece consulta de históricos sin operaciones productivas.

## 11. Pesos y Node-RED

Endpoint protegido por clave de integración:

```text
POST /api/plant/telemetry/weights
X-Node-Red-Key: <NODE_RED_API_KEY>
```

```json
{
  "readings": [{
    "scaleKey": "TK101",
    "grossKg": 5070.125,
    "netKg": 5018.4,
    "measuredAt": "2026-09-02T17:47:00.000Z"
  }]
}
```

Reglas:

- Entre 1 y 100 lecturas por solicitud.
- `grossKg` obligatorio entre -1000 y 100000, máximo 3 decimales.
- `netKg` opcional con el mismo rango.
- `measuredAt` opcional en formato ISO 8601.
- Frecuencia prevista: un lote aproximadamente cada 2 segundos.
- Los pesos permanecen exclusivamente en memoria del backend.
- Una lectura con más de 10 segundos se considera sin señal.
- Un reinicio elimina los pesos, pero no estados, lotes ni históricos.
- La respuesta informa `persisted: false`.

## 12. Persistencia

| Tabla | Propósito |
|---|---|
| `Tank` | Configuración y estado vigente |
| `ProductionLot` | Fabricación y vigencia del lote |
| `TankStateHistory` | Períodos históricos por estado |
| `QualityDecision` | Decisiones de laboratorio |
| `PackagingOrder` | Órdenes y duración de envasado |
| `PlantAuditLog` | Correcciones y cambios auditables |
| `User` | Usuarios, roles y estado de acceso |

No existe una tabla de muestras continuas de peso. `TankStateHistory` conserva únicamente una fotografía del peso recibida al confirmar cada cambio de etapa.

## 12.1 Información para Jefatura

El sistema calcula el tiempo actual y el histórico de permanencia en cada estado. Los períodos que atraviesan el inicio o fin de una jornada se prorratean dentro de sus límites. Las fechas se almacenan con zona horaria y se muestran en `America/Argentina/Buenos_Aires`.

Jefatura dispone de un resumen diario con estado actual, OF, material, antigüedad, semáforos, lotes finalizados, incidencias de calidad, kilogramos envasados, merma y balanzas sin señal. Puede abrir la línea temporal completa de una OF, exportar PDF/Excel y guardar el cierre de jornada con observaciones.

Los tiempos objetivo se configuran por estado en minutos. El 80 % del objetivo genera advertencia y el 100 % una alerta crítica.

## 13. Interfaz

- Tema oscuro industrial y estados identificados por color.
- Títulos centrados.
- Menú lateral desplegable en PC y pantallas pequeñas.
- Botón de menú alineado verticalmente con el título.
- Botón para entrar y salir de pantalla completa.
- Planta activa identificada por nombre y código en el encabezado.
- Vista pública `/tv` sin planta predeterminada: requiere seleccionar o conservar `?plant=LATEX`, `TERPLAST`, `SLURRY` o `ENDUIDO`.
- Nueve tarjetas y reloj visibles en Full HD sin scroll vertical.
- Controles operativos principales con objetivos táctiles de al menos 44 px y textos secundarios ampliados para lectura a distancia.
- Hora/minutos principales, segundos secundarios, fecha y zona `America/Buenos_Aires`.
- Acciones visibles sólo en el panel responsable.
- Botones TARA y CERO ausentes.
- Confirmación interna antes de toda operación de estado.
- Duración visible del estado actual y semáforo por tiempo objetivo.
- Pantalla de Jefatura preparada para reunión diaria, con exportación y cierre reproducible.
- Pantallas principales cargadas de forma diferida, con un estado accesible mientras se descarga cada módulo.

## 14. Seguridad

- JWT con vencimiento configurable.
- Contraseñas almacenadas mediante hash.
- Bloqueo temporal por intentos fallidos.
- Separación por `companyId`.
- Validación y lista blanca de campos.
- Límites de solicitudes en backend y Nginx.
- PostgreSQL publicado sólo en loopback de forma predeterminada.
- Secretos únicamente en `.env`, nunca en Git.

## 15. Criterios de aceptación

1. Existen exactamente TK101–TK109.
2. Cada rol sólo accede a pantallas y acciones autorizadas.
3. Un lote completa el flujo normal sin intervención técnica.
4. Ajustes y rechazos conservan responsable, motivo y fecha.
5. Las transiciones inválidas son rechazadas por backend.
6. Dos acciones concurrentes no modifican exitosamente el mismo estado.
7. Reiniciar el stack conserva estados, lotes, decisiones y órdenes.
8. Reiniciar el backend elimina únicamente los pesos temporales.
9. Las nueve balanzas pueden actualizarse cada dos segundos sin generar histórico de muestras.
10. Una balanza sin datos durante 10 segundos se muestra sin señal.
11. Toda corrección de OF u OE conserva valores anterior/nuevo, usuario y motivo.
12. Las pantallas productivas entran completas en Full HD.
13. No aparecen TARA/CERO ni confirmaciones nativas del navegador.
14. El administrador gestiona usuarios y consulta todo el historial.
