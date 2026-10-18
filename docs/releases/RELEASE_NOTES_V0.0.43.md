# LATEX V0.0.43

**Fecha de publicación:** 18 de octubre de 2026.

[← Historial de versiones](README.md)

## Resumen

ENVASES incorpora la atribución verificable de nuevos disparos Woojin por máquina, el detalle de parámetros de receta y gráficos históricos por inyectora. Se documenta el origen de las temperaturas del tablero nativo y se entrega un flujo completo, inicialmente deshabilitado, para preparar la integración con el Node-RED externo.

## Nuevas funcionalidades

- El popup de cada inyectora muestra las series de `shot_data_rec` y compara ajuste y medición del último disparo atribuido, con su fecha y número. Identifica los valores ausentes y evita presentarlos como temperaturas instantáneas.
- La pestaña **Histórico** permite consultar ciclo, contador y temperaturas por zona en períodos de 1 hora a 7 días. El backend guarda las lecturas atribuidas en mediciones `woojin_status` y `woojin_shot` de un bucket InfluxDB dedicado, separando equipo y fuente real/simulada.
- Un endpoint autenticado de historial exige acceso a ENVASES y valida equipo, fuente, métrica, período y zona. Cuando el bucket no está configurado, informa esa condición sin afectar el tablero actual.

## Mejoras y correcciones

- El backend sólo vincula un ciclo técnico a una tarjeta cuando su IP e identidad de origen coinciden con la máquina y la fuente. Puede aceptar un disparo nuevo aunque el timestamp de `real_data` no haya avanzado. Los registros sin atribución no se mezclan entre inyectoras.
- La TV muestra también el total reportado y el tiempo de producción de CMS. El archivo y el número de disparo se rotulan como no vinculados cuando falta una correspondencia comprobada.
- El simulador local entrega IP, identidad simulada y receta por etapas coherente con sus mediciones; se mantienen aisladas las fuentes real y de demostración.

## Integración y documentación

- Se agrega un flujo Node-RED externo importable con SQL fijo para las cinco IP, catálogo por `itgr_machine_list`, diagnóstico y vinculación de nuevos disparos cuando `shot_data.Machine_Name` coincide de forma única con el apodo del catálogo. Llega deshabilitado y requiere configuración y prueba manual antes de activarlo.
- Se documentan las tablas de `disal_cms`, el análisis de `Shot_Number` y el recorrido estático de las ocho parejas `Setting`/`Current` del CMS Board. El flujo SQL actual no incorpora esas temperaturas vivas; el gráfico de temperatura representa disparos históricos atribuidos.

## Base de datos

No hay migraciones de Prisma ni cambios en PostgreSQL. La persistencia histórica opcional utiliza un bucket dedicado de InfluxDB; comienza desde su activación y no importa los disparos antiguos sin IP comprobable.

## Variables de entorno y configuración

Se agrega `INFLUXDB_ENVASES_BUCKET`. Requiere `INFLUXDB_URL`, `INFLUXDB_TOKEN` y `INFLUXDB_ORG` o `INFLUXDB_ORG_ID` ya contemplados por la aplicación. Si el bucket queda vacío, la escritura y la consulta histórica de ENVASES permanecen deshabilitadas. Revisar retención, respaldo y permisos del token antes de configurarlo.

El flujo externo requiere una cuenta MariaDB exclusiva de lectura, `DISAL_API_BASE_URL` y `DISAL_ENVASES_INTEGRATION_KEY` en el entorno seguro de Node-RED. Ninguna credencial se incluye en el flujo. La configuración de `Machine_Name` para nuevos ciclos debe verificarse en CMS; los disparos anteriores con `-` no se atribuyen retroactivamente.

## Actualización

Tag objetivo: `V0.0.43`. Para actualizar una instalación existente, seguir [ACTUALIZACION_SERVIDOR.md](../ACTUALIZACION_SERVIDOR.md) y reconstruir **backend y frontend**. Configurar el bucket sólo si se desea activar el historial. La importación del flujo en el Node-RED industrial externo es una tarea independiente y manual; no iniciar ni recrear ese servicio desde el Compose de LATEX. Esta publicación en GitHub no actualiza el servidor productivo.

## Verificaciones realizadas

- Backend local: 17 suites y 131 pruebas aprobadas; compilación Nest y ESLint/Prettier de los archivos modificados aprobados.
- Frontend local: comprobación TypeScript, build Vite y ESLint/Prettier de la pantalla ENVASES aprobados.
- Node-RED: pruebas del flujo externo y del simulador aprobadas; el JSON embebido en la guía coincide con el importable. Los archivos de flujo revisados no contienen campos de contraseña, token o clave con valor.
- Se cotejaron las huellas SHA-256 de los ejecutables Woojin con las muestras del análisis estático existente; no se repitió la ingeniería inversa.

## Limitaciones conocidas

No se conectó esta versión al CMS ni al Node-RED productivo, ni se verificó el nuevo gráfico con un bucket InfluxDB de la planta. La interfaz y las pruebas locales no confirman unidades industriales, frecuencia de adquisición ni atribución de disparos anteriores. Las ocho parejas vivas del CMS Board requieren una integración posterior de la API DBS y una validación operativa separada.
