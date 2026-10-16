# Preparación y publicación de versiones

Desarrollo local, publicación en GitHub y actualización productiva son solicitudes independientes. Preparar una release no autoriza publicarla. Una publicación tampoco autoriza actualizar el servidor. La convención histórica es `VMAJOR.MINOR.PATCH`, con `V` mayúscula; por defecto incrementar PATCH. MINOR o MAJOR requiere justificar el cambio. No inferir la siguiente versión sólo del checkout local.

## 1. Inventario

1. Revisar `git status`, rama, remotos efectivos y cambios ajenos. No incluirlos sin autorización.
2. Consultar tags locales y los de cada remoto autorizado con `git ls-remote --tags <remoto>`; comparar nombres, objeto anotado y commit destino. Investigar divergencias y tags recientes. No sobrescribir ni reutilizar tags.
3. Identificar el último tag publicado consistente y revisar el diff completo desde ese commit. No asumir que el número mayor corresponde a una publicación válida.

## 2. Validación y notas

Aplicar `ESTRATEGIA_VALIDACION.md` al conjunto acumulado desde la versión anterior. Registrar comandos, alcance, entorno y resultados reales; distinguir verificaciones pendientes. Un build no sustituye pruebas funcionales críticas. Si hay fallos críticos, detener la publicación.

Crear `docs/releases/RELEASE_NOTES_Vx.x.x.md` a partir de `docs/releases/TEMPLATE.md`. Redactar en español y actualizar `docs/releases/README.md`, `docs/README.md` y referencias de versión vigente pertinentes. Las notas deben decir expresamente si hay migraciones, variables/configuración nuevas, contenedores a reconstruir, precauciones de actualización, verificaciones reales y limitaciones. Usar fecha real de publicación; durante preparación indicar `Pendiente de publicación`.

## 3. Commit y tag

Revisar diff final; incluir notas e índices en el mismo commit de la versión. Crear tag anotado en ese commit:

```powershell
git tag -a Vx.x.x --cleanup=verbatim -F docs/releases/RELEASE_NOTES_Vx.x.x.md
```

Antes del push, ejecutar `node scripts/verify-release.mjs Vx.x.x`. Comprueba que el tag es anotado, que apunta al commit previsto y que la anotación coincide con el Markdown guardado en ese commit. Revisar además los índices y el diff final. No reescribir tags publicados.

## 4. Publicación autorizada

Verificar `git remote -v` y la rama destino. `origin` es GitHub personal; `laboral` es GitHub corporativo. Si se pidió uno, usar sólo ese. Si se pidieron ambos, enviar el mismo commit y tag a los dos y cotejar los destinos. Sin destino predeterminado autorizado, preguntar antes del push. No usar `--force`. Ante divergencia, detener el remoto afectado.

Cuando se solicite una publicación completa y la herramienta esté disponible, crear GitHub Release con el contenido íntegro del Markdown. Si no es posible, registrar la limitación sin confundir un push de rama con una release completa. Verificar en los remotos commit, tag y notas; consultar el estado de CI y distinguir jobs aprobados de pendientes. Informar versión, commit, destino, migraciones, servicios y estado.

## 5. Servidor

La actualización de producción usa un tag ya publicado y el runbook `ACTUALIZACION_SERVIDOR.md`. Requiere autorización independiente, confirmación del host y ventana, respaldo restaurable, migración controlada, verificación y rollback. Nunca gestionar el Node-RED externo desde Compose de LATEX.
