# Milhano Admissions Live

Operational admissions dashboard built with **Next.js + Supabase**.

## Current checkpoint

**V16.4.4**

Main areas:

- `/` — Summary with Manual (EOD) / GHL source switch.
- `/pipeline` — current GHL pipeline.
- `/eod` — today's EOD, historical EODs, weekly/monthly totals and CSV export.
- `/logs` — simple audit trail for EOD edits.
- `/reconciliation` — System vs Reported vs Verified Outside GHL.
- `/whatsapp` — WhatsApp reporting.
- `/llamadas` — call reporting.

## Project documentation

Use the two maintained project documents:

- [`database/MILHANO_DATABASE_CURRENT.sql`](database/MILHANO_DATABASE_CURRENT.sql)
- [`docs/MILHANO_PROJECT_NOTES.md`](docs/MILHANO_PROJECT_NOTES.md)

Old per-version setup, changelog, audit and backfill files are intentionally not
kept in the current repository checkpoint. Git history is the archive.

## Local development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and provide the required Supabase variables.

## Build

```bash
npm run build
```

## Deployment

Push to the private GitHub repository connected to Vercel.

If a release changes Supabase, update/run the relevant section of
`database/MILHANO_DATABASE_CURRENT.sql` and document the behavior in
`docs/MILHANO_PROJECT_NOTES.md`.
