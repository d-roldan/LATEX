# DISAL Planta de Látex · V0.0.36

[← Índice de versiones](README.md)

Fecha: 9 de octubre de 2026.

## Resumen

Esta versión incorpora una pizarra de planificación para la planta Látex, separada en fabricación y
envasado. Permite organizar visualmente los próximos lotes, reordenarlos durante el turno y usar la
planificación de fabricación para completar una nueva orden desde el panel operativo.

## Pizarra de fabricación

- Se agrega el acceso **Pizarra** debajo de Envasado en la navegación de la planta.
- Cada tanque dispone de una columna con tarjetas ordenables que muestran OF, material y descripción
  del lote planificado.
- Las tarjetas se pueden crear, editar, eliminar y mover dentro del tanque o hacia otro tanque.
- El lote actualmente en fabricación se muestra en verde y deja de figurar en la planificación cuando
  finaliza su ciclo y el tanque vuelve a vacío.
- Al iniciar una fabricación, el número de OF permite elegir una tarjeta planificada para el tanque y
  autocompletar el material y la descripción.

## Pizarra de envasado

- Se agrega una vista específica para la envasadora Devree con las dosificadoras A y B.
- La planificación utiliza una única secuencia global de cuatro posiciones entre ambas dosificadoras:
  1°, 2°, 3° y 4° no pueden repetirse entre A y B.
- Las tarjetas conservan el diseño continuo por dosificadora y muestran su posición global en el
  encabezado.
- Las tarjetas se pueden arrastrar, reordenar, cambiar de dosificadora, editar y eliminar.
- El estado de tanque enganchado se registra mediante un check en cada tarjeta.
- Los tanques que se están envasando se distinguen como operación actual.

## Base de datos y actualización

- Se incorpora `PlanningCard` para la planificación de fabricación por tanque.
- Se incorpora `PackagingPlanningCard` para la cola de Devree, con tanque único, dosificadora,
  posición, indicaciones y estado enganchado.
- La secuencia de envasado queda protegida por una restricción única global por planta y posición.
- La migración conserva las tarjetas existentes y normaliza sus posiciones antes de aplicar la nueva
  restricción.
- La actualización requiere ejecutar `prisma migrate deploy` y reconstruir frontend y backend.

## Verificación realizada

- Backend: 14 suites y 83 tests correctos, incluida la secuencia compartida entre dosificadoras.
- Esquema Prisma validado y cliente generado correctamente.
- Frontend: ESLint, Prettier, TypeScript y build de producción correctos.
- Contenedores locales actualizados; backend saludable y aplicación disponible por Nginx.
