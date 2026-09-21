-- Milhano Admissions V20.4
-- Fix: Trial Day / Pasadía EOD metrics were present in the UI but inactive in
-- milhano_eod_metric_catalog, so milhano_save_eod_submission ignored them and
-- vw_milhano_eod_dashboard hid them.

begin;

update public.milhano_eod_metric_catalog
set is_active = true
where metric_key in ('trial_days_booked', 'trial_days_showed')
  and is_active is distinct from true;

commit;
