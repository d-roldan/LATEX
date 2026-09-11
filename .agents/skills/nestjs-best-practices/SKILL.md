---
name: nestjs-best-practices
description: Orientar cambios y revisiones de módulos, servicios, DTO, inyección de dependencias, errores y rendimiento en NestJS. Usar para desarrollo del backend; complementar backend-validate con criterios de implementación.
license: MIT
metadata:
  author: Kadajett
  language: es
  adaptation: Edición en español adaptada a NestJS 10 y Prisma 5
---

# Buenas prácticas de NestJS

Aplicar las recomendaciones al código realmente afectado. Esta edición en español condensa las reglas comunitarias de Kadajett y adapta el acceso a datos al Prisma de LATEX. No instalar TypeORM, Redis, colas o microservicios para satisfacer un ejemplo. Consultar [procedencia](ORIGEN.md).

## Referencias según el cambio

- Módulos, proveedores, controladores y contratos: [Arquitectura e interfaces](references/arquitectura.md).
- Transacciones, permisos, errores y operación: [Datos y ejecución](references/datos-ejecucion.md).
- Para ejecutar comprobaciones, consultar `../backend-validate/SKILL.md`; para cambiar permisos, `../roles-audit/SKILL.md`; para migrar, `../db-check/SKILL.md`.

## Flujo de trabajo

1. Leer controlador, servicio, DTO, módulo y pruebas del área. Identificar el contrato actual y el efecto esperado del cambio.
2. Mantener los límites del dominio y las dependencias explícitas. Refactorizar únicamente lo que facilite o haga correcto el cambio solicitado.
3. Comprobar entradas y autorización en el servidor. Mantener coherencia entre planta, equipo, usuario y empresa según las entidades existentes.
4. Preservar la atomicidad de estado e historial. Elegir comprobaciones que detecten regresiones en resultados y permisos.
5. Ejecutar la validación pertinente e informar resultados en español con rutas concretas. No usar afirmaciones genéricas de arquitectura como evidencia de una mejora de rendimiento.
