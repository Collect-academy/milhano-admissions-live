MILHANO V23 — Owner + Productividad + Guardar Asistencia
=========================================================

SUPABASE
- Los cambios de Supabase ya fueron aplicados al proyecto de producción por ChatGPT.
- NO necesitas ejecutar database/MILHANO_V23_OWNER_PRODUCTIVITY.sql en producción para este deploy.
- El SQL se incluye únicamente como respaldo/reproducibilidad y para otros ambientes.

CAMBIOS FRONTEND/API
1. Copia/reemplaza en tu repo los archivos manteniendo exactamente las rutas de este ZIP.
2. Commit + push a main (o tu flujo normal).
3. Deja que Vercel haga el deploy.
4. No requiere nuevas variables de entorno.

VALIDACIÓN RÁPIDA DESPUÉS DEL DEPLOY
A) Dashboard /:
   - Debe aparecer “Productividad por agente”.
   - El selector debe incluir Cinthia Esquivel y Miguel Campos.
   - Al elegir un agente, se muestran asignadas actuales + actividad atribuida del rango.
   - Las cascadas principales siguen siendo del equipo; no se falsean atribuciones históricas.

B) Alumnos > Asistencia:
   - Marca presente/ausente y/o escribe notas.
   - Debe aparecer “N cambio(s) sin guardar”.
   - Presiona “Guardar asistencia”.
   - Debe confirmar “N cambio(s) guardado(s)”.
   - Recarga la página y confirma que las marcas/notas persisten.

NOTAS
- “Owner” usa el GHL user ID como clave estable; el nombre es sólo presentación.
- Miguel Campos está mapeado a CVHK8CdZzT6A7zLxr5Sg.
- Existe todavía un GHL user ID sin nombre resuelto: WieQXvNTFqSPfUgXy1LZ. No bloquea el funcionamiento; aparece con fallback “GHL · gXy1LZ”.
- La atribución de cambio de stage es “owner al momento del evento”: buen proxy operativo bajo el SOP de asignarse antes de trabajar, pero no es auditoría exacta de quién hizo clic.
- Llamadas/WhatsApp sin ghl_user_id no se adjudican artificialmente a un agente.
