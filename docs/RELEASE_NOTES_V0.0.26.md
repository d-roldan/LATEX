# DISAL Planta de Látex · V0.0.26

Fecha: 18 de septiembre de 2026.

## Resumen

Esta versión mejora la lectura de la trazabilidad histórica de las órdenes de fabricación. El gráfico interactivo identifica el estado operativo correspondiente a cada medición y el informe PDF reproduce las áreas coloreadas por etapa debajo de la curva de peso.

## Gráfico del historial

- El detalle emergente de cada punto mantiene la fecha, la hora y el peso bruto.
- Debajo del peso se muestra el nombre del estado vigente en ese instante.
- El nombre utiliza el mismo color que representa a la etapa en el área del gráfico y en su leyenda.
- La presentación contempla los temas oscuro y claro con contraste diferenciado.

## Informe PDF

- El área debajo de la curva se divide y rellena con los colores correspondientes a cada estado de la orden.
- Los rellenos se suavizan para conservar la legibilidad de la curva, la cuadrícula y los valores impresos.
- Cuando un cambio de estado ocurre entre dos mediciones, se interpola el punto de corte para evitar que el color de una etapa invada la siguiente.
- Los puntos interpolados son únicamente gráficos y no alteran el total real de muestras informado en el documento.
- La interpretación de estados y colores se centralizó para mantener consistencia entre el popup y el PDF.

## Verificación realizada

- El lint enfocado en los archivos modificados finalizó sin errores.
- TypeScript del frontend finalizó sin errores.
- El build de producción de Vite finalizó correctamente.
- Se generó y renderizó un PDF de prueba con cuatro estados para verificar visualmente los cortes, colores y superposición de la curva.
- La imagen Docker del frontend se reconstruyó correctamente y la aplicación respondió HTTP 200 mediante `http://localhost:8081/`.

## Consideraciones

- No se ejecutó un flujo E2E autenticado sobre una orden operativa real; el tooltip fue verificado mediante tipos, lint y compilación de producción.
- Esta actualización no modifica contratos de backend, datos ni migraciones de base de datos.
