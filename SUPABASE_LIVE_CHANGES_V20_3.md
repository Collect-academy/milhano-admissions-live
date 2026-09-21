# Supabase live changes already applied

Project: `milhano-operations`

Applied logic changes:
- Booking KPIs use appointment `date_added` for booking creation date.
- Attended KPIs use real appointment/event date.
- Disqualified and Closed use real stage-event date.
- Setter cohort cascade uses stage movement and current No Answer state.
- `Responded = Contacted - current No Answer`.
- Meaningful and Qualified are constrained to remain subsets of the preceding Setter step.
- Payload includes `informational.no_answer` and `informational.disqualified`.
- Payload includes `booking_breakdown.school_tours` / `trial_days` with total/cohort/external.
- Payload includes `response_breakdown` with total/in_period/after_period.

These changes are already live in Supabase; do not re-run SQL from this release package.
