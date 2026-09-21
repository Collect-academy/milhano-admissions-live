# Milhano V20.4 fixes

This release is intentionally limited to four requested fixes.

1. Pipeline stage selector now merges the canonical `milhano_v2_stage_map` with stages present in the selected period, so stages such as `No answer - Day 3` and `Never Answered / Nurturing A` remain selectable even when the selected period has zero opportunities currently sitting there.
2. EOD Trial Day metrics are re-enabled in `milhano_eod_metric_catalog`. This fixes `trial_days_booked` and `trial_days_showed` persistence in the manual EOD view. The live Supabase migration was already applied; the SQL file is included for source control/reproducibility.
3. Manual EOD history uses a vertically scrollable table with sticky column headers, keeping metric names visible while reviewing long months.
4. Student directory adds Level and Grade filters. The filters use the same existing student-module access and RLS path; no permissions are expanded.

No changes to n8n, Auth, user roles, student form permissions, After School workflows, or dashboard refresh webhooks.
