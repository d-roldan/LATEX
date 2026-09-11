# Diseño de pruebas fiables

Adaptación de las referencias de Currents sobre estructura, selectores, esperas, datos, fixtures y objetos de página. Los ejemplos ilustran patrones: verificar los textos y rutas reales de LATEX antes de utilizarlos.

## Comprobar el comportamiento

Cada prueba debe describir un resultado visible y su condición inicial. Preparar mediante API los datos que no forman parte del comportamiento bajo prueba y usar la interfaz para las acciones que sí importan. Una prueba de inicio de sesión debe recorrer el formulario; una prueba de envasado puede reutilizar una sesión ya autenticada.

Preferir escenarios independientes. No hacer que una prueba dependa de que otra haya creado un lote ni de un orden particular de ejecución. Usar identificadores únicos para datos temporales y eliminar sólo los recursos creados por esa ejecución cuando corresponda.

Para un cambio de estado, comprobar estado inicial, acción autorizada, estado final y persistencia al volver a consultar. El éxito de un `click` no demuestra que el servidor haya aceptado la operación.

## Selectores

Priorizar `getByRole` con nombre accesible, `getByLabel`, texto visible y finalmente `getByTestId`. Acotar la búsqueda al panel o diálogo del equipo. Evitar índices de posición, clases generadas y rutas XPath que dependan de la disposición visual.

```typescript
// Ejemplo: reemplazar los nombres por los controles observados.
const dialogo = page.getByRole('dialog');
await dialogo.getByLabel('Orden de fabricación').fill('OF-PRUEBA-001');
await dialogo.getByRole('button', { name: 'Confirmar', exact: true }).click();
await expect(dialogo).toBeHidden();
```

Si hay varios botones con el mismo nombre, identificar primero el equipo o contenedor. Evitar solucionar la ambigüedad con `.first()` sin demostrar que ése es el objetivo correcto. Para un iframe usar `frameLocator`; un selector del documento principal no entra en su contenido.

## Esperas y comprobaciones

Usar comprobaciones que reintentan, como `await expect(locator).toHaveText(...)`, `toBeVisible()` o `toBeEnabled()`. `expect(await locator.isVisible()).toBe(true)` captura un instante y suele perder la espera automática.

Esperar el estado de negocio o la respuesta específica que causa el cambio. Evitar pausas fijas y `networkidle` como señal universal de disponibilidad: los paneles con consultas periódicas pueden no quedar inactivos.

Registrar la espera de una respuesta antes de disparar la acción para no perderla:

```typescript
const respuestaPendiente = page.waitForResponse(
  respuesta => respuesta.url().endsWith('/ruta-observada')
    && respuesta.request().method() === 'POST'
);
await botonConfirmar.click();
const respuesta = await respuestaPendiente;
expect(respuesta.ok()).toBe(true);
```

Usar `expect.poll` para resultados asíncronos que requieren una nueva consulta. Mantener tiempos de espera acotados y explicar las ampliaciones. No envolver una secuencia con efectos secundarios en un reintento que pueda duplicar órdenes.

## Fixtures y organización

Usar fixtures de prueba para páginas, contextos y recursos mutables; reservar las de trabajador para recursos cuya reutilización sea segura. Cerrar contextos y conexiones creados manualmente con `try/finally` o la limpieza de la fixture.

Extraer objetos de página cuando varias pruebas comparten interacciones significativas. Mantener las expectativas de negocio legibles en la prueba; evitar una capa de abstracción por cada botón. Usar `test.step` para separar etapas largas y `test.describe` para agrupar comportamientos, no dependencias entre pruebas.

Elegir el nivel más económico que pruebe la garantía buscada: unidad para reglas puras, integración/API para autorización y persistencia, navegador para interacción y navegación. La cobertura se mide por escenarios comprobados, no por cantidad de clics.
