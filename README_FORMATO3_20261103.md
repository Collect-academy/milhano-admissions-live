# Milhano · Formato 3 de Psicología — 2026-11-03

## Alcance

- El **Formato 3** de alumnos crea ahora fichas de texto libre (HTML básico, sin imágenes ni adjuntos), con título editable, fecha e historial por alumno.
- El contenido se guarda en la tabla EXISTENTE `public.milhano_student_form_records`, columna `payload`, sin tablas ni buckets nuevos.
- Las fichas anteriores que usan los campos del protocolo original conservan la pantalla original, sus datos y sus permisos.
- El editor nuevo admite negritas, cursivas, subrayado, listas, deshacer mediante navegador, pegado en texto plano y salida Imprimir/PDF (solo exportación local, sin subirlo a la base).
- Se respetan los permisos de lectura y edición del Formato 3; la acción de guardado valida el usuario, alumno, código de formato y estado del registro.
- Contenido con tope de 100,000 caracteres de texto y 200 KB de HTML por documento; sanitizado otra vez en el servidor, eliminando etiquetas no permitidas y TODOS los atributos.

## Base de datos

**El ajuste ya fue aplicado directamente** al proyecto Supabase `milhano-operations` (`mhfncmxlpwzyuupxjlxo`) el 2026-11-03.

El SQL `FORMATO3_PSYCHOLOGY_DB_20261103.sql` conserva la lógica anterior y añade el caso de `payload.editor_version=1`: documento vacío = `empty`; documento con contenido = `complete`. El resto de formatos y los registros legacy mantienen su validación. **No es necesario volver a ejecutar el SQL en ese proyecto.**

Verificación posterior: cinco fichas originales de Formato 3 conservadas; cero fichas nuevas de prueba.

## GitHub

1. Subir los archivos modificados a las rutas existentes, manteniendo las carpetas (o reemplazar el repositorio con el ZIP completo, sin subir el ZIP como un solo archivo).
2. Hacer commit y dejar que Vercel despliegue.
3. Probar en un alumno: `Formato 3 > Nuevo documento`, escribir, guardar, salir, volver a abrir, editar, imprimir. Comprobar también que una ficha antigua conserve todos sus campos.
4. Probar un usuario sin permiso de ver/editar. No usar datos clínicos reales en las pruebas.

**Limitación de QA:** se verificaron sintaxis TS/TSX y pruebas de sanitización; no se pudo ejecutar `npm ci`/`next build` en este entorno porque la caché local de npm no contiene todas las dependencias y no hay acceso a su registro. El build definitivo se validará en Vercel.

## Alerta independiente

La tabla `milhano_ai_setter_dispatches` tiene RLS deshabilitado. No se modificó porque no pertenece al cambio de Psicología y su corrección requiere revisar políticas para evitar bloquear integraciones existentes.
