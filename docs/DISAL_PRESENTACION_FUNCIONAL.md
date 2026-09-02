# DISAL INDUSTRIA METALÚRGICA — Presentación funcional

## Resumen

DISAL utiliza una aplicación web para centralizar el seguimiento comercial y productivo de casillas rurales.

La plataforma cubre el flujo desde el cliente y presupuesto hasta la fabricación y entrega. Cada casilla se crea desde un modelo versionado y avanza por un grafo de 12 etapas productivas, con dependencias, responsables, bloqueos y porcentaje ponderado. La planificación se gestiona como información administrativa de la orden.

## Problemas que busca resolver

- Información distribuida entre papel, mensajes y planillas.
- Dificultad para saber el estado de cada trabajo.
- Poca trazabilidad de cambios y consumos.
- Desvíos de costo detectados demasiado tarde.
- Falta de una fecha de compromiso visible.
- Dependencia de conocimiento informal.

## Usuarios

### Dueño o administrador

- Consulta indicadores.
- Gestiona usuarios.
- Revisa costos y desvíos.
- Accede a auditoría.
- Configura criterios de control.

### Supervisor

- Planifica.
- Asigna personas y equipos.
- Controla estados, consumos y fechas.
- Organiza entregas.

### Operario

- Consulta órdenes asignadas.
- Revisa planos y adjuntos.
- Registra inicio, pausas y finalización.
- Carga consumos y notas.

## Flujo actual

```text
Cliente
  -> Presupuesto
  -> Envío
  -> Aprobación
  -> Planificación administrativa y asignación
  -> Producción por etapas
  -> Consumos y eventos
  -> Finalización
  -> Checklist y entrega
  -> Auditoría y reportes
```

Presupuesto y producción son fases de una misma orden, con un único código.

## Módulos

### Tablero

Resumen de actividad, atrasos, carga, costos y alertas.

### Clientes

Datos comerciales y contactos.

### Órdenes de Producción

Presupuestos, órdenes, asignaciones, eventos, consumos, adjuntos y entrega.

### Control de Producción

Vista operativa de casillas y órdenes activas.

### Mi Producción

Ejecución para operarios.

### Recursos

Personas y máquinas disponibles.

### Materiales

Stock, costos, movimientos y consumos.

### Reportes

Horas, productividad, desvíos y costos de materiales.

### Calendario

Compromisos de órdenes y eventos manuales locales.

### Auditoría

Registro de acciones sensibles.

### Copiloto IA

Consultas ejecutivas con datos resumidos del sistema.

## Demostración sugerida

1. Iniciar sesión como dueño.
2. Mostrar tablero y alertas.
3. Crear un cliente.
4. Crear un presupuesto.
5. Agregar ítems y horas.
6. Aprobarlo.
7. Planificar y asignar.
8. Entrar a Mi Producción.
9. Registrar evento y consumo.
10. Mostrar reporte y auditoría.

## Mensajes que deben aclararse

- El sistema está operativo, pero el dominio de casillas rurales aún debe modelarse.
- Los costos reales actuales se basan en materiales registrados.
- El calendario manual no es compartido.
- Los adjuntos requieren persistencia antes de producción.
- La IA es asistencia y no reemplaza la validación humana.
- La aplicación actual funciona en red local y todavía no usa HTTPS.

## Próxima evolución

- Modelos y versiones de casilla.
- Dimensiones, opcionales y lista de materiales.
- Etapas específicas de fabricación.
- Calidad y retrabajos.
- Fotos de avance.
- Logística, garantía y posventa.
