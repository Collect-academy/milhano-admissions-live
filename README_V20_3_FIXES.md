# Milhano Admissions V20.3 fixes

## Scope
Frontend-only release over the V20 stage-cascade build. The required Supabase logic changes were already applied directly to the live `milhano-operations` project before this package was created.

No changes were made to Auth, student permissions, student forms, After School registration/payment logic, dashboard refresh API routes, or n8n workflows.

## Admissions V2
- Setter cascade remains cohort-based by lead creation date.
- `Responded = Contacted - current No Answer`.
- Cascade is monotonic for the cohort: Responded ⊇ Meaningful ⊇ Qualified.
- Adds informational scorecards for `No Answer` and `Disqualified` outside the main Setter flow.
- `Tour Booked` and `Pasadía Booked` expose hover explanations showing selected-period cohort vs leads created outside the selected period.
- `Responded` exposes hover explanation showing responses inside the selected period vs after the selected period.
- Closer async color cues remain: Attended = soft yellow, Closed = soft green.

### Sep 17 validation
- New Leads: 22
- Contacted: 22
- No Answer: 17
- Responded: 5
- Meaningful: 4
- Qualified: 3
- Tour Booked: 4 = 3 selected-period cohort + 1 external lead
- Tour Attended: 1
- Pasadía Booked: 1
- Pasadía Attended: 0
- Closed: 0
- Disqualified events in period: 2

## Pipeline view
- Removes the obsolete legacy operational cascade from this page.
- Fixes period filtering for live opportunity timestamps using Mérida local date.
- Removes the 60-second pipeline base cache so a post-refresh page read is not hidden behind stale cached rows.
- Adds visible pipeline names.
- Adds Pipeline selector/filter.
- Adds Pipeline column to opportunity table and CSV export.
- Keeps existing stage, owner, source, status, inactivity and search filters.

## Calls view
The UI was not the reason Sep 17 showed zero. Live Supabase currently has no `Call` communication events for Sep 17; the newest stored call is Sep 14. The GHL call reconciliation connector is still running successfully and most recently re-read 567 call records.

This release adds a visible diagnostic banner when the selected period has no calls, including the latest stored call and calls-sync heartbeat. It deliberately does **not** change n8n ingestion until a known Sep 17 GHL call can be compared against the GHL export response.

## Navigation order
1. V2 Summary
2. Pipeline
3. WhatsApp
4. Calls
5. EOD
6. V1 Legacy
7. Reconciliation
8. Logs
9. System
10. Students (admins only, unchanged permission behavior)
11. After School

## Language / access
- New text introduced by this release is bilingual EN/ES.
- Existing role gating remains unchanged.
- Students is still rendered only for admins in the Admissions navigation.
