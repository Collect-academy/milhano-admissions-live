# Milhano Admissions Live — V18 / Admissions V2

This package is based on the dashboard ZIP supplied on 2026-09-09. The student-records module is preserved; this release adds a new Admissions V2 without deleting the V1 history.

## Admissions versions

- `/` — **Admissions V2 / Actual**, effective from **2026-09-08**.
- `/legacy` — **Admissions V1 / Legacy**, automatically capped at **2026-09-07**.
- `/v2/leads` — lead drilldown for V2 funnel milestones.
- Existing `/pipeline`, `/whatsapp`, `/llamadas`, `/eod`, `/reconciliation`, `/logs`, `/sistema`, and `/alumnos` remain available.

## V2 structure

### Setter · Pathi Carrillo
Pipeline ID: `GYqHbZyWUxxc3K03efVT`

Operational stages:
`New Lead → No answer D1 → No answer D2 → No answer D3 → Nurturing A → Meaningful Conversation → Callback → Qualified / Disqualified`

Funnel:
`New Leads → Contacted → Responded → Meaningful Conversation → Qualified`

No-answer, Callback, Nurturing and Disqualified remain visible as current operational states but are not treated as positive conversion steps.

### Closer · Cinthia Esquivel
Pipeline ID: `z1FEJfbtOHusjdwe40Ko`

Operational stages:
`Tour Booked → Tour Cancelled/No-show Nurturing B → Tour Attended → Pasadia Booked → Pasadia Cancelled/No-show Nurturing B → Pasadia Attended → Closed/Enrolled`

Funnel:
`Tour Booked → Tour Attended → Pasadía Booked → Pasadía Attended → Closed/Enrolled`

The same GHL opportunity is expected to move from Setter to Closer when School Tour booking occurs. V2 therefore stores `pipeline_id` on the current opportunity while keeping stage events as the longitudinal trail.

### General cascade
`New Leads → Contacted → Responded → Meaningful Conversation → Qualified → Tour Booked → Tour Attended → Pasadía Booked → Pasadía Attended → Closed/Enrolled`

All percentages are based on the same V2 lead cohort. Reaching a later milestone implies the necessary earlier milestones so the displayed funnel remains monotonic.

## Pasadía

Calendar ID: `a0bvCaXgCdVwSrgPELza`

Workflow 09 V4 pins this ID and classifies it as `trial_day` before looking at calendar/title text. This removes the previous dependency on spelling/accents.

A booked appointment remains a historical **Booked** milestone even if it is later cancelled/no-show. Attendance still requires Showed/Completed/Attended evidence.

Manual EOD Pasadía Booked/Attended values remain visible in V2 as a reconciliation reference instead of being silently added to system counts and risking double counting.

## Refresh button

The V2 home includes **Actualizar datos**. It calls Workflow 09 V4 through a server-only Vercel endpoint. The key is never sent to browser JavaScript.

The button refreshes WhatsApp, calls, School Tours, Pasadías, health and the normal EOD refresh condition. Opportunity stages continue to arrive event-driven through Workflow 02, so the button does not add a second opportunity polling loop.

## Files to deploy

- `database/MILHANO_V18_ADMISSIONS_V2.sql`
- `database/MILHANO_V18_ADMISSIONS_V2_POSTCHECK.sql`
- `n8n/MILHANO_01_Opportunities_Full_Reconciliation_V3_Dual_Pipeline.json`
- `n8n/MILHANO_02_Opportunity_Live_Sync_V2_Dual_Pipeline.json`
- `n8n/MILHANO_09_Dashboard_Refresh_Orchestrator_V4_Admissions_V2.json`
- `MILHANO_V18_ADMISSIONS_V2_DEPLOY_ORDER.txt`

Follow the deployment-order file exactly.
