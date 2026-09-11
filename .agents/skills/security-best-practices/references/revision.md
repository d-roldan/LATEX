# Método de revisión y corrección

Adaptación del procedimiento de informes y correcciones de OpenAI.

## Evidencia y alcance

Identificar qué se revisa: archivos cambiados, una función, una integración o todo el repositorio. Si el contexto ya lo determina, continuar con ese alcance. Distinguir código activo de ejemplos, scripts heredados y configuraciones de desarrollo.

Seguir cada flujo desde la entrada hasta su uso sensible. Registrar el control presente o ausente y las condiciones necesarias para que exista impacto. Una coincidencia de búsqueda no demuestra una vulnerabilidad. No inventar endpoints, exposiciones de red ni un despliegue productivo que no se inspeccionó.

Cuando falte una referencia específica para una biblioteca, indicarlo y consultar documentación primaria si la conclusión depende de ella. No aplicar reglas de otro framework como si fueran equivalentes.

## Informe

Para una auditoría solicitada, escribir el informe en la ubicación indicada o en `security_best_practices_report.md` de la raíz. Incluir una introducción breve, alcance y hallazgos ordenados por severidad.

Cada hallazgo debe incluir:

- Identificador y título concreto.
- Severidad y condiciones de explotación o fallo.
- Archivo, línea verificada y evidencia mínima sin secretos.
- Impacto sobre usuarios, datos u operación.
- Corrección propuesta y forma de validarla.
- Incertidumbres o controles externos pendientes de verificar.

Separar vulnerabilidades demostradas, riesgos condicionados y mejoras opcionales. Explicar el impacto de los hallazgos críticos en una frase clara. Si no se encuentran problemas, indicar qué se revisó y sus límites; no certificar que todo el sistema es seguro.

## Correcciones

Corregir dentro del alcance autorizado. Si el usuario pidió sólo revisar, entregar el informe; si pidió revisar y corregir, avanzar con los arreglos correspondientes sin repetir una solicitud de permiso por cada hallazgo.

Hacer cambios enfocados y comprobar regresiones en autenticación, permisos, errores y flujos afectados. No modificar datos o configuración productiva como parte implícita de un diagnóstico local. Preservar las pruebas que demuestran el fallo y añadir casos significativos cuando corresponda.

Mantener las convenciones de commit del proyecto cuando se haya solicitado un commit. Separar problemas no relacionados para facilitar su revisión. Informar cualquier comportamiento que cambie, no sólo la regla aplicada.

## Datos sensibles

No copiar tokens, contraseñas, cookies o claves a informes, ejemplos ni mensajes. Si se observa una credencial, indicar ubicación y naturaleza sin reproducir su valor. Las trazas de navegador y logs también pueden contener datos sensibles.

Los identificadores aleatorios dificultan enumeración pero no reemplazan autorización. No recomendar cambiar claves primarias sin analizar compatibilidad y coste; corregir primero la comprobación de acceso cuando ése sea el problema.
