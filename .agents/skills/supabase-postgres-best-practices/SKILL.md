---
name: supabase-postgres-best-practices
description: Revisar SQL, índices, esquema, migraciones, conexiones, bloqueos y consultas lentas en PostgreSQL. Usar para cambios de base de datos y diagnóstico de rendimiento; adaptar las recomendaciones a PostgreSQL 16 y Prisma 5 de LATEX.
license: MIT
metadata:
  author: supabase
  language: es
  adaptation: Edición en español para PostgreSQL autogestionado
---

# Buenas prácticas de PostgreSQL

Edición adaptada y condensada de las guías de Supabase para PostgreSQL, con [procedencia y licencia](ORIGEN.md). LATEX usa PostgreSQL autogestionado y Prisma. No asumir Supabase Auth, `auth.uid()`, un pool externo ni políticas RLS existentes.

## Referencias

| Cambio o problema | Leer |
| --- | --- |
| Consultas, índices, paginación, JSONB y búsqueda | [Consultas e índices](references/consultas-indices.md) |
| Tipos, claves, restricciones y migraciones | [Esquema y migraciones](references/esquema-migraciones.md) |
| Conexiones, bloqueos, transacciones y métricas | [Concurrencia y diagnóstico](references/concurrencia-diagnostico.md) |
| Privilegios y aislamiento | [Acceso a datos](references/acceso-datos.md) |

## Procedimiento

1. Leer el esquema, las consultas y las migraciones del área. Identificar versión de PostgreSQL, volumen y patrón de acceso.
2. Obtener evidencia del problema antes de añadir índices, cachés o infraestructura. Las métricas de ejemplos externos no son garantías de rendimiento para LATEX.
3. Proponer el cambio mínimo, considerando coste de escrituras, bloqueos y datos existentes. Preservar el aislamiento por empresa y planta.
4. Seguir `../db-check/SKILL.md` y `docs/DESPLIEGUE_MULTIPLANTA.md` de la raíz para instalar o aplicar migraciones. Revisar una migración no autoriza ejecutarla en cualquier base.
5. Verificar resultados y rendimiento con datos representativos en el entorno correspondiente. Comunicar hallazgos en español, con consultas parametrizadas y sin exponer credenciales o datos privados.
