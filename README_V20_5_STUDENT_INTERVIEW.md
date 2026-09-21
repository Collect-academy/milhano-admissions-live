# Milhano V20.5 · Formato 5 — Entrevista del Alumno

## Alcance
- Añade Formato 5 al módulo Alumnos.
- 16 preguntas de respuesta libre, agrupadas en aprendizaje, socioemocional, relaciones y salud/apoyos.
- El formato permite múltiples entrevistas por alumno para conservar historial.
- Formato 5 es abierto (ver + editar) para cualquier usuario que ya tenga acceso al módulo Alumnos.
- Formatos 2 y 3 conservan exactamente sus permisos confidenciales actuales.
- Nuevos usuarios que reciban acceso al módulo Alumnos obtienen automáticamente Formato 5.
- Se añade estado de Formato 5 al directorio y a la ficha del alumno.
- Las preguntas del Formato 5 tienen versión ES/EN en la interfaz.

## Deployment
La migración `database/MILHANO_V20_5_STUDENT_INTERVIEW.sql` ya fue aplicada al Supabase live durante la preparación de este release.
Para publicar la interfaz, subir los archivos del patch a `main`; Vercel hará el deploy normal. No requiere variables nuevas ni cambios de n8n.
