# Sofía IA — módulo de rendimiento, campañas y workflows (11/09/2026)

## Alcance
Este cambio pertenece exclusivamente a `Collect-academy/milhano-admissions-live`. **No utilizar Collect Tracker.**
No se modifican `app/page.tsx` ni los cálculos de V2 Summary. La IA alimentará V2 Summary indirectamente mediante las etapas y las citas confirmadas que ya replica GHL→Supabase.

## Ya instalado en Supabase
- `milhano_ai_campaigns`, `milhano_ai_campaign_windows`, `milhano_ai_campaign_members`
- `milhano_ai_dispatch_attempts`, `milhano_ai_call_insights`, `milhano_ai_stage_decisions`
- Vistas: `milhano_ai_dashboard_daily`, `hourly`, `campaigns`, `disqualification_reasons`, `first_call_latency`, `objections`.
- Funciones: `milhano_ai_create_campaign_draft`, `milhano_ai_claim_one_due`, `milhano_ai_set_claim_result`, `milhano_ai_finish_attempt`, `milhano_ai_decide_stage_v1`.
- Esquema aditivo: las tablas nuevas tienen RLS activado y sin permisos de consulta/escritura directos para `anon` o `authenticated`. Sólo `service_role` (servidor/n8n).
- El planificador usa cerraduras transaccionales y control de concurrencia global inicial de una llamada.
- Las campañas se crean como `draft` con `dry_run = true`. No existe acción de activación en el dashboard.

## Dashboard (rama de desarrollo, no desplegado)
- `/sofia`: indicadores de llamadas, respuestas, conversaciones útiles, calificados, ST corroborados, motivos, objeciones, duración, consumo real y proyección condicionada a los datos.
- `/sofia/campanas`: búsqueda y filtros de oportunidades reales del pipeline Setter, orden por fecha asc/desc, selección individual, +10, +50 y selección de elegibles. Ventanas de Mérida, cálculo de capacidad y borrador.
- API `POST /api/sofia/campaigns`: sólo `admin`, valida selección y mantiene transacción atómica mediante RPC.
- La elegibilidad al guardar se contrasta con el espejo de GHL en Supabase; ANTES DE CADA MARCACIÓN deberá comprobarse nuevamente el estado GHL en vivo.
- No se almacenan ni exponen secretos en código público.

## n8n — archivos para importación, TODOS DESACTIVADOS
1. `n8n/MILHANO_05_Sofia_Stage_Decision_Engine_V1_DRAFT.json`
   - Relee oportunidad y nota reales en GHL.
   - Consulta la función SQL de reglas excluyentes.
   - Registra propuesta y revisa el registro de intento.
   - `ALLOW_STAGE_WRITES = false`: **ningún cambio automático de etapa**.
   - Callback no puede avanzar si no existe una tarea verificada; reserva no cuenta si el calendario GHL no la confirma.
2. `n8n/MILHANO_04_Sofia_Post_Call_Supabase_AI_Insights_V3_DRAFT.json`
   - Clon del flujo Post Call 04 V2.1: conserva sus nodos originales de GHL, agrega ingesta y propuesta a Supabase.
   - Webhook de **vista previa** independiente `/webhook/milhano-ai-postcall-sofia-v3-preview-20261109`, para no colisionar con el webhook productivo v2.
   - Referencia las credenciales existentes `Milhano GHL PrivInt` y `Supabase Milhano`.
   - Reenvía llamadas con nota confirmada al 05, con `continueOnFail` para no romper la nota.
   - No considera el silencio sin estado telefónico explícito como 'No answer'; no contabiliza como visita real el éxito aislado de la herramienta.
3. `n8n/MILHANO_06_Sofia_Batch_Scheduler_V1_DISABLED.json`
   - Reutiliza el feed individual 03 existente; no crea un workflow por lote.
   - Selecciona un intento a la vez desde la cola, reconsulta GHL, bloquea DND y cambios de etapa; exige ID de conversación para considerarlo despachado.
   - `ENABLE_BATCH_OUTBOUND = false` y workflow inactivo: **no se realizan llamadas**.

**Importante:** el entorno real de n8n no está conectado como herramienta aquí. Los workflows fueron validados como JSON con enlaces de nodos existentes y sintaxis JS, pero **no se han importado ni ejecutado en n8n**. Las credenciales se referencian por los IDs existentes: comprobar que se reconozcan tras importar.

## Reglas excluyentes
- No respuesta: sólo señal telefónica explícita, nunca inferida sólo de cero turnos de texto. Se requieren dos eventos verificados para avanzar de New Lead→D1→D2→D3→Nurturing, comparando la etapa original.
- Callback: solicitud explícita + tarea en GHL verificada antes del cambio. Si falta, revisión.
- Descalificado: causa explícita registrable; si es incierta, revisión.
- Meaningful y Qualified: evidencia de conversación e indicadores pedagógicos verificados, no sólo salida libre del modelo.
- School Tour: debe existir cita corroborada en GHL; después se sigue el flujo de Closer (no generar un segundo hito en Setter).
- Contradicción, nota ausente, cambio concurrente, oportunidad en otro pipeline: NO escribir etapa.

## Puertas antes de autorizar producción
1. Confirmar en pruebas que el webhook v3 de ElevenLabs recibe el evento completo, y que el agente/branch de producción es Sofía V2 correcta.
2. Comprobar variables, costos/credits explícitos, notas GHL sin duplicados y entradas correlacionadas en Supabase.
3. Probar devolución de llamadas y tareas, GHL booking y duplicidad/reprogramación de citas.
4. Verificar n8n 05 con escenarios contradicción, DND, fallas, callback, conversación significativa, calificados y dos no-respuestas.
5. Verificar respuesta del workflow 03 al 06, timeout, idempotencia y liberación/conciliación de intentos fallidos; los estados dudosos **nunca se reintentan automáticamente**.
6. Revisar seguridad de la tabla **existente** `milhano_ai_setter_dispatches`: continúa con RLS desactivado y posibles permisos de `anon`; no tocar sin comprobar las dependencias de los workflows originales.
7. Ejecutar piloto de 10 llamadas con concurrencia 1; comparar Supabase/GHL y créditos antes de ampliar.
8. Activar la escritura de etapas sólo después de verificar nota, tarea, cita, concurrencia, y auditoría. El workflow 05 entregado sigue **DESACTIVADO POR DISEÑO** para esta fase.

## Trabajo manual inevitable (cuando se programe prueba)
- Importar en n8n los tres JSON de esta carpeta y comprobar que reconocen las dos credenciales guardadas (05, 04 vista previa, 06).
- Configurar en ElevenLabs la emisión de un evento de prueba hacia el webhook v3 *sin sustituir de momento el flujo productivo*.
- No activar 04 nuevo, 05 ni 06 en producción sin la validación de las puertas previas. El dashboard en la rama aún requiere PR/merge y pruebas de compilación/despliegue.
- No editar manualmente Supabase ni el pipeline GHL en esta fase.

## Limitaciones actuales
- Los reportes nuevos empiezan vacíos, porque el workflow 04 v3 aún no envía datos.
- Créditos estimados se muestran sólo si hay créditos reales reportados; no se inventan equivalencias monetarias.
- El planificador crea borradores, **no campañas ejecutables** desde la UI hasta cerrar y probar el despacho completo.
- No se han verificado builds de Next.js en un CI; no desplegar antes de compilar y corregir errores.
- Ni GHL ni ElevenLabs ni n8n se han modificado en producción.
