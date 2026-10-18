# Origen de las temperaturas del CMS Board Woojin

## Qué se comprobó

El informe local `D:\Proyectos\Woojin-CMS-Analysis\docs\15_ORIGEN_DATOS_CMS_BOARD.md` y sus extractos en `resultados/evidencia_temperaturas_api_estatica.md` analizan estáticamente `ITGRWoojinDBA.exe` y `DBSNewSE.exe`. Se cotejaron las huellas SHA-256 de las muestras con las consignadas en esa evidencia: DBA `77B98FB678829F3EB8219A762FDA468C1942E64EECF297B6AE25C17F7B908A20` y DBS `63A57674C7ACC7B392E6AE4F7A8B0B87B645C5B432F150015AA7E7EF9FFE744F`. Esta revisión reutiliza el análisis de ingeniería inversa existente; no ejecutó los programas ni consultó el CMS productivo.

La cadena documentada para la pantalla **Temperature Data** es: estado interno por máquina de DBS → respuestas de su API TCP → parser de DBA → registro compartido de DBA → tarjetas del tablero. DBA obtiene ocho valores **Current** de los campos 35–42 de la respuesta tipo `0` (`0x403570`) y ocho valores **Setting** de la lista separada por `/` del campo 15 de la respuesta tipo `2` (`0x404B90`). La vista de temperatura (`0x4E7C10`) lee ambos bloques y muestra cada par (`0x4FA510`). DBS despacha esas solicitudes en `0x42FEF0` hacia `0x416800` y `0x4024B0`. Son direcciones virtuales de funciones analizadas, **no registros Modbus**.

| Índice interno | Tarjeta CMS Board | Setting, respuesta `2` | Current, respuesta `0` |
| ---: | --- | ---: | ---: |
| 0 | Ext Nozzle | Elemento 0 | Campo 35 |
| 1 | Nozzle | Elemento 1 | Campo 36 |
| 2 | Heater1 | Elemento 2 | Campo 37 |
| 3 | Heater2 | Elemento 3 | Campo 38 |
| 4 | Heater3 | Elemento 4 | Campo 39 |
| 5 | Heater4 | Elemento 5 | Campo 40 |
| 6 | Oil | Elemento 6 | Campo 41 |
| 7 | Hopper | Elemento 7 | Campo 42 |

El orden interno no coincide con el orden visual de todas las tarjetas. `CMSBoardConfig.ini` aporta umbrales para los indicadores de color, no las consignas ni los valores medidos. La identidad que DBA presenta proviene de `Config/MachineList.ini` (`MACHINE_IP` y `NICKNAME`), según la muestra examinada; su vigencia en la instalación actual debe comprobarse antes de atribuir una lectura nueva.

## Relación con los datos de ApiDisal

- `real_data` contiene el último estado, ciclo y contadores **por IP** que usa el flujo SQL actual de ENVASES. No contiene las ocho parejas de temperatura y no está demostrado que sea la fuente directa de esa pantalla nativa.
- `shot_data` y `shot_data_rec` guardan mediciones y ajustes **de disparos históricos**. Una comparación de esas tablas en el popup debe llevar fecha y número de disparo; no equivale a `Setting`/`Current` vivo del tablero Woojin. Tampoco se demostró que sus zonas tengan una correspondencia uno a uno con las ocho tarjetas anteriores.
- `setting_log` registra cambios de ajustes, pero no es la fuente observada de las ocho tarjetas.
- El flujo Node-RED externo documentado en este repositorio consulta MariaDB. Por tanto, hoy no entrega las ocho parejas vivas. Las gráficas de temperaturas de ApiDisal registran sólo disparos **atribuidos a una IP** desde que se habilite InfluxDB; no recuperan automáticamente un histórico continuo de temperaturas de DBS.

## Lo que falta para integrar las parejas vivas

El análisis estático identifica el recorrido entre DBS y DBA, pero no verifica una instalación en funcionamiento, el formato completo y la seguridad de un cliente nuevo, la antigüedad de cada valor, las unidades, las escalas ni las direcciones Modbus de origen. Los temporizadores de la interfaz y la pausa del cliente no garantizan muestras industriales nuevas en cada repintado. Incluso con la máquina sin comunicación, una consigna visible puede ser un dato conservado; se necesita timestamp y estado de comunicación por máquina para presentarla como actual.

Antes de incorporarlas al tablero, corresponde revisar de forma acotada la gramática y las ramas de la API DBS, definir una lectura segura y validar en una prueba operativa autorizada cada valor frente a la pantalla Woojin con una máquina activa. Después, el adaptador deberá asociar identidad por IP, entregar las ocho parejas con marca de adquisición y frescura, y conservarlas en una serie histórica separada de los disparos. Ninguna de esas lecturas se encuentra implementada en el flujo SQL actual.
