# Actualización controlada de un servidor existente

[← Volver al índice de documentación](README.md)

Este runbook indica cómo actualizar una instalación existente de DISAL Planta de Látex desde un tag
publicado. Complementa [Despliegue multiplanta](DESPLIEGUE_MULTIPLANTA.md), que conserva las reglas
generales de instalación, persistencia y recuperación.

El documento no autoriza por sí mismo una intervención. El agente debe contar con un pedido explícito
para actualizar el servidor, conocer la versión objetivo y trabajar dentro de una ventana de
mantenimiento aprobada.

## Contrato de ejecución para el agente

- Trabajar desde la raíz del checkout del servidor.
- Confirmar servidor, remoto y tag objetivo; no asumir que `main` es la versión a desplegar.
- Leer la anotación completa del tag y su `RELEASE_NOTES_Vx.x.x.md` antes de cambiar archivos o
  contenedores.
- No mostrar ni copiar secretos en la conversación, logs o Git.
- No usar `git reset --hard`, `git clean`, `git stash`, `docker compose down -v`, seeds, `db push`,
  `migrate reset` ni comandos con pérdida de datos.
- No sobrescribir un checkout con cambios locales. Si `git status --porcelain` no está vacío, detenerse,
  identificar los archivos y pedir una decisión. Los cambios de Node-RED pueden ser datos runtime.
- No continuar después de un error de backup, build o migración. Conservar la evidencia y reportar el
  punto exacto de fallo.
- Usar siempre el mismo conjunto de archivos Compose durante toda la intervención.
- En el servidor productivo, la telemetría proviene de un Node-RED externo ubicado en otro Compose y
  compartido con otros procesos. No detener, recrear, respaldar ni modificar ese contenedor completo
  desde este procedimiento. Coordinar únicamente el flujo que envía datos a esta aplicación.
- El servicio `disal-node-red` definido en este repositorio es local/demo y no forma parte del runtime
  productivo actual. No iniciarlo como parte de una actualización del servidor.

## Datos que se deben solicitar o confirmar

Antes de comenzar deben estar definidos:

- tag objetivo, por ejemplo `V0.0.36`;
- remoto autorizado, normalmente `origin` o `laboral`;
- si el servidor usa HTTP o el overlay `docker-compose.https.yml`;
- URL de comprobación accesible desde el servidor;
- ventana de mantenimiento y responsable que valida el resultado;
- ubicación lógica, responsable y forma aprobada de pausar sólo el flujo del Node-RED externo que
  envía telemetría a esta aplicación, sin afectar sus otros usos;
- ubicación de backups fuera del checkout y con permisos restringidos.

Si falta alguno de estos datos y no puede obtenerse mediante una comprobación de sólo lectura, el
agente debe detenerse y solicitarlo.

## 1. Preparar la sesión y conservar evidencia previa

Definir la versión y el remoto sin incluir credenciales:

```powershell
$VersionObjetivo = "V0.0.36"
$Remoto = "origin"
$MarcaTiempo = Get-Date -Format "yyyyMMdd-HHmmss"
$RaizRepo = (Get-Location).Path
$DirectorioBackup = Join-Path (Split-Path $RaizRepo -Parent) "planta-latex-backups/$MarcaTiempo"
New-Item -ItemType Directory -Path $DirectorioBackup | Out-Null
```

Elegir una sola variante Compose para toda la actualización:

```powershell
# HTTP
$ArchivosCompose = @("-f", "docker-compose.yml")

# Para HTTPS reemplazar la asignación anterior por:
# $ArchivosCompose = @("-f", "docker-compose.yml", "-f", "docker-compose.https.yml")

function dc { & docker compose @ArchivosCompose @args }
```

Comprobar el checkout y registrar el estado actual:

```powershell
git status --porcelain
git remote -v
git rev-parse HEAD | Set-Content "$DirectorioBackup/commit-anterior.txt"
git describe --tags --always | Set-Content "$DirectorioBackup/version-anterior.txt"
dc config --quiet
dc config --services | Set-Content "$DirectorioBackup/servicios-antes.txt"
dc ps -a | Set-Content "$DirectorioBackup/contenedores-antes.txt"
```

Si el estado Git no está limpio, no corregirlo automáticamente. `infra/node-red/data` pertenece al
servicio local/demo del repositorio y no debe confundirse con el runtime productivo externo.

## 2. Obtener y verificar la versión sin desplegarla

```powershell
git fetch --tags --prune $Remoto
git cat-file -t $VersionObjetivo
git rev-parse "$VersionObjetivo^{commit}"
git show --no-patch --format=fuller $VersionObjetivo
git for-each-ref --format="%(contents)" "refs/tags/$VersionObjetivo"
```

`git cat-file -t` debe devolver `tag`, no `commit`: las versiones del proyecto usan tags anotados. La
anotación debe contener la nota completa, no sólo un título.

Comprobar que la nota versionada existe dentro del tag y leerla:

```powershell
$RutaNota = "docs/releases/RELEASE_NOTES_$VersionObjetivo.md"
git cat-file -e "$VersionObjetivo`:$RutaNota"
git show "$VersionObjetivo`:$RutaNota"
```

Comparar visualmente la anotación con el archivo. Revisar especialmente:

- migraciones nuevas y sus precondiciones;
- servicios que requieren reconstrucción;
- variables de entorno nuevas;
- cambios de Node-RED, Nginx, certificados o volúmenes;
- verificaciones funcionales específicas de la versión.

No desplegar un tag que no exista en el remoto autorizado, no sea anotado, no tenga nota completa o
no incluya instrucciones suficientes para sus cambios de esquema.

## 3. Respaldar antes de detener o modificar servicios

### PostgreSQL

Crear el dump dentro del contenedor, validarlo con `pg_restore --list` y copiarlo fuera del checkout:

```powershell
dc exec -T disal-db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/pre-update.dump'
if ($LASTEXITCODE -ne 0) { throw "Falló pg_dump" }

dc exec -T disal-db sh -c 'pg_restore --list /tmp/pre-update.dump >/dev/null'
if ($LASTEXITCODE -ne 0) { throw "El dump no es legible por pg_restore" }

dc cp disal-db:/tmp/pre-update.dump "$DirectorioBackup/postgres.dump"
Get-FileHash "$DirectorioBackup/postgres.dump" -Algorithm SHA256 |
  Format-List | Set-Content "$DirectorioBackup/postgres.sha256.txt"
```

El archivo debe tener tamaño mayor que cero y permanecer fuera del repositorio.

### Configuración y certificados

Copiar sin imprimir el contenido:

```powershell
Copy-Item .env "$DirectorioBackup/.env"

if (Test-Path infra/nginx/certs) {
  Compress-Archive -Path infra/nginx/certs -DestinationPath "$DirectorioBackup/nginx-certs.zip"
}
```

El directorio de backup contiene secretos y debe quedar protegido por permisos del sistema operativo.

### Node-RED externo de producción

El Node-RED productivo no pertenece a este checkout ni a este Compose. Antes de continuar:

1. Registrar el Compose/servicio externo y su responsable sin copiar credenciales al repositorio.
2. Confirmar que ese servicio tiene su propio backup vigente.
3. Exportar o respaldar el flujo específico que envía telemetría a DISAL mediante el procedimiento de
   ese Node-RED.
4. Acordar cómo pausar y reactivar únicamente ese flujo durante la ventana.

No ejecutar `docker compose stop`, `down`, `up`, `pull` o `restart` sobre el Compose externo desde este
runbook. Detener el contenedor completo podría afectar otros sistemas del servidor.

### Uploads

Respaldar el volumen mediante el servicio que ya lo monta, sin asumir el nombre físico que Compose le
asigna:

```powershell
dc run --rm --no-deps --volume "${DirectorioBackup}:/backup" --entrypoint sh `
  disal-uploads-init -c 'tar -czf /backup/uploads.tar.gz -C /uploads .'
if ($LASTEXITCODE -ne 0) { throw "Falló el backup de uploads_data" }

Get-FileHash "$DirectorioBackup/uploads.tar.gz" -Algorithm SHA256 |
  Format-List | Set-Content "$DirectorioBackup/uploads.sha256.txt"
```

Comprobar que el archivo tenga tamaño mayor que cero. No ejecutar la migración si el volumen contiene
datos y no se pudo respaldar.

## 4. Ensayar la restauración del dump

La existencia del archivo no demuestra que pueda restaurarse. Probarlo en un PostgreSQL temporal y
aislado:

```powershell
$ContenedorPrueba = "disal-restore-check-$MarcaTiempo"
docker run -d --name $ContenedorPrueba -e POSTGRES_PASSWORD=restore_check postgres:16-alpine

do {
  Start-Sleep -Seconds 2
  docker exec $ContenedorPrueba pg_isready -U postgres | Out-Null
} while ($LASTEXITCODE -ne 0)

docker cp "$DirectorioBackup/postgres.dump" "${ContenedorPrueba}:/tmp/postgres.dump"
docker exec $ContenedorPrueba createdb -U postgres restore_check
docker exec $ContenedorPrueba pg_restore -U postgres -d restore_check --no-owner /tmp/postgres.dump
if ($LASTEXITCODE -ne 0) { throw "Falló la restauración aislada" }

docker exec $ContenedorPrueba psql -U postgres -d restore_check -tAc `
  'SELECT COUNT(*) FROM "Plant"; SELECT COUNT(*) FROM "Tank"; SELECT COUNT(*) FROM "ProductionLot";'

docker rm -f $ContenedorPrueba
```

Registrar los conteos. Si la restauración falla, conservar el contenedor para diagnóstico o eliminarlo
explícitamente después de guardar los logs; no continuar con producción.

## 5. Abrir la ventana y detener escrituras

Confirmar que los usuarios fueron notificados. Solicitar al responsable del Node-RED externo que pause
únicamente el flujo que apunta a los endpoints de telemetría de esta aplicación. Después detener el
backend, manteniendo PostgreSQL activo para el backup final y la migración:

```powershell
dc stop disal-backend
```

No detener `disal-node-red`: no es el emisor productivo y puede no estar iniciado. No detener el
contenedor Node-RED externo completo. Si no existe una forma aprobada de pausar sólo el flujo dirigido a
DISAL, registrar esa limitación y acordar con el responsable si se acepta la pérdida temporal de
telemetría mientras el backend está detenido.

Después de detener escrituras, repetir los backups de PostgreSQL y uploads si cualquiera pudo cambiar
desde la copia preliminar. Validar el dump final con `pg_restore --list` y repetir el ensayo aislado de
la sección anterior. Usar esas copias finales como punto oficial de recuperación. Registrar inventarios
o conteos relevantes antes de migrar.

## 6. Cambiar al tag y validar configuración

```powershell
git switch --detach $VersionObjetivo
if ((git rev-parse HEAD) -ne (git rev-parse "$VersionObjetivo^{commit}")) {
  throw "El checkout no coincide con el tag objetivo"
}

dc config --quiet
dc config --services
```

No crear ni reemplazar `.env` durante una actualización. Si el tag introduce variables nuevas,
incorporarlas mediante el gestor seguro del servidor y volver a ejecutar `dc config --quiet` sin
mostrar sus valores.

## 7. Construir antes de migrar

El Compose actual construye backend, frontend y migrador desde el checkout; no descarga imágenes de
aplicación versionadas. Construir explícitamente:

```powershell
dc build disal-backend disal-frontend disal-migrate
if ($LASTEXITCODE -ne 0) { throw "Falló la construcción; no se aplicaron migraciones" }
```

Si la versión modifica Nginx, confirmar que su imagen y configuración se resuelvan correctamente. Los
cambios bajo `infra/node-red/` corresponden al entorno local/demo y no deben aplicarse automáticamente
al Node-RED externo; cualquier adaptación de ese flujo requiere una intervención separada y autorizada.

## 8. Aplicar migraciones una sola vez

```powershell
dc run --rm disal-migrate 2>&1 | Tee-Object "$DirectorioBackup/migracion.log"
$CodigoMigracion = $LASTEXITCODE
if ($CodigoMigracion -ne 0) { throw "Falló prisma migrate deploy" }
```

No usar `migrate resolve`, `db push`, SQL manual, seeds ni resets para forzar el resultado. Ante un
fallo, conservar la salida, mantener los escritores detenidos y aplicar la sección de rollback.

## 9. Recrear servicios sin repetir el migrador

Preparar permisos del volumen y recrear únicamente los servicios permanentes afectados:

```powershell
dc run --rm --no-deps disal-uploads-init
dc up -d --no-deps --force-recreate disal-backend disal-frontend disal-nginx
```

No ejecutar `dc up -d` sobre todo el stack: además de poder volver a crear el trabajo `disal-migrate`,
iniciaría el `disal-node-red` local/demo que no se utiliza en producción.

## 10. Verificación técnica

Esperar hasta que los servicios permanentes alcancen su estado esperado y comprobar:

```powershell
dc ps -a
dc logs --tail 100 disal-backend
dc logs --tail 100 disal-nginx
dc port disal-nginx 80
dc port disal-nginx 443
```

Resultado esperado:

- `disal-db` y `disal-backend`: `healthy`;
- `disal-frontend` y `disal-nginx`: `Up`;
- `disal-uploads-init`: finalización correcta;
- el `disal-migrate` ejecutado manualmente: código `0`, conservado en `migracion.log`;
- ausencia de errores nuevos y repetidos en los logs.

El estado de `disal-node-red` no forma parte de la aceptación productiva. Debe permanecer sin iniciar
si no se usa para pruebas locales. Verificar el Node-RED externo mediante su propio procedimiento y sin
alterar los demás flujos que aloja.

Usar el puerto y protocolo obtenidos de Compose, sin asumir `80`, `443` o `8081`. Verificar desde el
host:

```powershell
$PuertoHttp = ((dc port disal-nginx 80) -split ':')[-1]
$UrlBase = "http://localhost:$PuertoHttp"

# En una instalación HTTPS usar en cambio el puerto publicado para 443:
# $PuertoHttps = ((dc port disal-nginx 443) -split ':')[-1]
# $UrlBase = "https://localhost:$PuertoHttps"

(Invoke-WebRequest -UseBasicParsing "$UrlBase/api/auth/status" -TimeoutSec 10).StatusCode
(Invoke-WebRequest -UseBasicParsing "$UrlBase/api/plants/tv" -TimeoutSec 10).StatusCode
(Invoke-WebRequest -UseBasicParsing "$UrlBase/" -TimeoutSec 10).StatusCode
```

Las tres respuestas deben ser HTTP 200. En HTTPS se debe usar el certificado confiable configurado;
no desactivar su validación para ocultar un problema de TLS.

## 11. Verificación funcional

Con una cuenta operativa obtenida del gestor seguro, sin escribir credenciales en comandos o logs:

1. Iniciar sesión y confirmar la planta activa.
2. Abrir las pantallas principales afectadas por la versión.
3. Ejecutar las comprobaciones específicas de `RELEASE_NOTES_Vx.x.x.md`.
4. Confirmar que los datos anteriores continúan visibles y que los conteos críticos coinciden con el
   inventario previo.
5. Solicitar la reactivación del flujo específico en el Node-RED externo y verificar que vuelva a
   recibirse telemetría, sin reiniciar ni alterar sus demás flujos.
6. Confirmar actualización de la PWA o hacer una recarga completa si la nota lo solicita.

No crear OF/OE, finalizar lotes ni alterar producción real como smoke test sin autorización específica.

## 12. Cerrar la intervención

Registrar en un archivo de evidencia fuera del repositorio:

- servidor y fecha;
- versión anterior y tag nuevo;
- commit exacto desplegado;
- remoto utilizado;
- checksum y ubicación de backups;
- migraciones aplicadas;
- estados de contenedores;
- endpoints y pruebas funcionales verificadas;
- incidentes, decisiones manuales y responsable que aceptó el resultado.

Solicitar la reactivación del flujo externo sólo después de las verificaciones. Comunicar el resultado
y conservar el backup según la política de retención de la organización.

## Rollback

### Si falló antes de ejecutar migraciones

No hubo cambio de esquema. Volver al commit registrado, reconstruir la versión anterior y levantar los
servicios con el mismo conjunto Compose:

```powershell
$CommitAnterior = Get-Content "$DirectorioBackup/commit-anterior.txt"
git switch --detach $CommitAnterior
dc build disal-backend disal-frontend disal-migrate
dc up -d --no-deps --force-recreate disal-backend disal-frontend disal-nginx
```

### Si la migración ya se ejecutó

No iniciar código anterior contra el esquema nuevo suponiendo compatibilidad. Mantener escritores
detenidos, volver al commit anterior, restaurar PostgreSQL desde el dump final comprobado, restaurar
uploads si fueron modificados y reconstruir los servicios anteriores. El Node-RED externo no se
restaura desde este proyecto; su flujo dirigido a DISAL permanece pausado hasta completar el rollback.

La restauración de producción es una acción destructiva y debe contar con autorización explícita del
responsable. Si hubo escrituras posteriores al backup, detenerse y definir cómo conciliarlas antes de
restaurar. Registrar toda decisión y repetir las verificaciones técnicas y funcionales después del
rollback.
