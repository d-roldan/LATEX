# Base de datos CMS de las inyectoras Woojin

## Alcance y fuente

Inventario de `disal_cms` obtenido el **17/10/2026** mediante consultas de solo lectura a MariaDB **11.8.3**. Describe el esquema y los datos observados en ese momento; no es documentación oficial del fabricante ni una garantía de que CMS mantenga el mismo contrato en versiones futuras. No se modificaron tablas, configuraciones ni registros. Este documento no contiene credenciales de conexión.

La base reúne últimos estados SQL, históricos de ciclos, alarmas, cambios de parámetros y configuración de la interfaz CMS. **`real_data` conserva el último estado y los contadores por IP que consulta ApiDisal; no garantiza una lectura actual y no contiene las parejas de temperatura que muestra CMS Board.** El análisis estático de ese tablero ubica su fuente inmediata en las respuestas de la API interna de DBS, como se explica en [ORIGEN_TEMPERATURAS_WOOJIN.md](ORIGEN_TEMPERATURAS_WOOJIN.md). El usuario confirma que la planta trabaja 24 horas durante los días de semana y descansa el fin de semana. Durante el descanso, un `Time_Stamp` antiguo puede corresponder a la última actualización recibida. El **19/10/2026, en jornada operativa**, CMS Board mostró las cinco máquinas en AUTO mientras HeidiSQL confirmó que las cinco filas de `real_data` seguían fechadas el 17/10, con operación y contadores en cero. Una segunda consulta confirmó que `shot_data` también terminaba en `idx=145265`, `TimeStamp=2026-10-17 11:21:13`, `Machine_Name='-'`: el mismo último registro observado en el inventario del 17/10. Por tanto, **ninguna de esas dos tablas estaba recibiendo datos nuevos en esa instancia**, y `real_data` no sirvió ese día como fuente de tiempo real para ApiDisal. La causa concreta de la falta de actualización SQL aún no está confirmada; una conexión DBS rota/deshabilitada y un destino SQL diferente siguen siendo hipótesis por comprobar.

Todas las tablas son `InnoDB` con colación `utf8mb3_bin`. No se declararon claves foráneas ni restricciones de unicidad adicionales a las claves primarias. Los índices secundarios mencionados abajo son individuales, no compuestos. Fuera de las claves primarias y de los campos marcados como obligatorios, las columnas admiten `NULL` y no tienen valores por defecto funcionales declarados. Las fechas usan `DATETIME`, sin zona horaria almacenada. Durante el relevamiento `NOW()` correspondía a UTC−03:00; los consumidores deben confirmar la zona configurada en CMS antes de convertir fechas a UTC. Las cantidades de filas de la tabla siguiente son **conteos exactos de esa consulta**, no estimaciones de `information_schema.TABLES`.

## Mapa de tablas

| Tabla | Filas | Clave primaria | Función observada o inferida |
| --- | ---: | --- | --- |
| `itgr_machine_list` | 5 | `idx` | Catálogo de máquinas con apodo, IP y datos de trabajo asociados. |
| `location_board` | 5 | `Machine_Nickname` | Posición y dimensiones de etiquetas en el tablero visual de CMS. |
| `real_data` | 5 | `Machine_IP` | Último estado y contadores reportados por cada IP; una fila por máquina. |
| `shot_data` | 145265 | `idx` | Histórico de disparos/ciclos y mediciones resumidas de inyección. |
| `shot_data_rec` | 145265 | `rec_idx` | Parámetros o receta detallada asociados a los disparos. |
| `ashot_data` | 0 | `idx` | Estructura paralela de mediciones con campos prefijados `A`; propósito exacto pendiente de confirmar. |
| `ashot_data_rec` | 0 | `rec_idx` | Estructura paralela de parámetros con campos prefijados `A`; propósito exacto pendiente de confirmar. |
| `alarm_log` | 2314 | `idx` | Historial de alarmas con inicio y fin. |
| `setting_log` | 1238 | `idx` | Historial de cambios de ajustes, con valor anterior y nuevo. |
| `work_list` | 1 | `idx` | Registro de combinación de operario, producto y resina; uso operativo exacto pendiente de confirmar. |
| `work_standards_list` | 1 | `idx` | Estándares de trabajo con imágenes y texto opcionales. |

### Identificación de las cinco inyectoras

`itgr_machine_list.Machine_IP` coincide con la clave de `real_data`. Esa relación existe en los datos, aunque la base no la impone con una clave foránea ni con un índice único en `itgr_machine_list.Machine_IP`.

En una comprobación adicional de solo lectura sobre **todas las filas** del 17/10/2026, `shot_data` (145.265), `shot_data_rec` (145.265), `alarm_log` (2.314) y `setting_log` (1.238) tenían `Machine_Name = '-'` en el 100 % de sus filas. `Additional_Info_2` estaba vacío en las 145.265 filas de ambas tablas de disparos. Esos campos no permiten reconstruir una IP histórica. `Additional_Info_1` cambia con el archivo de trabajo, pero un archivo puede cambiar de máquina y no es una clave del catálogo.

| Apodo en CMS | IP | Código usado en LATEX |
| --- | --- | --- |
| `DL650G5` | `172.16.0.141` | `INY01` |
| `DL450G5` | `172.16.0.146` | `INY02` |
| `TB280G5-1` | `172.16.0.143` | `INY03` |
| `TB280G5-2` | `172.16.0.144` | `INY04` |
| `TB200G5` | `172.16.0.145` | `INY05` |

El código `INYxx` pertenece al catálogo de LATEX; no es una columna de CMS. Las cinco filas de `real_data` tenían `Machine_Name` vacío durante el relevamiento. En `shot_data`, `shot_data_rec`, `alarm_log` y `setting_log`, los registros observados tenían `Machine_Name = '-'`. Por ello, **el esquema y los valores actuales no aportan una unión fiable entre un disparo, un archivo o una alarma y una IP concreta**. No asignar esos históricos a una tarjeta por orden de filas, modelo o coincidencia de hora sin comprobar el origen con CMS/Node-RED.

## Detalle por tabla

### `itgr_machine_list` — catálogo y contexto de trabajo

| Columna | Tipo | Interpretación |
| --- | --- | --- |
| `idx` | `bigint`, autoincremental | Identificador interno; clave primaria. |
| `Machine_Nickname` | `varchar(64)`, obligatorio | Apodo/modelo mostrado por CMS; coincide con `location_board.Machine_Nickname` en las cinco filas. |
| `Machine_IP` | `varchar(16)`, obligatorio | Dirección de la inyectora; permite asociar su fila de `real_data`. |
| `Worker_Name` | `varchar(64)` | Operario asociado, si CMS lo informa. |
| `Product_Name` | `varchar(64)` | Producto asociado, si CMS lo informa. |
| `Resin_Name` | `varchar(64)` | Resina asociada, si CMS la informa. |
| `Work_Std_Name` | `varchar(64)` | Nombre de estándar de trabajo, si se asigna. |

Sólo `idx` está indexado. En la muestra, la mayoría de los campos de trabajo estaban vacíos; no se debe tratar `Product_Name` ni `Work_Std_Name` como el archivo de programa cargado en cada máquina.

### `location_board` — disposición del tablero CMS

`Machine_Nickname` (`varchar(64)`, clave primaria) identifica la etiqueta. `Sheet_Name` (`varchar(64)`) identifica la hoja o tablero; las cinco filas observadas usaban `FAC_1`. `Label_Index`, `Label_Width`, `Label_Height`, `Label_Pos_X` y `Label_Pos_Y` son enteros que describen orden, dimensiones y coordenadas de las etiquetas. La interpretación de unidades y del origen de coordenadas no se verificó. Esta tabla configura la presentación de CMS; no contiene telemetría de producción.

### `real_data` — estado actual por IP

| Columna | Tipo | Uso probable |
| --- | --- | --- |
| `Machine_IP` | `varchar(15)`, obligatorio | Clave primaria; una fila por máquina. |
| `Machine_Name` | `varchar(64)` | Nombre reportado; estaba vacío en las cinco filas observadas. |
| `Time_Stamp` | `datetime` | Hora de la última lectura registrada por CMS. |
| `Motor_Status`, `Heater_Status` | `decimal(11,0)` | Códigos de motor y calefacción. |
| `Operation_Status` | `decimal(11,0)` | Código de modo operativo; su tabla de equivalencias debe confirmarse con CMS. |
| `Cycle_Time_Before`, `Cycle_Time_Current` | `varchar(10)` | Ciclos anterior y actual como texto numérico; unidad pendiente de confirmación. |
| `Production_Time_Hour`, `Production_Time_Min` | `decimal(11,0)` | Componentes del tiempo de producción reportado. |
| `Total_Quantity`, `Current_Quantity` | `decimal(11,0)` | Contadores total y actual reportados; no representan por sí solos una orden de fabricación. |
| `Avg_Quantity_Per_Hour` | `decimal(11,0)` | Promedio horario reportado por CMS. |
| `Alarm_Status` | `decimal(11,0)` | Código de estado/alarma reportado. |

Hay un índice secundario en `Machine_Name`. Durante el descanso consultado, las cinco filas mostraban motor, calefacción, operación y contadores en `0`, y marcas horarias entre las 04:31 y las 11:36 del 17/10/2026. Esto describe **la muestra**, no el comportamiento de un día hábil. La frescura debe calcularse contra `Time_Stamp` y el calendario operativo; un `0` no confirma por sí solo la causa del paro ni autoriza interpretar una alarma sin la tabla de códigos del fabricante.

### `shot_data` — histórico resumido de disparos

`idx` (`bigint` autoincremental) es la clave primaria. `Machine_Name`, `Additional_Info_1`, `TimeStamp` y `Shot_Number` tienen índices secundarios individuales. `Shot_Number` es `decimal(9,0)`, `TimeStamp` es `datetime` y `NGmark` es `smallint`; el significado de los valores de `NGmark` requiere confirmación. `Additional_Info_1` contenía nombres de archivos `.db` en los registros recientes, por ejemplo `cuerpo_4l_iml_JCA.db`; `Additional_Info_2` estaba vacío en esa muestra. Un nombre de archivo de este histórico no prueba qué programa está cargado **ahora** en una IP determinada.

| Grupo | Columnas (`float` salvo indicación) | Contenido sugerido por el nombre |
| --- | --- | --- |
| Tiempos | `Injection_Time`, `Filling_Time`, `Plasticizing_Time`, `Cycle_Time`, `Clamp_Close_Time`, `Clamp_open_time` | Duraciones de inyección, llenado, plastificación y movimientos del molde. |
| Posiciones | `Cushion_Position`, `Switch_Over_Position`, `Plasticizing_Position`, `Clamp_Open_Position` | Posiciones medidas durante el ciclo. |
| Velocidades y tornillo | `Max_Injection_Speed`, `Max_Screw_RPM`, `Average_Screw_RPM` | Máximos y promedio del tornillo/inyección. |
| Presiones | `Max_Injection_Pressure`, `Max_Switch_Over_Pressure`, `Max_Back_Pressure`, `Average_Back_Pressure` | Presiones registradas. |
| Temperaturas | `Barrel_Temperature_1` a `_7`, `Hopper_Temperature`, `Mold_Temperature_1` a `_12` | Zonas de cilindro, tolva y molde. |
| Otros | `Cavity` (`smallint`), `Resin_weight` | Cavidades y peso de resina reportado. |

El nombre físico **`Clamp_open_time`** usa minúsculas distintas al resto. `Additional_Info_1`, `Additional_Info_2` y `Machine_Name` son `varchar(64)`; `Shot_Number` y `TimeStamp` no forman una clave única declarada. Las unidades físicas de los `float`, la semántica de `NGmark`, `Cavity` y `Resin_weight` no fueron verificadas con el fabricante.

### `shot_data_rec` — parámetros detallados del disparo

`rec_idx` (`bigint` autoincremental) es la clave primaria. Hay índices secundarios individuales en `Machine_Name`, `Additional_Info_1`, `TimeStamp` y `Shot_Number`. `Machine_Name` y ambos `Additional_Info_*` son `varchar(64)`; `Shot_Number` es `decimal(9,0)` y `TimeStamp` es `datetime`.

Los campos `Inj_Velocity`, `Inj_Pressure`, `Inj_Position`, `Hld_Pressure`, `Hld_Time`, `Hld_Vel`, `Chg_Position`, `Chg_Speed`, `BackPressure`, `Suckback_Position`, `Suckback_Speed`, `Barrel_Temperature`, `Mold_Temperature` y `Timer` son cadenas (`varchar(64/128/256)` según el campo): pueden contener varias etapas separadas por `/` y no deben convertirse en un único número sin interpretar el formato. `SOV_Time` y `SOV_Position` son `double`.

Los últimos 100 pares `shot_data.idx = shot_data_rec.rec_idx` consultados coincidían también en `TimeStamp` y `Shot_Number`. Esto respalda una correspondencia práctica entre ambas tablas en la muestra, **sin clave foránea ni garantía formal para todos los históricos**. Antes de usarla para informes, verificar nulos, huecos y duplicados en el rango requerido.

### `ashot_data` y `ashot_data_rec` — estructuras paralelas `A`

Ambas estaban vacías. Su uso exacto no puede determinarse a partir de filas reales; el prefijo `A` podría identificar otro conjunto o fase de inyección, pero eso queda pendiente de confirmar con CMS. No se debe ofrecer estos campos como datos disponibles en ENVASES hasta recibir muestras y su especificación.

- `ashot_data`: `idx` autoincremental como clave primaria; `Machine_Name`, `Additional_Info_1`, `TimeStamp` y `Shot_Number` indexados por separado. Contiene `AInjection_Time`, `AFilling_Time`, `APlasticizing_Time`, `ACushion_Position`, `ASwitch_Over_Position`, `APlasticizing_Position`, `Max_AInjection_Speed`, `Max_AScrew_RPM`, `Average_AScrew_RPM`, `Max_AInjection_Pressure`, `Max_ASwitch_Over_Pressure`, `Max_ABack_Pressure`, `Average_ABack_Pressure`, `ABarrel_Temperature_1` a `_7` y `AHopper_Temperature` (`float`).
- `ashot_data_rec`: `rec_idx` autoincremental como clave primaria; los mismos cuatro campos de identificación indexados por separado. Contiene `AInj_Velocity`, `AInj_Pressure`, `AInj_Position`, `AHld_Pressure`, `AHld_Time`, `AHld_Vel`, `AChg_Position`, `AChg_Speed`, `ABackPressure`, `ASuckback_Position`, `ASuckback_Speed`, `ABarrel_Temperature` y `ATimer` como cadenas, más `ASOV_Time` y `ASOV_Position` como `float`.

### `alarm_log` — historial de alarmas

`idx` (`bigint` autoincremental) es la clave primaria. `Machine_Name` (`varchar(64)`), `Alarm_Number` (`int`) y `Alarm_Start_Time` (`datetime`) tienen índices secundarios. `Controller_Info` (`varchar(128)`) y `Machine_Type` (`varchar(32)`) describen el controlador/tipo reportado; `Alarm_End_Time` (`datetime`) permite registrar el cierre de la alarma. Hay registros con `Machine_Type` como `DLG5` y `TBG5`, pero esos tipos abarcan varias máquinas: no bastan para asignar la alarma a una IP. Los números de alarma necesitan un catálogo del fabricante para mostrar su significado.

### `setting_log` — cambios de parámetros

`idx` (`bigint` autoincremental) es la clave primaria. `Machine_Name` (`varchar(64)`), `TimeStamp` (`datetime`) y `Shot_Number` (`decimal(9,0)`) tienen índices secundarios. `Change_Item` (`varchar(64)`) identifica el ajuste; `Before` y `After` (`varchar(16)`) guardan los valores anterior y posterior como texto. En una muestra, `Change_Item` presentó caracteres mal decodificados; conviene verificar el juego de caracteres de la conexión y del origen CMS antes de mostrarlo en la aplicación. No hay IP ni clave foránea hacia `real_data`.

### `work_list` y `work_standards_list` — trabajo y estándares

- `work_list`: `idx` (`bigint` autoincremental, clave primaria), `Time_Stamp` (`datetime`, obligatorio), `Worker_Name`, `Product_Name` y `Resin_Name` (`varchar(64)`, opcionales). La única fila observada tenía valores de ejemplo (`work_1`, `product_1`, `resin_1`) de 2025; su presencia no demuestra un trabajo activo hoy.
- `work_standards_list`: `idx` (`bigint` autoincremental, clave primaria), `Work_Std_Name` (`varchar(64)`, obligatorio), `Standards_Image` y `Product_Image` (`mediumblob`, opcionales), `Additional_Info` (`varchar(2048)`, opcional). En la única fila, ambas imágenes eran `NULL`. No hay relación declarada con `itgr_machine_list.Work_Std_Name` ni con `work_list`.

## Relaciones y uso seguro para ENVASES

1. **Último estado SQL por máquina:** leer `real_data` por `Machine_IP` y usar `itgr_machine_list` como catálogo. Registrar fecha de consulta y `Time_Stamp` de CMS por separado. Durante el descanso semanal una lectura antigua puede ser esperable; durante producción, si `Time_Stamp` permanece inmóvil, no usar esta tabla para afirmar un estado actual. El tablero debe distinguir «última lectura» de «comunicación actual».
2. **Ciclos históricos y receta:** `shot_data` y `shot_data_rec` contienen información útil para el detalle técnico. En la muestra reciente comparten identificador, timestamp y número de disparo. `Additional_Info_1` contiene el nombre de archivo de esos ciclos; no es un campo de `real_data` ni una confirmación de archivo activo por IP.
3. **Alarmas y cambios:** `alarm_log` y `setting_log` permiten explorar eventos históricos. Faltan una identidad de máquina útil en los registros observados y la definición oficial de códigos y unidades; no deben alimentar alertas específicas por inyectora sin resolver ese mapeo.
4. **Tablero CMS:** `location_board` se relaciona por apodo con el catálogo, pero sólo define posiciones visuales.
5. **Configuración de trabajo:** `work_list` y `work_standards_list` existen, aunque su contenido observado es mínimo. No inferir órdenes de fabricación de estas tablas.

Consultas de referencia, siempre con un usuario autorizado y sin escribir datos:

```sql
-- Estado y hora de última actualización de cada inyectora.
SELECT m.Machine_Nickname, m.Machine_IP,
       r.Time_Stamp, r.Operation_Status, r.Current_Quantity,
       r.Cycle_Time_Current, r.Alarm_Status
FROM itgr_machine_list AS m
LEFT JOIN real_data AS r ON r.Machine_IP = m.Machine_IP
ORDER BY m.Machine_Nickname;

-- Muestra acotada de disparos recientes, todavía sin atribución fiable a una IP.
SELECT idx, Machine_Name, TimeStamp, Shot_Number,
       Additional_Info_1, Cycle_Time, NGmark
FROM shot_data
ORDER BY idx DESC
LIMIT 20;
```

Para integrar CMS con LATEX, el diseño vigente usa Node-RED como origen del resumen recibido por la API; LATEX no consulta esta MariaDB directamente. Véase [Integración ENVASES Woojin](INTEGRACION_ENVASES_WOOJIN.md). El usuario confirmó que puede configurar CMS para escribir en los nuevos `shot_data.Machine_Name` el apodo del catálogo; el flujo preparado usa esa igualdad exacta y única para obtener la IP. Se debe verificar en un nuevo disparo de cada máquina que la configuración funcione. Siguen pendientes la fuente del archivo **actualmente cargado**, el significado de códigos y `NGmark`, las unidades y la zona horaria real de los timestamps.
