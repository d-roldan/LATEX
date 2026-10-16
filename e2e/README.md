# Pruebas industriales Playwright

`npm test` ejecuta Playwright Test; `npm run test:list` enumera casos sin tocar una aplicación. Los scripts históricos `flujo-completo.js`, `orders-panel-e2e.js`, `reproducir-incidente.js` y `tv-public-e2e.js` permanecen separados. Los tres primeros pueden contener supuestos y credenciales demo; no forman parte de la suite industrial ni deben ejecutarse contra un sistema activo.

La suite `tests/industrial.spec.js` cubre fabricación → Laboratorio → aprobación → envasado → vacío; ajuste, rechazo, transición inválida e historial; rechazo de permisos por backend, opción oculta en frontend y separación entre plantas. Usa un tanque vacío en una planta cuya operación final es `PACKAGING`. Sus datos son deliberadamente descartables. El escenario serial deja el tanque vacío si termina normalmente; ante un fallo se descarta el volumen aislado, nunca se limpia una base operativa.

## Entorno obligatorio

Ejecutar sólo en un host o runner sin el stack LATEX activo. El Compose vigente usa nombres de contenedor fijos, por lo que no conviven dos proyectos en el mismo daemon. Crear `.env.e2e` local a partir de `.env.example`, con `POSTGRES_DB=latex_e2e`, `DATABASE_URL` apuntando a `disal-db/latex_e2e`, puertos libres, secretos de prueba y `NODE_ENV=development`. No reutilizar respaldos ni credenciales productivas.

Con el proyecto `latex-e2e`, iniciar sólo `disal-db`, construir el backend y ejecutar `prisma:install-empty` **únicamente tras verificar que el volumen es nuevo y la base está vacía**. Crear datos de prueba y usuarios según `docs/DESPLIEGUE_MULTIPLANTA.md`; el seed es opcional y sólo corresponde a esta base descartable. Después iniciar backend, frontend y nginx. No iniciar Node-RED ni enlazar PLC/InfluxDB. En todos los comandos usar el prefijo `docker compose -p latex-e2e --env-file .env.e2e`:

```powershell
docker compose -p latex-e2e --env-file .env.e2e up -d disal-db
docker compose -p latex-e2e --env-file .env.e2e build disal-migrate disal-backend disal-frontend
docker compose -p latex-e2e --env-file .env.e2e run --rm --no-deps disal-migrate npm run prisma:install-empty
# Crear usuarios y datos descartables con el procedimiento de instalación vacía.
docker compose -p latex-e2e --env-file .env.e2e up -d disal-backend disal-frontend disal-nginx
```

El preflight comprueba etiquetas Compose, volumen PostgreSQL, nombre de base en PostgreSQL y backend, y puerto Nginx antes de cualquier llamada a la API.

Definir en el proceso de prueba `E2E_DISPOSABLE=latex-e2e`, `E2E_BASE_URL=http://127.0.0.1:<puerto>` y las variables listadas en `support/preflight.cjs`. El usuario administrador debe acceder al tanque y a ambas plantas; el operador debe ser `FABRICACION`, acceder sólo a `E2E_PLANT_CODE` y no a `E2E_OTHER_PLANT_CODE`. El tanque `E2E_TANK_ID` debe empezar `VACIO`. Los códigos de material, línea, formato, dosificadora y filtro deben ser válidos para esa planta. El preflight falla si falta cualquier dato o el destino no es el Compose descartable. Las credenciales se suministran por entorno; nunca se versionan.

```powershell
cd e2e
npm ci
npx playwright install chromium
npm run test:list
npm run test:industrial
npx playwright test tests/industrial.spec.js --grep "permisos"
```

Los reportes, capturas y trazas se guardan en `output/e2e-report` y `output/e2e-results`, ignorados por Git. El workflow manual requiere un runner etiquetado `latex-e2e` y un entorno GitHub `e2e` con variables/secretos de prueba; hasta que exista esa infraestructura, queda preparado pero no se considera ejecutado.
