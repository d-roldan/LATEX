# Consultas e índices

Adaptación de las reglas `query-*`, `data-*` y `advanced-*` de Supabase.

## Diseñar índices a partir de consultas

Inspeccionar filtros, uniones y ordenamiento reales. Los índices pueden reducir lecturas, pero aumentan almacenamiento y coste de escritura. Un escaneo secuencial en una tabla pequeña no prueba un problema.

Considerar índices compuestos para filtros habituales de empresa/planta, estado y fecha. El orden de columnas importa: las igualdades iniciales, rangos y ordenamiento deben evaluarse con el plan y la distribución real. No crear automáticamente un índice por columna ni asumir que uno compuesto resuelve cualquier combinación.

Un índice parcial es útil para un subconjunto consultado con frecuencia. PostgreSQL debe poder demostrar que el predicado de la consulta implica el del índice; comprobar el comportamiento con parámetros. Un índice de cobertura con `INCLUDE` puede evitar lecturas de tabla cuando las condiciones de visibilidad lo permiten, a cambio de un índice más grande.

Elegir el tipo adecuado: B-tree para igualdad, rangos y orden; GIN para determinadas búsquedas JSONB o texto; GiST para operadores especializados; BRIN para tablas grandes con correlación física. Usar el tipo que requieran operadores y datos, no el más sofisticado.

## Evitar consultas repetidas

Reemplazar consultas por cada fila por carga agrupada, relaciones o uniones cuando conserve el contrato. En Prisma, revisar `select` e `include` y el SQL generado; una respuesta con relaciones no demuestra por sí sola que sólo se hizo una consulta.

Para inserciones masivas evaluar lotes y `createMany` según garantías requeridas. Mantener tamaños acotados y validar límites y duplicados. `COPY` puede ser útil para cargas grandes, pero requiere un proceso de importación explícito y no debe saltar validaciones necesarias.

Una secuencia de comprobar existencia y después insertar puede competir con otra solicitud. Usar una restricción única y una operación atómica de inserción/actualización cuando el caso lo requiera. Verificar cómo Prisma resuelve `upsert` en la versión y consulta utilizadas; no asumir atomicidad de cualquier combinación de operaciones.

## Paginación

Para páginas profundas evaluar paginación por cursor con orden estable y un desempate único. El cursor debe incluir el contexto de filtros o validarse contra éste. Conservar el alcance de empresa y planta en cada página.

`OFFSET` sigue siendo razonable para conjuntos pequeños o navegación que necesite páginas numeradas. Su coste aumenta al saltar muchas filas. Medir antes de cambiar un contrato público de paginación.

## JSONB y texto

Indexar JSONB según el operador realmente usado. Un GIN sobre toda la columna y un índice de expresión para una propiedad cumplen funciones diferentes; comprobar además tamaño y frecuencia de actualizaciones.

Para búsqueda de texto considerar `tsvector` y una configuración lingüística adecuada. Diferenciar búsqueda por palabras de coincidencia parcial de códigos OF/OE: no son intercambiables. Revisar extensiones o índices especializados sólo si el requisito lo necesita y el entorno los admite.

Usar parámetros en valores de SQL. Los identificadores dinámicos requieren una lista permitida; no se vuelven seguros interpolándolos como cadenas. Nunca presentar una consulta de ejemplo con nombres inventados como lista para ejecutar contra producción.
