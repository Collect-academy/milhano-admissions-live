# Milhano Dashboard MVP

Dashboard de admisiones construido con Next.js, Supabase y Recharts.

## Requisitos

- Node.js LTS
- Proyecto de Supabase con la semilla cargada
- Vistas `vw_milhano_*` creadas

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

Obtén la URL y la Secret key desde Supabase:

- `Connect`
- o `Settings > API Keys`

La Secret key sólo se usa en el servidor. No la renombres con el prefijo
`NEXT_PUBLIC_`.

Ejecuta:

```bash
npm run dev
```

Abre:

```text
http://localhost:3000
```

El navegador solicitará el usuario y contraseña configurados.

## Build de validación

```bash
npm run build
```

## Despliegue en Vercel

1. Sube este proyecto a un repositorio privado de GitHub.
2. Importa el repositorio desde Vercel.
3. Añade las cuatro variables de `.env.local` en:
   `Project Settings > Environment Variables`.
4. Deploy.
5. No subas `.env.local` a GitHub.

## Seguridad V1

- RLS permanece activado en Supabase.
- La lectura se realiza server-side con `SUPABASE_SECRET_KEY`.
- La clave no se incluye en el bundle del navegador.
- `proxy.ts` protege el dashboard con autenticación básica.
- En V2 puede sustituirse por Supabase Auth con usuarios individuales.

## Vistas consumidas

- `vw_milhano_pipeline_summary_current`
- `vw_milhano_funnel_summary_standard`
- `vw_milhano_daily_kpis`
- `vw_milhano_source_performance`
- `vw_milhano_owner_performance`
- `vw_milhano_exit_summary`
- `vw_milhano_pipeline_current`
