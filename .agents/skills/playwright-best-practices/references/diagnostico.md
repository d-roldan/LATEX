# Diagnóstico, regresión visual y ejecución

Adaptación de las referencias de Currents sobre fallos intermitentes, trazas, regresión visual, accesibilidad, Docker e informes.

## Investigar un fallo

Conservar la primera evidencia: error, paso, captura, peticiones relevantes y traza. Distinguir fallo del producto, selector obsoleto, datos compartidos, espera incorrecta y limitación del entorno. Reproducir el caso mínimo antes de cambiar el test.

```powershell
npx --no-install playwright test ruta-del-caso.spec.ts --workers=1 --trace=on
npx --no-install playwright show-trace ruta-a-trace.zip
```

Los comandos son patrones: resolver rutas existentes antes de ejecutarlos. La visualización de una traza puede abrir una interfaz y requiere las herramientas y permisos del entorno.

Usar reintentos acotados para recoger evidencia, no para ocultar un fallo. Repetir varias veces un caso sólo cuando se investigue inestabilidad. Revisar errores `pageerror`, consola y respuestas HTTP relevantes; conservar una lista de exclusiones específica si existen errores externos conocidos.

Una prueba omitida, en cuarentena o marcada `fixme` sigue sin demostrar el comportamiento. Informarla por separado. No aumentar automáticamente esperas o tolerancias de imágenes para conseguir que pase.

## Regresión visual

Fijar navegador, sistema, fuentes, zona horaria, datos y tamaño de ventana. Para comparar capturas entre ejecuciones usar el mismo entorno; diferencias Windows/Linux pueden cambiar el texto y sus métricas.

En LATEX cubrir Full HD, tablet y móvil cuando la pantalla afectada lo necesite. Verificar que botones y diálogos quedan accesibles en estados como ENVASANDO y que las grillas no recortan contenido. Comprobar semántica además de píxeles.

Congelar o preparar el peso y reloj para que las capturas sean repetibles. Enmascarar únicamente regiones volátiles que no forman parte del objetivo; no enmascarar estados o avisos que se pretende validar. Revisar cada actualización de imagen de referencia contra el cambio esperado.

## Accesibilidad e internacionalización

Verificar navegación por teclado, foco de diálogos, etiquetas y acciones táctiles. Una comprobación automatizada con axe, si está instalado y corresponde usarlo, complementa pero no sustituye la inspección de interacción.

Usar configuración de locale y zona horaria coherente con el entorno. Probar números con decimales, fechas y textos largos; no depender sólo de datos cortos. Evitar que los selectores fallen al cambiar una traducción cuando existe un rol accesible estable.

## Ejecución automatizada

Usar el archivo de dependencias bloqueadas del proyecto y una versión de navegador compatible con Playwright. Si se utiliza una imagen oficial de Playwright, hacer coincidir su versión con la dependencia instalada. No introducir una actualización de Playwright como efecto secundario de ejecutar pruebas.

Recordar que `localhost` dentro de un contenedor apunta a ese contenedor. Usar el destino correcto para el entorno y comprobar disponibilidad antes de iniciar la suite; evitar pausas fijas para esperar Docker.

Mantener trazas, vídeos e informes en `output/` o una ruta ignorada. Limitar su retención porque pueden contener datos o sesiones. Configurar capturas al fallar y trazas para diagnóstico según el coste del caso.

Reportar: escenario, entorno, comando, resultado y evidencias. Explicar qué fue simulado y qué se verificó contra servicios reales. No convertir el éxito de una prueba en afirmación de cobertura total.
