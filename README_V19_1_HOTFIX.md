# V19.1 HOTFIX — Exact GHL pipelines

Confirmed by GHL:
- Antiguo Leads Milhano — L9nSVkwjFsHN5WFDs3Aa
- Leads Milhano (Setter pipeline) — GYqHbZyWUxxc3K03efVT
- Leads Milhano (Closer Pipeline) — z1FEJfbtOHusjdwe40Ko

The previous V19 migration was not applied: the database still has the Sep 8 V2 functions and does not have the V19 opportunity snapshot columns.

## Apply in this order
1. Supabase SQL Editor:
   `database/MILHANO_V19_1_ADMISSIONS_TRUTH_SEPTEMBER_EXACT_PIPELINES.sql`
2. Import the V4.1 n8n JSON.
3. Set the same reconciliation key in `Validate | Reconciliation Key`.
4. Run manually once.
5. Confirm `resolved_pipeline_ids` and the three opportunity counts.
6. Only then connect the production webhook to Vercel.

V4.1 removes the unnecessary `Supabase | Register Pipeline Registry` node entirely.
