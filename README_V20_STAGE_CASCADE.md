# Admissions V20 — Stage Cascade + Async Closer

## Cambios
- Setter usa cohorte por fecha de entrada y progresión por stages.
- Contacted = salió de New Lead / Cliente potencial.
- Responded = llegó a un stage distinto de No Answer / Nurturing.
- Meaningful y Qualified son acumulativos: si avanzó a una etapa superior, conserva el hito.
- Closer usa fecha real del evento: booking creation, appointment attendance, close stage event.
- Disqualified queda fuera de la cascada y se muestra como scorecard informativa por fecha real del stage event.
- Tour Attended y Pasadía Attended usan tono amarillo suave; Closed usa verde suave.
- Cola operativa / current stages no cambia.
- No cambia n8n, refresh button, Auth, Forms ni After School.

Supabase ya fue migrado en producción. Este release sólo requiere deploy del frontend.
