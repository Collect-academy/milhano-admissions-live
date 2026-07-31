# Milhano Admissions Live

Dashboard operativo de admisiones construido con Next.js, Supabase y Recharts.

## Secciones

- `/` — Resumen, pipeline, funnel, fuentes, asesoras e inactividad.
- `/whatsapp` — Volumen institucional completo, manual vs automático y admisiones vs atención general.
- `/llamadas` — Intentos, inbound, pickup, duración y movimientos observados después de la llamada.
- `/eod` — Snapshot diario individual, métricas compartidas y salud de sincronizaciones.

## Requisitos

- Node.js LTS.
- Proyecto de Supabase con la semilla y los módulos Live Sync, WhatsApp, Calls y EOD cargados.
- Variables server-side de Supabase.

## Instalación local

```bash
npm install
```

Copia el archivo de variables:

**Windows PowerShell**

```powershell
Copy-Item .env.example .env.local
```

**macOS/Linux**

```bash
cp .env.example .env.local
```

Completa `.env.local`:

```env
SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
DASHBOARD_USERNAME=milhano
DASHBOARD_PASSWORD=una-clave-larga
```

Ejecuta:

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Despliegue en Vercel

1. Sube los cambios al repositorio privado conectado a Vercel.
2. Conserva en Vercel las cuatro variables de entorno.
3. Vercel desplegará automáticamente la rama conectada.

## Seguridad actual

- Las consultas se ejecutan server-side con `SUPABASE_SECRET_KEY`.
- La llave no se envía al navegador.
- `proxy.ts` protege todas las rutas con Basic Auth.
- El EOD es de lectura hasta habilitar Supabase Auth individual.

## Fuentes principales

Pipeline:

- `vw_milhano_pipeline_summary_current`
- `vw_milhano_funnel_summary_standard`
- `vw_milhano_daily_kpis`
- `vw_milhano_source_performance`
- `vw_milhano_owner_performance`
- `vw_milhano_exit_summary`
- `vw_milhano_pipeline_current`

WhatsApp:

- `vw_milhano_whatsapp_daily`
- `vw_milhano_whatsapp_channel_summary`

Calls:

- `vw_milhano_calls_daily`
- `vw_milhano_calls_daily_user`
- `vw_milhano_call_outcome_bridge`

EOD:

- `vw_milhano_eod_dashboard`
- `milhano_eod_team_snapshots`
- `milhano_sync_runs`
