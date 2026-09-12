# After School V19 · integration fixes

- Reuses existing `SUPABASE_URL` + `SUPABASE_SECRET_KEY` through `lib/supabase-admin.ts`.
- No `SUPABASE_SERVICE_ROLE_KEY` variable is required.
- Public routes bypass auth: `/after-school/registro` and `/api/after-school/register`.
- Internal After School pages use the existing `DashboardLayout`.
- `After School` is included in the existing `AppNav`.
- Next 16 `revalidateTag` calls use the required second argument.
- Public registration sends n8n notification with `after()` so the user does not wait for GHL sync.
- Roster is a valid nested Next page with a working print button.
