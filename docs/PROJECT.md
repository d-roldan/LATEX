# Proyecto DISAL INDUSTRIA METALÚRGICA

## Contexto

Sistema de gestión comercial y productiva para una empresa dedicada a la fabricación de casillas rurales.

La base técnica proviene de DISAL Mini-MES/JM Rectificaciones. El objetivo actual es conservar las capacidades generales de trazabilidad y reemplazar el dominio anterior por procesos, datos y terminología propios de DISAL

## Propósito

Centralizar:

- consultas y clientes;
- presupuestos;
- planificación de cada casilla;
- etapas y órdenes de fabricación;
- asignación de personas, herramientas y equipos;
- materiales y consumos;
- compromisos y entregas;
- costos, productividad y trazabilidad.

## Alcance implementado

- Autenticación JWT y roles.
- Usuarios y cuentas protegidas.
- Clientes y contactos.
- Presupuesto y producción unificados en `Order`.
- Ítems, horas estimadas y costo comercial.
- Aprobación, planificación y seguimiento productivo.
- Asignaciones, eventos, consumos y adjuntos.
- Cierre de entrega.
- Inventario y recursos.
- Dashboard, control de producción, calendario y reportes.
- Auditoría.
- Copiloto IA opcional.

## Alcance de reconversión

La aplicación ya modela cada casilla mediante una revisión de modelo y un grafo de fabricación propio. Se encuentran implementados:

- modelo y versión de casilla;
- número de serie opcional;
- 12 etapas productivas con ejecución paralela;
- dependencias y barrera de Armado Final;
- responsables y sesiones de trabajo por etapa;
- avance ponderado y liberación automática;
- terminal de operario y mapa de supervisor.

Continúan como evolución:

- dimensiones y plano;
- configuración y opcionales;
- lista de materiales por modelo;
- controles de calidad;
- fotografías de avance;
- logística y entrega;
- garantías y posventa.

## Objetivo de negocio

Conocer el estado, costo, carga y fecha prevista de cada casilla; reducir pérdidas de información; mejorar compras y stock; y disponer de un historial completo desde el presupuesto hasta la entrega.

## Objetivo técnico

Mantener una aplicación on-premise sencilla de operar, modular y verificable, con posibilidad de evolucionar a varias plantas o empresas sin afirmar capacidades SaaS que todavía no existen.

## Fuera de alcance actual

- IoT y telemetría de máquinas.
- Aplicación móvil nativa.
- Facturación electrónica.
- Integración automática con proveedores.
- WhatsApp y notificaciones push.
- Administración global multiempresa.
- Pagos o suscripciones.
- HTTPS automatizado.
