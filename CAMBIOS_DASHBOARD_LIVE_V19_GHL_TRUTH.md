# MILHANO Admissions V19 — GHL Truth Layer

This patch does one thing first: make the dashboard a fast read-model of GoHighLevel.

## What changes now

### Cohort
- Cutover moves from Sep 8 → **Sep 1, 2026**.
- Cohort membership uses the Opportunity `created_at` received from GHL.
- General cascade includes **Legacy + Setter + Closer**.
- Legacy pipeline is discovered from GHL by name, preferring `Leads Milhano` (the pre-cutover September pipeline) and keeping `Leads COLDEM` only as a historical fallback; its ID is never invented/hardcoded.

### AUTO metrics
The automatic cascade uses deterministic GHL evidence:
- communications already reconciled from GHL;
- current/past Opportunity stages;
- real School Tour appointments;
- real Pasadía appointments;
- appointment status (`showed/completed` = attended);
- current opportunity status/stage for closed milestones.

Manual EOD is still available as comparison, but is NOT injected into AUTO.

### Refresh
`Actualizar datos` now calls in parallel:
1. Existing WF09 → WhatsApp + calls + School Tour/Pasadía appointments + health/EOD.
2. New Full Reconciliation V4 → current Opportunities in all 3 pipelines.

This keeps hourly/scheduled refresh lightweight. Full Opportunity reconciliation happens only when the dashboard refresh button is used (or when V4 is run manually).

### Interactivity
- Metric lead rows are clickable.
- Lead detail uses one compact Supabase RPC.
- Lead detail shows:
  - current pipeline/stage/status;
  - GHL creation date;
  - School Tours and Pasadías;
  - appointment creation date;
  - appointment scheduled date;
  - appointment status;
  - appointment notes if present in GHL;
  - stage timeline;
  - recent GHL activity.

The old dashboard-only editable School Tour form is removed from this page so it cannot create a second source of truth.

## Deployment order

1. Supabase SQL Editor:
   `database/MILHANO_V19_ADMISSIONS_TRUTH_SEPTEMBER.sql`

2. n8n:
   import `MILHANO_01_Opportunities_Full_Reconciliation_V4_3_Pipelines_Truth.json`

3. In n8n node `Validate | Reconciliation Key`:
   replace `PASTE_SAME_VALUE_AS_MILHANO_N8N_REFRESH_KEY`
   with the current dashboard refresh key.

4. Activate V4 and copy its Production Webhook URL.

5. Vercel → Settings → Environment Variables:
   add:
   `MILHANO_N8N_RECONCILIATION_WEBHOOK_URL=<Production URL of V4>`

   Existing variables remain:
   `MILHANO_N8N_REFRESH_WEBHOOK_URL`
   `MILHANO_N8N_REFRESH_KEY`

6. Replace the changed GitHub files from this patch.

7. Redeploy Vercel.

8. Click `Actualizar datos`.

## First acceptance test

Pick a real September lead in GHL and verify:
- current stage matches;
- School Tour/Pasadía appears with its actual GHL status;
- appointment `Creada` and `Programada` dates match GHL;
- changing an appointment status in GHL + clicking Refresh changes the dashboard;
- moving the Opportunity to another stage in GHL + clicking Refresh changes the dashboard;
- no EOD/manual value is required for AUTO to change.

## Next patch after this passes
GHL write-back notes:
- one discreet note box in the lead detail;
- saved into GHL, not only Supabase;
- Lost/Lost Reason remains the primary reason for lost Opportunities;
- optional ST/Pasadía outcome custom fields only if Mona needs structured outcome reporting.
