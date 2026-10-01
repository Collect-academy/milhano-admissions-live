MILHANO V24 · AGENT ANALYTICS

QUÉ CAMBIA
- Productividad por agente sale del Resumen V2.
- Nueva vista /agentes y link "Agentes" en navegación.
- Scatter 07:00–15:00 por bloques de 15 min: CRM stages, owner assignments, llamadas y WhatsApp atribuibles.
- Métricas de cadencia: bloques activos de 30 min, pausa mediana, pausa mayor y acciones/bloque.
- Funnel Setter atribuido por primer assignedTo observado: New Leads -> Contacted -> Responded -> Meaningful -> Qualified.
- KPI Contacted -> School Tour booked.

SUPABASE
Los RPC milhano_get_agent_activity y milhano_get_agent_setter_funnel YA FUERON APLICADOS en producción.
El archivo database/MILHANO_V24_AGENT_ANALYTICS.sql va sólo para dejar el cambio versionado. NO necesitas ejecutarlo otra vez.

APLICACIÓN
Opción A: reemplaza/copias los archivos de este ZIP respetando las rutas.
Opción B: aplica MILHANO_V24_AGENT_ANALYTICS.patch desde la raíz del repo.

VALIDACIÓN POST-DEPLOY
1. / debe ya NO mostrar Productividad por agente.
2. La navegación debe mostrar Agentes.
3. /agentes debe abrir con un agente activo por defecto.
4. Selector "Todos los agentes" debe mostrar tabla comparativa.
5. Al seleccionar Cinthia/Miguel deben aparecer scatter y funnel.
6. Cambiar rango de fechas debe conservar el agente seleccionado.

NOTA DE DATOS
- CRM stage = owner_at_event, por lo que es un proxy operativo, no auditoría de clic exacto.
- Calls/WhatsApp sólo aparecen si GHL entrega ghl_user_id y el evento no es automatizado.
- La gráfica NO interpreta primera->última acción como horas trabajadas.
