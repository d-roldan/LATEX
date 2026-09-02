# Design System DISAL

## Propósito

El Design System define el lenguaje visual único del sistema de gestión de DISAL Industria Metalúrgica. La interfaz busca transmitir precisión, robustez y tecnología sin convertir el rojo institucional en un color decorativo omnipresente.

La identidad se organiza en tres capas:

1. `apps/frontend/src/shared/styles/theme.css`: valores de identidad y temas claro/oscuro.
2. `apps/frontend/src/shared/styles/design-system.css`: reglas reutilizables que sólo consumen tokens.
3. `apps/frontend/src/shared/ui`: componentes React con variantes semánticas.

Las pantallas no deben declarar valores visuales de identidad. Pueden definir estructura local, pero colores, radios, sombras, tipografía y movimiento deben provenir del Theme.

## Principios

- El rojo DISAL identifica la marca y las acciones principales de una pantalla.
- Guardar, aceptar y confirmar utilizan `success`.
- Editar e informar utilizan `info`.
- Advertencias utilizan `warning`.
- Eliminar y las acciones irreversibles utilizan `danger`.
- Cancelar, cerrar y acciones secundarias utilizan `secondary`, `ghost` u `outline`.
- La barra lateral permanece oscura en ambos temas.
- El modo oscuro utiliza superficies, bordes y sombras propios; no es una inversión del modo claro.
- Todas las transiciones respetan `prefers-reduced-motion`.

## Fuente única de verdad

La personalización completa se realiza en `apps/frontend/src/shared/styles/theme.css`.

El archivo centraliza colores, gradientes, sombras `xs` a `xl`, radios `sm` a `xl`, espaciados, tipografía, duraciones, curvas de animación y tokens específicos de botones, campos, tarjetas y modales. El bloque base representa el tema oscuro y `:root[data-theme='light']` contiene las diferencias del modo claro.

Los nombres históricos (`--primary`, `--panel`, `--ink`, etc.) son alias de compatibilidad que también apuntan al Theme. Así los módulos existentes heredan la misma identidad mientras se completa su migración estructural.

## Componentes base

- `Button.tsx`: variantes `primary`, `secondary`, `success`, `warning`, `danger`, `info`, `outline`, `ghost` y `link`; tamaños `sm`, `default` y `lg`.
- `Input.tsx`: `Input`, `Select` y `Textarea` con foco y estados compartidos.
- `Card.tsx`: consume los tokens `--card-*`; para interacción se agrega `ds-card--interactive`.
- `Badge.tsx`: variantes neutral, primary, success, warning, danger e info.
- `Modal.tsx`, `Dialog.tsx` y `ConfirmDialog.tsx`: overlay, superficie, cierre y animación compartidos.
- `Alert.tsx`: mensajes contextuales.
- `Progress.tsx`: avance accesible.
- `Tabs.tsx`: navegación segmentada.
- `Tooltip.tsx`: ayuda contextual.
- `Dropdown.tsx`: menú de acciones.
- `Toast.tsx`: notificaciones globales.
- `Table.tsx`: tablas con cabecera y hover compartidos.

## Reglas de implementación

- No agregar colores hexadecimales, `rgb()` o sombras directamente en componentes.
- No agregar duraciones o curvas locales cuando existe un token de movimiento.
- No crear una variante visual dentro de una pantalla; primero extender el componente base.
- Para colores dinámicos usar referencias como `var(--color-success)`.
- Los valores de layout estrictamente funcionales pueden permanecer inline.
- Todo nuevo módulo debe reutilizar los componentes de `shared/ui`.

## Cómo cambiar la identidad

- Rojo institucional: `--color-brand-disal` y familia `--color-primary-*`.
- Éxito: familia `--color-success-*`.
- Radio de botones: `--button-radius`.
- Radio y aspecto de tarjetas: `--card-*`.
- Sombras: familia `--shadow-*`.
- Velocidad: `--duration-fast`, `--duration-normal`, `--duration-slow`.
- Tema claro: bloque `:root[data-theme='light']`.
- Tema oscuro: bloque base `:root`.

No es necesario modificar cada pantalla para aplicar estos cambios.

## Validación

Antes de entregar cambios visuales:

1. ejecutar la compilación de producción;
2. revisar modo claro y modo oscuro;
3. validar login, navegación, formularios, tablas, tarjetas y un modal;
4. verificar foco, hover, pressed y disabled;
5. comprobar la vista móvil;
6. confirmar que no se introdujeron valores de identidad fuera del Theme.
