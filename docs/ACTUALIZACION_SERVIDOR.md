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

## Datos que se deben solicitar o confirmar

Antes de comenzar deben estar definidos:

- tag objetivo, por ejemplo `V0.0.36`;
- remoto autorizado, normalmente `origin` o `laboral`;
- si el servidor usa HTTP o el overlay `docker-compose.https.yml`;
- URL de comprobación accesible desde el servidor;
- ventana de mantenimiento y responsable que valida el resultado;
- existencia de integraciones Node-RED externas al Compose y forma aprobada de detenerlas;
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

Si el estado Git no está limpio, no corregirlo automáticamente. En especial, respaldar y revisar
`infra/node-red/data` antes de decidir cómo tratar sus cambios.

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

### Configuración, Node-RED y certificados

Copiar sin imprimir el contenido:

```powershell
Copy-Item .env "$DirectorioBackup/.env"
Compress-Archive -Path infra/node-red/data -DestinationPath "$DirectorioBackup/node-red.zip"

if (Test-Path infra/nginx/certs) {
  Compress-Archive -Path infra/nginx/certs -DestinationPath "$DirectorioBackup/nginx-certs.zip"
}
```

El directorio de backup contiene secretos y debe quedar protegido por permisos del sistema operativo.
Si existe un Node-RED externo, respaldarlo mediante su procedimiento propio antes de continuar.

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

Confirmar que los usuarios fueron notificados. Detener los escritores administrados por este Compose,
manteniendo PostgreSQL activo para la migración:

```powershell
dc stop disal-node-red disal-backend
```

Detener también cualquier Node-RED, PLC/SCADA o integrador externo mediante el procedimiento acordado.
No basta con detener el Node-RED incluido si existen emisores externos.

Después de detener escrituras, repetir los backups de PostgreSQL, uploads y Node-RED si cualquiera pudo
cambiar desde la copia preliminar. Validar el dump final con `pg_restore --list` y repetir el ensayo
aislado de la sección anterior. Usar esas copias finales como punto oficial de recuperación. Registrar
inventarios o conteos relevantes antes de migrar.

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

Si la versión modifica Nginx o Node-RED, confirmar también que sus imágenes y configuraciones se
resuelvan correctamente antes de continuar.

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
dc up -d --no-deps --force-recreate disal-node-red
```

Si Node-RED es externo o su runtime no debe recrearse, omitir la última línea y reactivarlo mediante su
procedimiento propio. No ejecutar inmediatamente `dc up -d` sobre todo el stack: esa forma puede volver
a crear el trabajo `disal-migrate`, aunque una segunda ejecución sea normalmente idempotente.

## 10. Verificación técnica

Esperar hasta que los servicios permanentes alcancen su estado esperado y comprobar:

```powershell
dc ps -a
dc logs --tail 100 disal-backend
dc logs --tail 100 disal-nginx
dc logs --tail 100 disal-node-red
dc port disal-nginx 80
dc port disal-nginx 443
```

Resultado esperado:

- `disal-db` y `disal-backend`: `healthy`;
- `disal-frontend`, `disal-nginx` y el Node-RED administrado: `Up`;
- `disal-uploads-init`: finalización correcta;
- el `disal-migrate` ejecutado manualmente: código `0`, conservado en `migracion.log`;
- ausencia de errores nuevos y repetidos en los logs.

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
5. Verificar recepción de telemetría sólo después de reactivar el integrador correspondiente.
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

Reactivar integraciones externas sólo después de las verificaciones. Comunicar el resultado y conservar
el backup según la política de retención de la organización.

## Rollback

### Si falló antes de ejecutar migraciones

No hubo cambio de esquema. Volver al commit registrado, reconstruir la versión anterior y levantar los
servicios con el mismo conjunto Compose:

```powershell
$CommitAnterior = Get-Content "$DirectorioBackup/commit-anterior.txt"
git switch --detach $CommitAnterior
dc build disal-backend disal-frontend disal-migrate
dc up -d --no-deps --force-recreate disal-backend disal-frontend disal-nginx
dc up -d --no-deps --force-recreate disal-node-red
```

### Si la migración ya se ejecutó

No iniciar código anterior contra el esquema nuevo suponiendo compatibilidad. Mantener escritores
detenidos, volver al commit anterior, restaurar PostgreSQL desde el dump final comprobado, restaurar
uploads/Node-RED si fueron modificados y reconstruir los servicios anteriores.

La restauración de producción es una acción destructiva y debe contar con autorización explícita del
responsable. Si hubo escrituras posteriores al backup, detenerse y definir cómo conciliarlas antes de
restaurar. Registrar toda decisión y repetir las verificaciones técnicas y funcionales después del
rollback.
