# ENVASES: prueba de acceso TCP al servicio DBS

## Alcance

El archivo importable [envases-dbs-tcp-diagnostico.json](../infra/node-red/examples/envases-dbs-tcp-diagnostico.json) abre una conexión TCP **manual** desde Node-RED hacia `10.1.0.105:5000`, muestra el estado de la conexión y captura una vista acotada de cualquier dato que el servidor envíe espontáneamente. No envía comandos, no consulta MariaDB, no publica en ApiDisal y no escribe en InfluxDB.

`10.1.0.105` está confirmado como host de MariaDB (`3306`), **no** como host de la API DBS. La configuración DBA ya analizada usa `127.0.0.1:5000` desde el propio equipo de CMS; `127.0.0.1` dentro del Node-RED externo apuntaría al contenedor Node-RED. Por eso se prueba `10.1.0.105:5000` sólo como candidato.

## Cómo probarlo en el Node-RED externo

1. Importar el JSON mediante **Menú → Importar → seleccionar archivo**, en un flujo nuevo. La pestaña queda deshabilitada inicialmente.
2. Habilitar la pestaña `ENVASES · prueba TCP DBS` y pulsar **Deploy**. El flujo no tiene inyecciones automáticas.
3. Abrir el panel **Debug** y pulsar **Abrir TCP manualmente · una vez**. Revisar el estado del nodo TCP y los mensajes `INTENTO_CONEXION_TCP`, `ESTADO_TCP` o `ERROR_TCP`.
4. Pulsar **Cerrar conexión manualmente** cuando termine la prueba. Si el servidor ya cerró, el flujo informa `YA_DESCONECTADO` y no intenta reiniciar el socket.

Si el servicio DBS está en otra máquina, editar únicamente `host` en **Conectar a host candidato sin enviar bytes**, volver a desplegar y repetir la prueba. Mantener `port = 5000` sólo si esa es la configuración vigente del servidor DBS.

## Interpretación

| Resultado | Qué demuestra | Siguiente paso |
| --- | --- | --- |
| Estado verde / conectado | El proceso Node-RED pudo abrir un socket TCP al host y puerto configurados. | Confirmar en el equipo servidor que el proceso que escucha es DBS. |
| `ECONNREFUSED` | El host respondió, pero el puerto rechazó la conexión. | Revisar escucha del servicio y puerto. |
| `ETIMEDOUT`, `EHOSTUNREACH` o `ENETUNREACH` | No se logró conectar desde Node-RED. | Revisar ruta, IP y reglas de firewall desde el entorno de Node-RED. |
| Verde y sin `DATOS_RECIBIDOS_SIN_SOLICITUD` | El puerto está abierto, pero el servidor no envía datos espontáneos. | Es esperable para una API de solicitud/respuesta. |
| Verde seguido de gris `common.status.disconnected` | El extremo remoto aceptó TCP y después terminó la conexión. | Puede cerrar sesiones que no envían una solicitud válida; esto no demuestra por sí solo que el servicio sea DBS. |

En la prueba del **19/10/2026**, Node-RED mostró `green · 1 connection` y luego `grey · common.status.disconnected`, sin bytes espontáneos. Quedó comprobada la apertura de TCP/5000 desde ese Node-RED hacia `10.1.0.105`, pero no la identidad del servicio ni la lectura de datos. El `ERROR_TCP` genérico apareció al pulsar **Cerrar** después de la desconexión; el mensaje filtrado no permite atribuirle una causa exacta. La versión actual del flujo evita solicitar el cierre si ya recibió el estado desconectado.

Una conexión exitosa **no identifica** el protocolo ni entrega todavía valores de inyectoras. Los documentos de análisis existentes describen respuestas de producción, estado y temperatura, pero no conservan una trama completa de solicitud de lectura verificada. Por eso este flujo no inventa ni transmite una trama: el protocolo también contiene operaciones que podrían tener efectos de control. Para obtener datos hay que confirmar primero el host del servicio y una solicitud de lectura segura y exacta; entonces se podrá extender este flujo con un nodo de petición y un decodificador por IP/modelo.

Referencias locales: `D:\Proyectos\Woojin-CMS-Analysis\docs\15_ORIGEN_DATOS_CMS_BOARD.md`, `D:\Proyectos\Woojin-CMS-Analysis\docs\11_PROTOCOLO_API_DBS.md` y `D:\Proyectos\Woojin-CMS-Analysis\resultados\evidencia_temperaturas_api_estatica.md`.
