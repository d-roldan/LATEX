# Estado y renderizado eficiente

Adaptación de las categorías de renderizado, estado, JavaScript y patrones avanzados de Vercel.

## Reducir trabajo innecesario

Suscribir cada componente a los datos que realmente necesita. Si sólo interesa una condición derivada, evitar propagar una estructura completa que cambia con cada lectura. Medir con herramientas de React o navegador para identificar qué componentes consumen tiempo.

Derivar valores durante el renderizado cuando se puedan calcular de props o estado actual. Un `useEffect` que copia un valor derivado a otro estado añade un ciclo y puede dejar datos inconsistentes. Reservar efectos para sincronizar con sistemas externos.

Mover la lógica causada por una interacción a su manejador. Mantener efectos con dependencias completas y estables; usar primitivas cuando representen mejor la dependencia. No desactivar reglas de hooks para evitar reejecuciones.

```typescript
// La función recibe el valor vigente y evita capturar uno anterior.
setCantidad(cantidadActual => cantidadActual + 1);

// La inicialización costosa se realiza al crear el estado.
const [filtros, setFiltros] = useState(() => leerPreferenciasValidas());
```

## Memorización y composición

Extraer componentes costosos con límites claros y aplicar `memo`, `useMemo` o `useCallback` cuando se observe trabajo evitable. No memorizar automáticamente expresiones simples: comparar y mantener dependencias también cuesta.

Evitar crear objetos o arrays predeterminados en cada render si rompen una comparación relevante. Extraer constantes inmutables fuera del componente. No definir un componente dentro de otro: cambia su identidad y puede reiniciar estado o foco.

Separar hooks que mezclan responsabilidades con dependencias distintas. Mantener el estado cerca de quien lo usa y evitar que cada actualización de peso vuelva a renderizar toda la navegación.

Usar `useRef` para valores transitorios que no deben actualizar la pantalla. El peso visible y los avisos requieren estado observable; guardarlos sólo en refs impediría refrescar la interfaz.

## Respuesta a la interacción

`startTransition` y `useDeferredValue` de React 18 pueden diferir trabajo no urgente. No diferir la entrada controlada que sigue la escritura ni representar una transición de servidor como confirmada antes de su respuesta. En React 18, no asumir que `startTransition` gestiona por sí solo el estado de una petición asíncrona.

Conservar foco y posición cuando se actualicen listas. Usar claves estables por entidad, no índice ni valor aleatorio. En condiciones numéricas usar ternarios o expresiones booleanas explícitas para evitar que `0 && ...` renderice un cero inesperado.

## DOM, listas y recursos

Agrupar lecturas y escrituras del DOM y evitar mediciones durante el renderizado. Preferir CSS para distribución. Para históricos grandes considerar paginación o virtualización después de medir; una grilla de pocos tanques no necesita una librería de virtualización por defecto.

Reservar dimensiones de imágenes y reducir recursos vectoriales innecesariamente complejos sin deformar logos. Animar transformaciones u opacidad cuando sea apropiado y respetar movimiento reducido. Comprobar que `content-visibility` no impide mediciones, foco o capturas necesarias.

En cálculos repetidos, construir un `Map` o `Set` cuando evita búsquedas lineales frecuentes. Calcular una vez los resultados reutilizables, salir temprano de bucles y evitar ordenar o mutar props directamente. Mantener claridad frente a microoptimizaciones sin impacto observado.

No aplicar patrones de hidratación, `Activity`, `useEffectEvent` o recursos exclusivos de versiones posteriores como si estuvieran disponibles en React 18. Confirmar API y compatibilidad antes de cambiar el enfoque.
