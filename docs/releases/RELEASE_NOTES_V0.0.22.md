# DISAL Planta de Látex · V0.0.22

[← Índice de versiones](README.md)

Fecha: 15 de septiembre de 2026.

## Resumen

Esta versión mejora la lectura y la operación táctil del frontend, hace inequívoca la planta mostrada en televisores, completa la navegación por teclado de los diálogos y divide las pantallas en módulos de carga diferida.

## Interfaz y uso operativo

- Se ampliaron textos secundarios, estados, indicadores y controles principales de las tarjetas.
- Las acciones operativas principales tienen objetivos táctiles de al menos 44 px.
- El acceso móvil usa una única definición visual y un texto de ayuda más corto para evitar recortes.
- Se retiraron reglas heredadas duplicadas del acceso; su presentación queda centralizada en el sistema de diseño.

## Pantalla pública de planta

- `/tv` ya no asume Látex cuando falta el parámetro de planta.
- Abrir `/tv` sin parámetros muestra una pantalla de configuración con Látex, Terplast, Slurry y Enduido.
- Las direcciones configuradas son `/tv?plant=LATEX`, `/tv?plant=TERPLAST`, `/tv?plant=SLURRY` y `/tv?plant=ENDUIDO`.
- El encabezado mantiene visibles el nombre y el código de la planta.
- `/monitoreo?plant=CODIGO` conserva el parámetro al redirigir a `/tv`.
- El título de la ventana identifica la planta seleccionada.

## Accesibilidad

- Los diálogos llevan el foco al primer campo o acción útil al abrirse.
- `Tab` y `Shift+Tab` permanecen dentro del diálogo.
- `Escape` cierra el diálogo cuando no existe una operación pendiente que impida cerrarlo.
- Al cerrar, el foco vuelve al control que abrió el diálogo.
- La descarga de una pantalla diferida presenta un estado `role="status"` comprensible para tecnologías de asistencia.

## Rendimiento

- Login, TV, tablero operativo, Historial, Jefatura y Usuarios se generan como módulos separados mediante `React.lazy` y `Suspense`.
- En la compilación local, el bundle JavaScript principal pasó de 377,79 kB a 320,10 kB sin comprimir y de 118,59 kB a 104,45 kB con gzip. Estas cifras corresponden al entorno local y pueden variar entre compilaciones.

## Verificación y despliegue

- TypeScript y el build de producción del frontend finalizaron correctamente.
- Se verificaron en navegador la selección inicial de `/tv`, el encabezado explícito de Látex y el acceso responsive a 390 × 844 px.
- La imagen `disal-frontend` se reconstruyó y el contenedor se recreó sin reiniciar backend, PostgreSQL ni Node-RED.
- `/`, `/tv?plant=LATEX` y `/api/auth/status` respondieron HTTP 200 mediante el proxy local en `http://localhost:8081`.
- El lint global continúa pendiente de migrar desde `.eslintrc.cjs` al formato plano requerido por ESLint 9. El chequeo global de Prettier también conserva deuda previa; no se realizó un reformateo masivo ajeno a esta versión.

## Consideraciones

- Los favoritos, accesos directos o páginas de inicio de televisores deben actualizarse para incluir `?plant=CODIGO`.
- La pantalla `/tv` continúa siendo pública dentro de la red donde se exponga el servicio.
- El despliegue verificado corresponde al Docker local, no a producción.
