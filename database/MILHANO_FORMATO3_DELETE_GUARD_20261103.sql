-- Formato 3: protect populated student psychology records from deletion.
-- Install BEFORE deploying the accompanying frontend changes.
-- Idempotent: safe to re-run. Does not remove existing records.
BEGIN;

ALTER TABLE public.milhano_student_form_records
  ADD COLUMN IF NOT EXISTS has_ever_content boolean NOT NULL DEFAULT false;

-- Historical evaluations are protected even when incomplete; new drafts
-- are only protected once an actual document title/content has been saved.
UPDATE public.milhano_student_form_records
SET has_ever_content = true
WHERE definition_code = 'form_3_evaluation'
  AND has_ever_content = false
  AND (
    (payload ->> 'editor_version') IS DISTINCT FROM '1'
    OR nullif(btrim(coalesce(payload ->> 'document_title', '')), '') IS NOT NULL
    OR nullif(btrim(coalesce(payload ->> 'content_text', '')), '') IS NOT NULL
    OR nullif(btrim(regexp_replace(replace(replace(coalesce(payload ->> 'content_html',''),'&nbsp;',' '),'&#160;',' '), '<[^>]*>', '', 'g')), '') IS NOT NULL
  );

CREATE OR REPLACE FUNCTION public.milhano_guard_form3_record_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $guard$
DECLARE
  v_authorized_admin boolean := false;
  v_is_empty boolean := false;
  v_has_content boolean := false;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.definition_code = 'form_3_evaluation' THEN
    -- Monotonic marker: no API client can turn historical content back to false.
    v_has_content :=
      (NEW.payload ->> 'editor_version') IS DISTINCT FROM '1'
      OR nullif(btrim(coalesce(NEW.payload ->> 'document_title','')), '') IS NOT NULL
      OR nullif(btrim(coalesce(NEW.payload ->> 'content_text','')), '') IS NOT NULL
      OR nullif(btrim(regexp_replace(replace(replace(coalesce(NEW.payload ->> 'content_html',''),'&nbsp;',' '),'&#160;',' '), '<[^>]*>', '', 'g')), '') IS NOT NULL;
    NEW.has_ever_content := coalesce(OLD.has_ever_content, false) OR v_has_content;
  ELSIF TG_OP = 'INSERT' AND NEW.definition_code = 'form_3_evaluation' THEN
    NEW.has_ever_content :=
      (NEW.payload ->> 'editor_version') IS DISTINCT FROM '1'
      OR nullif(btrim(coalesce(NEW.payload ->> 'document_title','')), '') IS NOT NULL
      OR nullif(btrim(coalesce(NEW.payload ->> 'content_text','')), '') IS NOT NULL
      OR nullif(btrim(regexp_replace(replace(replace(coalesce(NEW.payload ->> 'content_html',''),'&nbsp;',' '),'&#160;',' '), '<[^>]*>', '', 'g')), '') IS NOT NULL;
  END IF;

  IF TG_OP = 'DELETE' AND OLD.definition_code = 'form_3_evaluation' THEN
    v_is_empty := NOT coalesce(OLD.has_ever_content, true)
      AND OLD.completion_status = 'empty'
      AND OLD.payload ->> 'editor_version' = '1';
  ELSIF TG_OP = 'UPDATE' AND OLD.definition_code = 'form_3_evaluation'
        AND OLD.is_archived = false AND NEW.is_archived = true THEN
    v_is_empty := NOT coalesce(OLD.has_ever_content, true)
      AND OLD.completion_status = 'empty'
      AND OLD.payload ->> 'editor_version' = '1';
  ELSE
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF v_is_empty THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.milhano_app_users u
    WHERE u.auth_user_id = (SELECT auth.uid()) AND u.is_active = true
      AND u.role = 'admin' AND u.username IN ('MonaCashflow','CinthiaEsquivel')
  ) INTO v_authorized_admin;

  IF NOT v_authorized_admin THEN
    RAISE EXCEPTION 'Solo Mona o Cinthia pueden eliminar un documento que tuvo información.'
      USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END
$guard$;

DROP TRIGGER IF EXISTS trg_milhano_guard_form3_record_removal ON public.milhano_student_form_records;
CREATE TRIGGER trg_milhano_guard_form3_record_removal
BEFORE INSERT OR UPDATE OR DELETE ON public.milhano_student_form_records
FOR EACH ROW EXECUTE FUNCTION public.milhano_guard_form3_record_removal();

COMMIT;
