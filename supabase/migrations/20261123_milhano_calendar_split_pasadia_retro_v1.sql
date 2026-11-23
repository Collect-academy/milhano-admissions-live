-- 2026-11-23 · Calendar split Pasadía / Retroalimentación.
-- Applied as milhano_separate_pasadia_retro_calendar_read_model_20261123.
-- Additive read-only RPC: does not alter original appointment records or official KPIs.
-- SECURITY INVOKER is PostgreSQL default; pg_get_functiondef may omit explicit keyword.
-- Exact calendar_id is the classifier, not appointment_type (GHL labeled feedback as trial_day).
CREATE OR REPLACE FUNCTION public.milhano_get_calendar_appointment_rows_v1(p_start date, p_end date, p_scope text DEFAULT 'closer'::text)
 RETURNS TABLE(metric_row_id text, ghl_opportunity_id text, ghl_contact_id text, lead_name text, contact_name text, student_name text, phone text, email text, source text, operational_owner text, current_pipeline_role text, pipeline_name text, current_stage text, opportunity_status text, lost_reason text, lead_at timestamp with time zone, appointment_id text, calendar_id text, calendar_key text, appointment_title text, appointment_status text, date_added timestamp with time zone, booked_date date, start_time timestamp with time zone, scheduled_date date, lead_operational_date date, today_local date)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
SELECT
  'appointment:' || a.appointment_id,
  o.ghl_opportunity_id,
  o.ghl_contact_id,
  COALESCE(NULLIF(trim(o.student_name),''),
    NULLIF(trim(o.opportunity_name),''),
    NULLIF(trim(o.contact_name),''),
    o.ghl_contact_id,'Lead sin identificar'),
  o.contact_name,o.student_name,o.phone,o.email,o.source,
  COALESCE(NULLIF(trim(o.assigned_user),''),
    NULLIF(trim(o.historical_advisor),''),'Sin asignar'),
  CASE WHEN o.pipeline_id='L9nSVkwjFsHN5WFDs3Aa' THEN 'legacy'
    WHEN o.pipeline_id='GYqHbZyWUxxc3K03efVT' THEN 'setter'
    WHEN o.pipeline_id='z1FEJfbtOHusjdwe40Ko' THEN 'closer'
    ELSE NULL END,
  o.pipeline_name,o.current_stage,o.status,o.lost_reason,o.created_at,
  a.appointment_id,a.calendar_id,
  CASE WHEN a.calendar_id='a0bvCaXgCdVwSrgPELza' THEN 'pasadia'
    ELSE 'retroalimentacion' END,
  a.title,a.appointment_status,a.date_added,
  (a.date_added AT TIME ZONE 'America/Merida')::date,
  a.start_time,a.scheduled_date,
  public.milhano_operational_date(o.created_at),
  (now() AT TIME ZONE 'America/Merida')::date
FROM public.vw_milhano_appointment_events_v22 a
JOIN public.vw_milhano_opportunities_current o
  ON o.ghl_opportunity_id=a.metric_opportunity_id
WHERE p_scope IN ('general','closer')
  AND p_start IS NOT NULL AND p_end IS NOT NULL
  AND p_start<=p_end
  AND a.calendar_id IN ('a0bvCaXgCdVwSrgPELza','Vkw8NTh2ag1QyEzu962b')
  AND (
    (a.date_added AT TIME ZONE 'America/Merida')::date
       BETWEEN greatest(p_start,date '2026-09-01') AND p_end
    OR a.scheduled_date
       BETWEEN greatest(p_start,date '2026-09-01') AND p_end
    OR a.scheduled_date=(now() AT TIME ZONE 'America/Merida')::date
  )
ORDER BY a.start_time DESC NULLS LAST, a.appointment_id;
$function$

REVOKE ALL ON FUNCTION public.milhano_get_calendar_appointment_rows_v1(date,date,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.milhano_get_calendar_appointment_rows_v1(date,date,text) TO service_role;
