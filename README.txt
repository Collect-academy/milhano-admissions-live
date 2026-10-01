Fix puntual para el error de Vercel:
Parameter 'row' implicitly has an 'any' type.

Reemplaza únicamente:
app/api/alumnos/asistencia/route.ts

O aplica fix.patch desde la raíz del repo:
git apply fix.patch

El cambio sólo agrega el tipo AttendanceRow y tipa incomingRows/rows.
No cambia la lógica de guardado ni Supabase.
