# Análisis de secuencias `Shot_Number` de Woojin CMS

Relevamiento de **solo lectura** de `disal_cms` realizado el 18/10/2026. Las tablas se consultaron tal como estaban; no se modificó CMS ni se asignó una inyectora a registros históricos.

## Qué representa el número

`Shot_Number` identifica un disparo o ciclo reportado por CMS. No equivale necesariamente a la cantidad de envases: una fila puede indicar más de una cavidad y el significado operativo exacto de `Cavity` debe verificarse con Woojin. En esta muestra, `Cavity` vale 2 para `tapa4lts_1expulsor_jca.db` y 1 para los otros cinco archivos.

`shot_data` contiene mediciones resultantes del disparo. `shot_data_rec` contiene los parámetros de inyección asociados. Ambas tablas tienen 145.265 filas, desde el 28/08/2025 hasta el 17/10/2026. Hay 120.209 valores distintos de `Shot_Number` en el conjunto, por lo que **el número solo no es una clave global**.

## Secuencias observadas

Agrupando por `Additional_Info_1` (archivo) y eliminando las repeticiones de un mismo número dentro de ese archivo, cada serie avanza sin retrocesos en el orden de inserción. De 133.416 transiciones entre números consecutivos dentro de los seis archivos, 133.065 (+99,7 %) aumentan exactamente en uno; las otras 351 saltan uno o más números. Un salto no demuestra por sí solo que la máquina no haya producido: puede indicar registros que CMS no conservó, un intervalo sin captura u otra causa no verificada.

| Archivo | Filas | Números distintos | Transiciones +1 | Saltos >1 | Mediana entre +1 próximos |
| --- | ---: | ---: | ---: | ---: | ---: |
| `cuerpo_4l_iml_JCA.db` | 48.105 | 40.196 | 40.169 | 26 | 21 s |
| `tapas20lts_22_07_2025.db` | 45.134 | 41.200 | 41.074 | 125 | 24 s |
| `20litros_26_03_24.db` | 18.713 | 18.713 | 18.641 | 71 | 24 s |
| `tapa10lts_13_10_2024.db` | 14.250 | 14.250 | 14.241 | 8 | 17 s |
| `tapa4lts_1expulsor_jca.db` | 11.710 | 11.710 | 11.628 | 81 | 12 s |
| `moldechino_jca.db` | 7.353 | 7.353 | 7.312 | 40 | 20 s |

La mediana considera pares `+1` con diferencia de tiempo de 0 a 300 segundos. El patrón permite reconstruir **trayectorias de disparos por archivo y contador**, pero todavía no identifica a cuál de las cinco IP pertenece cada trayectoria. Se observaron seis archivos y entre uno y cinco archivos distintos por día con registros. Un archivo puede cambiar de máquina; su nombre no es una clave de máquina.

Hay registros en sólo **24 fechas** dentro del período calendario indicado. La ausencia de filas en otras fechas no prueba que la planta estuviera detenida: antes de calcular disponibilidad histórica hay que confirmar si CMS conserva todos los disparos, archiva períodos o interrumpió la captura.

## Qué pasa al cambiar de molde (archivo)

Un análisis adicional de las sesiones por archivo encontró **dos transiciones directas** entre moldes, con el contador avanzando exactamente en uno:

| Último disparo con molde anterior | Primer disparo con molde nuevo | Tiempo entre ambos |
| --- | --- | ---: |
| `tapa4lts_1expulsor_jca.db` · **494.977** · 27/11/2025 04:44:27 | `tapa10lts_13_10_2024.db` · **494.978** · 27/11/2025 07:46:20 | 3 h 01 min 53 s |
| `tapa10lts_13_10_2024.db` · **686.038** · 05/02/2026 17:34:26 | `tapa4lts_1expulsor_jca.db` · **686.039** · 05/02/2026 19:52:18 | 2 h 17 min 52 s |

Esto es **evidencia fuerte de que el contador se conserva al menos en esos dos cambios de molde**: no vuelve a cero ni empieza una secuencia independiente del archivo. Además, los cambios son de ida y vuelta entre los mismos dos moldes. La base no registra la IP en esas filas, por lo que todavía no demuestra qué inyectora hizo los cambios; tampoco demuestra que *todos* los cambios de molde se comporten igual. El criterio de búsqueda fue el último y primer disparo de sesiones separadas por más de seis horas dentro de cada archivo; pueden existir transiciones no detectadas si hubo huecos de captura o no se conservó el disparo limítrofe.

Cuando producción indique qué molde corre en cada IP, conviene anclar la secuencia actual con varios números de disparo visibles en el panel. Estas transiciones permitirán enlazar ciertos tramos de moldes diferentes con esa misma trayectoria de contador, conservando la evidencia y marcando los tramos no comprobados.

## Duplicados y vínculo entre las tablas

- Hay 133.422 combinaciones distintas de `(Additional_Info_1, Shot_Number)`, frente a 145.265 filas: **11.843 filas excedentes** por repetición de esas combinaciones. Todas las repeticiones observadas ocurrieron dentro de una hora; 8.931 de los 9.055 grupos repetidos tienen exactamente el mismo `TimeStamp`. Los otros 124 grupos difieren en un segundo. Los campos de ciclo, tiempo de inyección, presión máxima, peso y cavidad comparados no difieren en esos grupos. Esto es evidencia fuerte de inserciones duplicadas, no de 11.843 disparos adicionales; la identidad completa de todos los campos no fue comprobada.
- Si se incluye `TimeStamp` en la clave, hay 133.546 combinaciones distintas. En 6.269 combinaciones hay dos filas y en 2.725 hay tres. Por eso, contar filas de `shot_data` como piezas o ciclos infla los informes, sobre todo en los períodos con duplicación.
- Las 145.265 filas de `shot_data` encuentran una fila de `shot_data_rec` por `idx = rec_idx`, pero **seis pares no coinciden** en hora o número. Cuatro tienen la hora intercambiada por un segundo dentro del mismo número y archivo; dos tienen intercambiados número y archivo entre sí. En cambio, los conjuntos de `(archivo, Shot_Number, TimeStamp)` de ambas tablas coinciden, incluso con sus multiplicidades. Un lector histórico debe validar archivo, número y hora, además de `idx`, y tratar los seis casos como excepciones al vínculo directo.
- 22.268 valores de `Shot_Number` aparecen más de una vez en el conjunto; en 13.213 de ellos hay al menos dos archivos distintos. Esas coincidencias entre archivos no ocurrieron dentro de una hora en la muestra. Por tanto, no se puede unir registros de archivos diferentes sólo porque compartan número.

## ¿Se puede identificar la IP con este patrón?

**Comprobación de solo lectura del 19/10/2026:** en la sesión abierta de HeidiSQL, `shot_data` tenía 145.917 filas y último `TimeStamp=2026-10-19 16:09:31` al inicio de la consulta. Las filas nuevas de ese día correspondían únicamente a `cuerpo_4l_iml_JCA.db` (653 filas al consultar; el origen siguió avanzando) y conservaban `Machine_Name='-'`. El archivo estaba cargado en la IP `172.16.0.144` según la lectura DBS contemporánea, pero `real_data`/DBS muestra `current_quantity`, no el mismo valor que `Shot_Number` de `shot_data`. La coincidencia de archivo y fecha no constituye todavía un ancla de contador. No se importó ni asignó ninguna de esas filas a una tarjeta.

Una segunda comprobación a las 16:25 confirmó que los números visibles en las cinco máquinas (44.101, 60.843, 42.622, 8.454 y 14.870) son del orden de `real_data.Current_Quantity`: a esa hora la tabla marcaba respectivamente 44.108, 60.848, 42.625, 8.456 y 14.871. Ninguno de los diez números consecutivos proporcionados aparecía como `shot_data.Shot_Number` ni como `shot_data_rec.Shot_Number`; las últimas filas de ambas tablas seguían en 919.551 a las 16:16. Son **contadores distintos** y no se debe emparejarlos por igualdad. La captura de disparos llevaba unos nueve minutos sin avanzar aunque `real_data` sí se actualizaba. También se revisaron `setting_log`, `alarm_log` y `ashot_data`: las dos primeras conservan `Machine_Name='-'` y la última está vacía, por lo que no aportan el vínculo faltante.

A las 16:42, `real_data` seguía actualizando las cinco IP, pero `shot_data` y `shot_data_rec` permanecían en 145.937 filas y `TimeStamp=16:16:31`. La diferencia ya era de unos 26 minutos. La aplicación puede leer y mostrar los registros existentes por archivo; la reanudación de la captura de disparos depende de CMS y no se consigue con una consulta del dashboard.

La conexión por comandos se puede repetir con `python scripts/cms-readonly.py status`, `shots --file <archivo>` o `shot <número>`. El script pide la contraseña localmente o lee `CMS_DB_PASSWORD`, abre una transacción de solo lectura y no modifica tablas. El usuario `cms` facilitado tiene `ALL PRIVILEGES` en MariaDB; para una integración permanente conviene sustituirlo por una cuenta `SELECT` limitada a `disal_cms`.

**No todavía con certeza.** `itgr_machine_list` une cada `Machine_IP` con un modelo (`Machine_Nickname`), pero `shot_data` y `shot_data_rec` tienen `Machine_Name = '-'` en todos los registros relevados y no contienen IP. Durante esta consulta de fin de semana, los contadores actuales de `real_data` estaban en cero; tampoco aportaban un número de disparo para anclar una trayectoria.

La continuidad del contador puede servir para **extender una atribución comprobada**, no para inventar la primera atribución. El siguiente ensayo de solo lectura debe hacerse durante producción:

Mientras se obtiene esa atribución, el popup permite explorar las filas de `shot_data`/`shot_data_rec` cuyo `Additional_Info_1` coincide exactamente con el archivo actual informado para una inyectora. Es una **selección por molde**, no una asignación histórica definitiva por IP. Al 19/10/2026 había 48.777 filas de `cuerpo_4l_iml_JCA.db` y 14.250 de `tapa10lts_13_10_2024.db`; los otros tres archivos actuales informados no tenían filas. Los registros se consultan en páginas, sin actualizar `Machine_Name` ni etiquetar por IP en InfluxDB.

1. Obtener del panel de CMS o de cada inyectora su **número de disparo actual**, archivo y hora, junto con la IP/modelo confirmado en `itgr_machine_list`.
2. Comprobar varios disparos consecutivos de esa máquina contra `shot_data` y `shot_data_rec`, cotejando número, timestamp, archivo y tiempo de ciclo. Repetir para las cinco IP. Si CMS puede escribir `Machine_Name`, verificar también ese campo en un disparo nuevo de cada equipo.
3. Una vez anclada una serie a una IP, recorrerla hacia atrás sólo mientras haya continuidad del contador y evidencia suficiente. Detenerse ante cambios de archivo, huecos, reinicios o posibles transferencias de molde que no puedan corroborarse. Marcar como **inferida** la atribución histórica y conservar la fuente y el grado de confianza.

Para el historial nuevo, la solución más robusta es que CMS escriba un identificador de máquina por disparo. La trayectoria de `Shot_Number` serviría después para detectar saltos, duplicados y errores de captura. No se recomienda actualizar `Machine_Name` de los registros antiguos con una relación deducida sólo del archivo o de la secuencia.

## Consultas de diagnóstico reproducibles

```sql
-- Filas, números y período. Solo lectura.
SELECT COUNT(*) AS filas,
       COUNT(DISTINCT Shot_Number) AS numeros_distintos,
       MIN(TimeStamp) AS primero,
       MAX(TimeStamp) AS ultimo
FROM disal_cms.shot_data;

-- Detectar repeticiones dentro de un archivo.
SELECT Additional_Info_1, Shot_Number,
       COUNT(*) AS copias,
       MIN(TimeStamp) AS primera_hora,
       MAX(TimeStamp) AS ultima_hora
FROM disal_cms.shot_data
GROUP BY Additional_Info_1, Shot_Number
HAVING COUNT(*) > 1
ORDER BY copias DESC, ultima_hora DESC
LIMIT 50;

-- Excepciones al emparejamiento directo por índice.
SELECT s.idx, s.Additional_Info_1 AS archivo_resultado,
       r.Additional_Info_1 AS archivo_parametros,
       s.Shot_Number AS disparo_resultado,
       r.Shot_Number AS disparo_parametros,
       s.TimeStamp AS hora_resultado,
       r.TimeStamp AS hora_parametros
FROM disal_cms.shot_data AS s
JOIN disal_cms.shot_data_rec AS r ON r.rec_idx = s.idx
WHERE s.Additional_Info_1 <> r.Additional_Info_1
   OR s.Shot_Number <> r.Shot_Number
   OR s.TimeStamp <> r.TimeStamp
ORDER BY s.idx;
```

Véase también [estructura de CMS](BASE_DATOS_CMS_WOOJIN.md) y [flujo actual de ENVASES](FLUJO_NODERED_EXTERNO_ENVASES.md). El flujo actual recupera el último ciclo para el popup; **todavía no desduplica ni ingiere todo el histórico**.
