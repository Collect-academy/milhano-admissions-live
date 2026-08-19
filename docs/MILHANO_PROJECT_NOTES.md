# Milhano Admissions — Project Notes

**Current checkpoint:** V16.4.1  
**Dashboard:** Next.js + Supabase  
**Primary CRM:** GoHighLevel (GHL)  
**Timezone:** America/Merida

This file replaces the accumulated `RELEASE_SETUP`, `CAMBIOS`, execution-budget,
and other informational `.txt` files that used to be stored at the repository root.

---

## 1. Current product behavior

### Summary

The Summary can switch between:

- **Manual (EOD):** totals reported by advisors in submitted/validated EODs.
- **GHL:** system-observed counts only.

The two views are intended to use nearly equivalent business KPIs where the
underlying source supports them.

### Manual EOD funnel

Core progression:

`Leads → Responded → Meaningful → Qualified / Fit → ST Booked → ST Attended → Closed`

`Contactados` is intentionally kept outside the funnel because it represents
**contact attempts**, not unique leads. One lead can generate multiple contact
attempts in the same day.

### GHL funnel

The system view uses unique system-observed milestones where available.
Raw activity metrics such as total dials remain outside the funnel when they are
not unique-lead stages.

### EOD rules

- Advisors enter **final totals**, never deltas.
- To correct `20` to `22`, enter `22`, not `+2`.
- Existing EODs open prefilled.
- Only changed values are written to the human-readable change log.
- Historical EODs can be opened from the EOD history.
- Today's EOD has a dedicated action so it is not confused with historical entry.
- Meaningful Conversations remains manually reportable.
- Submitted EODs can be corrected according to role/policy.
- Validated EODs are protected more strictly.

### EOD history

The EOD view includes:

- daily rows,
- weekly totals,
- monthly totals,
- advisor filtering,
- CSV export of manual EOD metrics,
- click-to-open editing for a specific day.

### Logs

`/logs` is visible to authenticated users and records simple audit messages such as:

`Pathi · actualizó EOD · 12 ago 2026 · Leads Totales 20 → 22 · Meaningful 0 → 5`

The objective is to make advisor changes easy to locate without exposing
database-oriented language.

### School Tour detail

EOD School Tour reporting supports:

- contact lookup by phone or name,
- contact + student name context when available,
- School Tour date/time,
- student level: Primaria / Secundaria / Prepa / Sin definir,
- attendance: Show / No Show,
- outcome: Closed / Not Closed,
- free-text outcome note.

Structured detail drives the EOD ST Booked / ST Attended / Closed totals instead
of relying only on an unexplained aggregate count.

### Reconciliation

The dashboard keeps these concepts separate:

- **System / GHL**
- **Reported Total**
- **Verified Outside GHL / Manual Extra**
- **Operational Total = System + Verified Outside GHL**
- **Gap = Reported - Operational**

Current GHL stages remain system-only and are not fabricated from aggregate manual data.

---

## 2. Terminology

### Qualified / Fit

`Qualified` and `Fit` mean the same business milestone.

- GHL stage: `Fit`
- Dashboard label: `Qualified / Fit`

### No responde vs Seguimiento

These are separate operating states:

- **No responde:** contact attempts have been made but the lead has not replied.
- **Seguimiento:** there is a known reason/time to continue later; the lead is still active.
- **Lost / Sin continuidad:** the process is no longer being actively pursued.
- **No fit:** the prospect does not meet fit criteria.

### Responded

Responded is a **milestone/KPI, not a GHL stage**. A lead can have responded and
still correctly remain in Seguimiento, Fit, No Fit, etc.

### Meaningful Conversation

A lead provided relevant admissions information even if the information is not
yet sufficient to determine Fit / No Fit.

Current direction:
- manual EOD reporting remains authoritative for this judgment;
- connected calls of 2+ minutes can be used as a system signal;
- WhatsApp semantic classification should be added inside the communication sync
  rather than through a new polling workflow.

---

## 3. Attribution

Do not automatically equate:

- `Facebook` = Ads
- `Instagram` = Ads

Those are raw source/channel labels unless paid evidence exists.

Ads vs Organic should remain a separate acquisition dimension and should use
stronger evidence such as Click-to-WhatsApp ad context, UTM/campaign/ad metadata,
or a deliberate manual classification.

---

## 4. Authentication

Dashboard login accepts username or email.

Mona:
- username: `MonaCashflow`
- role: `admin`
- language: forced English
- internal Supabase Auth identity exists separately from the visible username.

Passwords are intentionally **not stored in this repository**.

---

## 5. n8n architecture

### Keep event-driven

`MILHANO | 02 | Opportunity Live Sync`

Keep active and separate. Opportunity/stage changes are event-driven and should
not be converted into polling.

### Planned orchestrator

The prepared large workflow is:

`MILHANO | 09 | Dashboard Refresh Orchestrator`

Target responsibilities:

`WhatsApp → Calls → System Health → conditional EOD refresh`

The objective is to replace several recurring polling workflows with one
scheduled execution and optional manual refresh.

### Workflows to deactivate after the orchestrator is validated

- `03A | WhatsApp All Messages Reconciliation`
- `03B | Call API Reconciliation`
- `04 | Daily EOD Snapshot`
- `08 | System Health Monitor`

### Keep available but not periodically scheduled

- `01 | Opportunities Full Reconciliation V2` — manual recovery/reconciliation
- `05 | WhatsApp Historical Backfill` — inactive after historical backfill

### Execution principle

Milhano should prefer:
- event-driven triggers where possible,
- consolidated scheduled refreshes,
- manual/on-demand refresh when freshness is occasionally needed,
- no unnecessary real-time polling.

This is specifically to avoid disproportionate n8n execution consumption.

---

## 6. Database deployment

The repository now keeps one database file:

`database/MILHANO_DATABASE_CURRENT.sql`

It consolidates structural/current-state changes through V16.2.

It intentionally excludes:
- one-time historical backfills,
- audit/check queries,
- Pathi report imports,
- temporary repair SQL.

**Important:** the consolidated file assumes the original Milhano Supabase schema
already exists. It is a project checkpoint, not a from-zero database bootstrap.

---

## 7. Normal deployment

### Dashboard-only release

1. Commit/push the updated project to GitHub.
2. Let Vercel build/deploy.
3. Verify the affected UI.

### Release with database changes

1. Review/update `database/MILHANO_DATABASE_CURRENT.sql`.
2. Run the required current change in Supabase SQL Editor.
3. Deploy the dashboard.
4. Perform the release-specific smoke test.
5. Update this document rather than creating a new setup/changelog file.

---

## 8. Release history — condensed

- **V11:** reconciliation layer; non-blocking EOD mismatch philosophy.
- **V11.1:** username login and Mona admin access.
- **V12.1:** simple EOD; bilingual UI; Fit = Qualified; Follow-up terminology cleanup.
- **V13:** Responded milestone; Meaningful kept distinct from raw call-duration metrics.
- **V14:** historical EOD entry; Meaningful added as manual EOD field.
- **V15:** EOD editing logs; GHL-gap CSV/reconciliation reporting.
- **V16:** daily/weekly/monthly EOD history; manual/GHL Summary switch.
- **V16.1:** dedicated Today's EOD UX.
- **V16.2:** structured School Tour detail, Closed in Manual Summary, funnel arrows/ratios,
  school level reporting, tooltip overflow fix, 2+ minute call signal for Meaningful.
- **V16.4:** clean repository checkpoint. Keeps the complete V16.2 feature set while consolidating project SQL/docs into the maintained current files.

Going forward, update this section in place instead of adding another changelog document.

---

## 9. Repository hygiene rule

Keep administrative artifacts limited to:

- `database/MILHANO_DATABASE_CURRENT.sql`
- `docs/MILHANO_PROJECT_NOTES.md`

Do **not** add a new release setup/changelog/check SQL file to the project root
unless it is genuinely temporary and will be removed at the next checkpoint.

Git history is the archive for old releases.
