# CHANGELOG — Milhano dashboard

Registro obligatorio y acumulativo. **Cada commit que cambie comportamiento, datos, SQL, seguridad, integraciones o interfaz debe agregar una entrada**. No borrar entradas anteriores. Versiones antiguas en docs/MILHANO_PROJECT_NOTES.md y CAMBIOS_* son antecedentes, no estado actual.

## 2026-11-23 — V2/Agentes: separación completa de calendarios Pasadía y Retroalimentación

**Estado al abrir el cambio:** rama `feature/v2-separar-calendarios-pasadia-retro-20261123` y migración aditiva SQL aplicada; PR, CI y Vercel deben verificarse antes de producción.

- **Objetivo:** eliminar citas de Retroalimentación de **todas** las scorecards de Pasadía y ofrecer **Retroalimentación Booked, Scheduled y Attended**, con sus desgloses clicables.
- **Calendarios:** Pasadía `a0bvCaXgCdVwSrgPELza`, Retroalimentación `Vkw8NTh2ag1QyEzu962b`, clasificados exclusivamente por `calendar_id`. No modificar ni reclasificar citas históricas en GHL.
- **Modelo:** nueva función `milhano_get_calendar_appointment_rows_v1` SECURITY INVOKER y service_role-only. Reusa `vw_milhano_appointment_events_v22` con overrides y vinculación de hermanos; recupera citas del periodo por `booked_date`, `scheduled_date` o agenda de hoy. Frontend comparte una única normalización para General, Closer, Agentes, drilldowns y agenda de hoy.
- **UI:** V2 General y Closer Auto y sección de citas de Agentes con seis scorecards. `/v2/leads` presenta `Agendada el`, `Programada para` y el criterio temporal explícito para cada calendario. `Pasadías Hoy` deja de mezclar Retroalimentación y aparece `Retroalimentación Hoy`.
- **Sin cambios:** modelo original de oportunidades, stage timings, RPCs SQL de V2/Agentes, Manual EOD, pipelines GHL, n8n, ElevenLabs, Sofía y pagos.
- **Fixture SQL del 1 al 23 de noviembre 2026:** Pasadía `6/6/2`; Retroalimentación `4/4/2` (Booked/Scheduled/Attended). 32 citas totales entre los dos calendarios, 32 appointment_id únicos; lectura SQL noviembre ≈130 ms. Permisos EXECUTE anon=false, authenticated=false, service_role=true.
- **Archivos:** `lib/admissions-calendar-metrics.ts`, `lib/admissions-v2.ts`, `lib/agent-analytics.ts`, `app/page.tsx`, `app/v2/leads/page.tsx`, `components/admissions-v2-cascade.tsx`, `components/agent-conversion-funnel.tsx`, migración SQL, README.md, AGENTS.md, docs/ARCHITECTURE.md y CHANGELOG.md.
- **Despliegue y validaciones pendientes al abrir PR:** GitHub Actions TypeScript/Next build, Vercel Preview, comparación de 6 scorecards vs. 6 drilldowns y smoke test autorizado. 
- **Rollback:** revertir frontend y los documentos en GitHub. El RPC nuevo es aditivo sin efectos de escritura y puede permanecer sin usarse hasta eliminación controlada.

## 2026-11-23 — V2: Pasadía Scheduled + documentación de arquitectura

**Estado:** PR #2 fusionado a main el 2026-11-23 (squash commit 3ca6cd74e8ca6304ae410a2093795c61d548eae8); migración SQL aditiva ya aplicada a Supabase. GitHub Actions validó TypeScript y build, y Vercel Preview reportó éxito. La verificación final de la UI autenticada es independiente del build y sigue pendiente.

- **Objetivo:** distinguir Pasadía Booked (fecha de registro) de Pasadía Scheduled (fecha de visita) y mantener Pasadía Attended sin cambios.
- **UI:** añadir scorecard «Pasadía Scheduled» solo a la cascada automática de Closer, inmediatamente después de Booked. Drilldown por appointment_id y fechas Agendada el / Programada para, con explicación del criterio del periodo. V2 General, Manual EOD y Agentes mantienen conteos y contratos.
- **Fuentes:** función nueva public.milhano_get_trial_days_scheduled_v1(date,date,text); cuenta solo calendar_id=a0bvCaXgCdVwSrgPELza, canonical_type=trial_day y scheduled_date local en rango, excluyendo cancelled/canceled. Permisos EXECUTE solo service_role. Modelo basado en vw_milhano_appointment_events_v22.
- **Sin tocar:** milhano_get_admissions_v2_payload (RPC SQL), milhano_get_v2_closer_metric_events, Agentes, EOD, GHL, workflows n8n y ElevenLabs.
- **Advertencia / decisión explícita:** la vista original etiqueta calendario Retroalimentación como trial_day. Booked y Attended históricos incluyen también Retroalimentación; Scheduled se limita al calendario real Pasadía. Pendiente de análisis y eventual reconciliación como cambio separado.
- **Prueba SQL 01–23 nov 2026:** Booked legado=10; Scheduled nuevo=6 citas únicas sin fechas nulas; Attended legado=3. Para Scheduled: septiembre=11, octubre=8, noviembre 01–23=6; Setter scope=0. EXPLAIN ANALYZE nov 01–23 ≈77 ms (solo consulta BD). Roles anon/auth: EXECUTE false, service_role true.
- **CI añadido:** .github/workflows/dashboard-ci.yml ejecutará npm install --package-lock=false, TypeScript y producción Next.js para PRs con cambios app/components/lib y pushes a main. Mantiene controles independientes de workflows de Sofía.
- **Incidencia CI heredada:** npm ci falló porque package-lock.json no contiene dependencias ya declaradas en package.json (pdf-lib/postgres/qrcode, etc.). Se cambió el check al instalador ya usado por Sofía: npm install --no-audit --no-fund --package-lock=false. Conciliar el lockfile después en un PR independiente.
- **Pruebas verificadas:** TypeScript y Next.js build del PR aprobados, Vercel Preview éxito, conteos SQL y permisos confirmados. **Pendiente:** smoke test de UI autenticada y contraste final de métricas tras despliegue.
- **Rollback:** revertir commit/PR frontend. La función nueva es aditiva y puede quedar sin uso; su eliminación debe planearse separadamente, verificando dependencias.

**Archivos:** README.md, AGENTS.md, CHANGELOG.md, docs/ARCHITECTURE.md, lib/admissions-v2.ts, app/page.tsx, app/v2/leads/page.tsx, components/admissions-v2-cascade.tsx, supabase/migrations/20261123_milhano_trial_days_scheduled_v1.sql, .github/workflows/dashboard-ci.yml.

## 2026-11-11 — Checkpoint de código previo (referencia, no reconstrucción exhaustiva)

- HEAD de main verificado antes del cambio: f6b0e12c5a0b379d8416e7af1bfe257db16d092f.
- V2 Summary, Agentes, V3 Análisis, EOD, Sofía, Alumnos, After School y Boletos coexistían en un único proyecto Next.js.
- El código SQL y las migraciones vigentes se deben consultar en Supabase; el historial original puede leerse en docs/MILHANO_PROJECT_NOTES.md. Este checkpoint **no** afirma haber auditado ni documentado todos los commits históricos.

## Plantilla para toda nueva entrada

### YYYY-MM-DD — Nombre del cambio
- Estado: rama/PR, DB aplicada o pendiente, deployment verificado o pendiente.
- Motivo y alcance: qué se solicita, qué se protege.
- Código: rutas y archivos concretos.
- BD/integraciones: RPC/tablas/migración/workflows, permisos y efectos.
- Métricas: fuentes, definiciones, IDs, periodo y casos límite.
- Pruebas: SQL, recuento vs drilldown, TypeScript, build, regresión, despliegue.
- Riesgos, pendientes, rollback y responsable.
