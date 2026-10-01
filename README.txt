MILHANO V26 — Fallback histórico a Paty + colores por agente

Cambios de frontend incluidos:
- app/agentes/page.tsx
- components/agent-activity-scatter.tsx
- components/agent-conversion-funnel.tsx
- lib/agent-analytics.ts

Supabase YA fue actualizado directamente. No ejecutar SQL.

Criterio V26:
- Unidad = Opportunity, nunca Contact.
- Opp trabajada = primera salida de New Lead hacia otro stage operativo.
- Si el stage event no trae assignee, temporalmente se atribuye a Paty Carrillo.
- El Contact owner no participa en las métricas.
- Scatter: Paty gris; los demás agentes usan colores distintos.
- Este fallback es temporal hasta que todo el equipo use assignee de forma obligatoria.
