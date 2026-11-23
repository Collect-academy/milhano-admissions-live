-- 2026-11-23 | V2 Pasadía Scheduled: additive, service-role-only read model.
-- Already deployed as migration: milhano_trial_day_scheduled_isolated_read_model_20261123.
-- PostgreSQL default is SECURITY INVOKER (confirmed in pg_proc.prosecdef=false);
-- pg_get_functiondef omits that default keyword in the canonical export below.
-- No change to official V2/Agents RPCs, EOD, GHL, workflows or ElevenLabs.
CREATE OR REPLACE FUNCTION public.milhano_get_trial_days_scheduled_v1(p_start date, p_end date, p_scope text DEFAULT 'general'::text)
 RETURNS TABLE(metric_row_id text, ghl_opportunity_id text, ghl_contact_id text, lead_name text, contact_name text, student_name text, phone text, email text, source text, operational_owner text, current_pipeline_role text, pipeline_name text, current_stage text, opportunity_status text, lost_reason text, lead_at timestamp with time zone, metric_at timestamp with time zone, metric_event_id text, metric_title text, metric_status text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
SELECT
  'appointment:' || a.appointment_id AS metric_row_id,
  o.ghl_opportunity_id,
  o.ghl_contact_id,
  COALESCE(NULLIF(trim(o.student_name),''),
           NULLIF(trim(o.opportunity_name),''),
           NULLIF(trim(o.contact_name),''),
           o.ghl_contact_id,'Lead sin identificar') AS lead_name,
  o.contact_name,
  o.student_name,
  o.phone,
  o.email,
  o.source,
  COALESCE(NULLIF(trim(o.assigned_user),''),
           NULLIF(trim(o.historical_advisor),''),
           'Sin asignar') AS operational_owner,
  CASE
    WHEN o.pipeline_id='L9nSVkwjFsHN5WFDs3Aa' THEN 'legacy'
    WHEN o.pipeline_id='GYqHbZyWUxxc3K03efVT' THEN 'setter'
    WHEN o.pipeline_id='z1FEJfbtOHusjdwe40Ko' THEN 'closer'
    ELSE NULL
  END AS current_pipeline_role,
  o.pipeline_name,
  o.current_stage,
  o.status AS opportunity_status,
  o.lost_reason,
  o.created_at AS lead_at,
  a.start_time AS metric_at,
  a.appointment_id AS metric_event_id,
  a.title AS metric_title,
  a.appointment_status AS metric_status
FROM public.vw_milhano_appointment_events_v22 a
JOIN public.vw_milhano_opportunities_current o
  ON o.ghl_opportunity_id = a.metric_opportunity_id
WHERE p_scope IN ('general','closer')
  AND p_start IS NOT NULL AND p_end IS NOT NULL
  AND p_start <= p_end
  AND a.canonical_type = 'trial_day'
  -- The source marks the Retroalimentación calendar as trial_day as well.
  -- Scheduled must represent *actual Pasadía calendar appointments* only.
  AND a.calendar_id = 'a0bvCaXgCdVwSrgPELza'
  AND a.scheduled_date BETWEEN greatest(p_start,DATE '2026-09-01') AND p_end
  AND lower(coalesce(a.appointment_status,'')) NOT IN ('cancelled','canceled')
ORDER BY a.start_time DESC, lead_name, a.appointment_id;
$function$

REVOKE ALL ON FUNCTION public.milhano_get_trial_days_scheduled_v1(date,date,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.milhano_get_trial_days_scheduled_v1(date,date,text) TO service_role;
