# Arquitectura técnica de Milhano — mapa para mantenimiento seguro

**Fecha de auditoría:** 2026-11-23. **Fuente primaria:** HEAD de GitHub main y esquema/funciones vivas de Supabase. Ver README.md y AGENTS.md antes de modificar. La configuración activa de n8n y ElevenLabs **no** está validada por el repositorio.

## 1. Servicios y responsabilidad del dato

GHL (CRM, oportunidades, stages, citas, llamadas y mensajes)
→ n8n (webhooks, normalización, reconcile y orquestación)
→ Supabase (histórico, métricas, overrides, formularios, campañas)
→ Next.js 16 / App Router + Supabase Admin server-only
→ Vercel (despliegue del dashboard).

ElevenLabs «Sofía» utiliza WhatsApp Calling y workflows n8n para permisos, intentos, post-call y cambios de stage; no debe perder funcionalidad ni cambiar de proveedor por modificaciones del dashboard.

- Proyecto Supabase: milhano-operations (mhfncmxlpwzyuupxjlxo), PostgreSQL 17.6, región us-east-2.
- Zona horaria: America/Merida; el cutoff operativo Setter es 14:30.
- 2026-11-23: ~67 tablas + 62 vistas en public; esquema ticketing con 14 tablas; sofia_internal con 2 tablas. Son cifras de inventario, no contratos fijos.
- 2 tareas pg_cron activas: milhano-sofia-due-campaigns (* * * * *) y milhano-sofia-expired-claims-safe-review (cada 5 min).
- Sin Edge Functions registradas en el proyecto en la auditoría.
- Conector n8n no disponible para consulta directa desde esta auditoría; las versiones JSON de la carpeta n8n NO equivalen a su estado live.

## 2. Autenticación y secretos

- proxy.ts: ruta privada requiere Supabase Auth con claims cuando hay configuración; exenciones para registro público After School y boletaje. Hay fallback Basic Auth cuando faltan variables Supabase (revisar antes de producción).
- lib/auth.ts: roles admin, advisor, viewer, student_staff; la identidad se resuelve contra milhano_app_users. student_staff se restringe a Alumnos.
- lib/supabase/server.ts: cliente SSR con cookies.
- lib/supabase-admin.ts: acceso service-role exclusivamente en servidor; no exponer SUPABASE_SECRET_KEY en React ni documentación.
- Variables de ejemplo en .env.example; los secretos verdaderos pertenecen a Vercel/n8n/gestor de credenciales.
- Los módulos públicos y los pagos requieren análisis de auth/CSRF/webhooks propio antes de cambios.

## 3. Índice de rutas y código

| Ruta / dominio | Frontend y librerías | Fuentes de datos |
|---|---|---|
| / (V2 Summary) | app/page.tsx, components/admissions-v2-cascade.tsx, components/summary-source-switcher.tsx, lib/admissions-v2.ts | milhano_get_admissions_v2_payload, manual EOD, stage map |
| /v2/leads | app/v2/leads/page.tsx, lib/admissions-v2.ts, lib/lead-timing.ts | milhano_get_v2_closer_metric_events; métricas auxiliares aisladas |
| /agentes | app/agentes/page.tsx, components/agent-conversion-funnel.tsx, lib/agent-analytics.ts, lib/agent-productivity.ts | milhano_get_agent_activity, milhano_get_setter_agent_journey, milhano_get_agent_closer_metrics, overrides |
| /analisis-leads | app/analisis-leads/page.tsx, components/lead-timing-lab.tsx, lib/timing-v3-metrics.ts | milhano_get_timing_analytics_v3 y milhano_get_management_evidence_v1 |
| /pipeline | app/pipeline/page.tsx, lib/data.ts | vw_milhano_pipeline_current, milhano_v2_stage_map |
| /eod | app/eod/page.tsx, app/eod/actions.ts, lib/eod-manual.ts, lib/eod-tours.ts | EOD submissions, snapshot, GHL/manual reconciliation |
| /sofia, /sofia/campanas | lib/sofia-analytics.ts, app/api/sofia/* | ai_campaigns, ai_campaign_members, dispatch_attempts, ai_call_insights, runtime_control |
| /alumnos | app/alumnos/actions.ts, lib/student-records.ts, student-form* y formato3* | milhano_students, form_records, permisos, fotos |
| /after-school | app/(dashboard)/after-school, app/(public)/after-school, lib/after-school | as26_* y Stripe |
| /boletos | app/boletos, app/api/boletos, lib/ticketing | ticketing.* (Postgres directo), Stripe |
| /reconciliation, /sistema, /logs | lib/reconciliation.ts, lib/system-health.ts, lib/data.ts | registros de auditoría, controles EOD, salud |

**Código crítico compartido:** lib/date-range.ts, lib/operational-date.ts, lib/supabase-admin.ts, lib/auth.ts, components/dashboard-layout.tsx y componentes de tablas. Cambiarlos implica probar todas las rutas que los usan.

## 4. V2 oficial e híbrido: contratos

### 4.1 Origen de números

- V2 Auto/GHL: public.milhano_get_admissions_v2_payload(date,date), apoyado en funciones base v21/cohort, vw_milhano_appointment_events_v22, vw_milhano_opportunities_current y otros modelos operativos.
- V2 Manual: sumas EOD entregadas/validadas. Se puede seleccionar Manual (EOD) en UI; los números no sustituyen ni corrigen GHL.
- Agentes: atribución desde eventos reales y Audit Logs GHL primero, con fallback controlado y milhano_agent_metric_overrides para casos históricos. «Calls made» operativamente representa oportunidades únicas trabajadas por movimiento real de stage, no llamadas telefónicas literales.
- No se deben crear stages ni opportunities ficticios para conciliar manual con automático.
- Setter usa lead operacional con cutoff 14:30 Mérida. Closer y las citas usan sus fechas reales.

### 4.2 Metodología de citas y fechas

- El evento se identifica por appointment_id. Los hermanos pueden compartir ghl_contact_id, y vw_milhano_appointment_events_v22 decide metric_opportunity_id con ranking por tipo/fecha.
- La vista de eventos canónica incorpora status overrides, appointment exclusions, date_added override vía vw_milhano_ghl_appointments_metrics y normalización de tipo.
- **Booked:** date_added local en el rango; la cita puede tener fecha futura o pasada.
- **Scheduled:** start_time convertido a scheduled_date en Mérida, dentro del rango y estado distinto de cancelled/canceled.
- **Attended:** scheduled_date en rango y status en showed/completed/show/attended.
- Los tres indicadores NO son el mismo conjunto ni necesariamente forman una progresión monotónica dentro de un solo intervalo.

**Calendarios y separación (2026-11-23):**

- School Tour oficial: `t1zZRpZ6fyGt09fWUjur` (no modificado).
- Pasadía oficial: `a0bvCaXgCdVwSrgPELza`.
- Retroalimentación: `Vkw8NTh2ag1QyEzu962b`.
- En GHL, algunas citas de Retroalimentación siguen con `appointment_type=trial_day`. Esto **ya no debe contaminar Pasadía** en las scorecards; se filtra por `calendar_id` en un nuevo read model **sin modificar** `vw_milhano_appointment_events_v22`, los registros de GHL ni n8n.
- **Seis métricas independientes:** `trial_days_booked / trial_days_scheduled / trial_days_showed` para Pasadía; `feedback_booked / feedback_scheduled / feedback_attended` para Retroalimentación.
- **Booked** filtra `booked_date` en Mérida; **Scheduled** filtra `scheduled_date` y estado distinto de canceled/cancelled; **Attended** filtra `scheduled_date` y estado positivo. Cada cita cuenta una vez por su `appointment_id`.
- **Modelo común:** `public.milhano_get_calendar_appointment_rows_v1(date,date,text)` SECURITY INVOKER, acceso solo service_role. Fuente `supabase/migrations/20261123_milhano_calendar_split_pasadia_retro_v1.sql`.
- **Capa de código:** `lib/admissions-calendar-metrics.ts` paginada, con utilidades `calendarMetricSummary`, `calendarMetricRows` y `calendarRowsAsLeads`. `lib/admissions-v2.ts` añade scorecards de calendario al JSON oficial sin modificar la función SQL oficial; `lib/agent-analytics.ts` conserva School Tours y el criterio de selección de agente del RPC existente, pero utiliza el mismo read model para ambos calendarios.
- **Paneles:** General Auto y Closer Auto en V2 muestran Pasadía y Retroalimentación por separado; Agentes/Cinthia repite las seis cifras mediante el mismo modelo y enlaza los mismos drilldowns. Setter conserva su atribución de productividad sin cambios; Manual EOD agregado no permite separar citas por calendario y permanece intacto.
- **Agenda hoy:** `Pasadías Hoy` se corrige para no incluir Retroalimentación, y se agrega `Retroalimentación Hoy`.
- **Base de comparación SQL 1–23 nov 2026 al momento de revisar:** Pasadía Booked 6 / Scheduled 6 / Attended 2; Retroalimentación 4 / 4 / 2. Los outcomes pueden cambiar al sincronizar GHL, por lo que son cifras de fixture, no objetivos fijos.
- **Semántica importante:** Booked, Scheduled y Attended pueden comprender citas distintas del mismo mes. No calcular tasas de conversión entre esos totales sin cohortes por appointment_id.

### 4.3 Tiempos / atribución

- lib/lead-timing.ts y milhano_get_management_evidence_v1 usan primer stage_change válido, primera cita o outbound manual registrado.
- Una cita creada prueba que hubo gestión **a más tardar** en ese momento; no demuestra la hora exacta de llamada WhatsApp humana. Expresar como límite ≤.
- Ignorar stage_entry inicial importado; no medir tiempos negativos como validaciones reales.
- Análisis V3 es exploratorio y no debe cambiar ni duplicar automáticamente conteos oficiales. Tabla de 50 filas por página, gráficos del conjunto filtrado completo.

## 5. n8n / sincronizaciones

En repositorio n8n/ existen exportaciones versionadas:
- 01 Full Reconciliation V4.1: recupera snapshots GHL, stage map y realiza upserts.
- 02 Opportunity Live Sync: ingesta webhooks GHL, valida origen, actualiza opportunity/stages a través de Supabase.
- 09 Refresh Orchestrator: WhatsApp, llamadas, citas, system health, EOD bajo condiciones.
- Sofía WF03 alimentación individual, WF04 post-call, WF05 decisiones, WF06 scheduler, WF07 outcomes/reintentos y flujos de permisos.

Los archivos JSON pueden mostrar active:false **aunque la versión activa en n8n sea otra**. Confirmar siempre la ejecución activa y conexiones del servicio antes de alterar workflows. Nunca asumir que refrescar dashboard significa ejecutar llamadas.

Estado observado el 2026-11-23:
- Opportunities, webhook_inbox, conciliaciones de WhatsApp y llamadas recibían registros recientes.
- Conectores ghl_call_reconciliation y ghl_whatsapp_reconciliation reportaban éxito el 23 nov.
- Último full_reconciliation visible: 17 nov con estado success, sin fallos reportados.
- pg_cron Sofía cada minuto y cada 5 minutos; live_dispatch_enabled=true, stage_writes_enabled=true, automatic_retry_enabled=true, max_outbound_attempts=2.
- No modificar estos flags para probar scorecards.

## 6. Riesgos y deuda técnica (NO aplicar remedios masivos)

1. **Seguridad:** public.milhano_ai_setter_dispatches tenía RLS=false y grants de lectura/escritura a anon/auth. Revisar consumidores n8n/Sofía, crear plan compatible y corregir con pruebas antes de tocarla.
2. **Datos de alumnos:** vw_milhano_student_directory no es security_invoker, tiene grant SELECT anon; devuelve datos sensibles incluidos CURP y nacimiento. Revisar acceso efectivo y corregir con prioridad sin romper permisos.
3. **RPC antiguas:** 40 funciones SECURITY DEFINER invocables por anon y 42 por authenticated según asesor Supabase. Clasificar funciones una por una y revocar innecesarias; no tratar todas como explotables sin analizar.
4. **Calidad:** monitor opportunities_unknown_stage reportó 1617, pero join directo de IDs encontró 12 oportunidades sin mapeo (10 Mensaje Requested + 2 Leads COLDEM); revisar definición histórica del chequeo antes de corregir números.
5. **Datos futuros:** un evento excel_legacy con fecha 2027-07-06 se registró como válido; revisar al analizar periodos.
6. **Rendimiento:** EXPLAIN (ANALYZE) en noviembre 1–23: V2 ≈1.38–1.48 s; Agentes actividad ≈0.58 s; journey ≈0.47 s; Timing V3 ≈0.50 s; nueva consulta Pasadía Scheduled ≈0.077 s. Son tiempos SQL, no frontend final. Optimizar V2 de forma aislada con pruebas de regresión de conteos.
7. **GitHub:** main no protegida al auditar; package.json usa latest en paquetes esenciales (lockfile existente), revisar CI/protección y política de versiones de forma separada.
8. **Documentación legada:** docs/MILHANO_PROJECT_NOTES.md inicia en V17; no debe considerarse más actual que este documento y la BD viva.
9. **Boletaje y After School:** contienen rutas públicas y pagos Stripe; requieren pruebas propias, ajenas al cambio de pasadías.

## 7. Pruebas mínimas por cambio

- Identificar owner del dato, unidad, periodo y IDs de referencia.
- Guardar baseline de métricas V2/Agentes antes de alterar fuente compartida.
- Revisar SQL y permisos; función read-model nueva preferiblemente aislada y solo service_role.
- Comprobar conteo de scorecard = filas de drilldown para el mismo periodo, scope y filtros, incluyendo cancelaciones, citas de hermanos y reserva fuera del periodo.
- .github/workflows/dashboard-ci.yml verifica PRs del dashboard: npm install --no-audit --no-fund --package-lock=false; npx tsc --noEmit --incremental false; npm run build. El package-lock heredado está desincronizado y requiere corrección aislada posterior. Validar resultado del check y la revisión visual de Vercel antes de merge.
- Confirmar que Selector Manual EOD/Auto GHL y Agentes siguen idénticos.
- Si cualquier cambio afecta n8n, hacer pruebas explícitas de activación/entrega y rollback; el cambio Scheduled no necesita n8n.
- Actualizar CHANGELOG.md en el mismo commit. Documentar estado real de deployment y rollback, no afirmar que se ejecutó una prueba no realizada.


## Open House — 2026-11-27 (implementación propuesta 2026-11-25)

- Rutas /open-house (staff autenticado; admin o membresía openhouse.staff), /open-house/registro (pública únicamente el 27, 07:00–15:30 Mérida), APIs exactas /api/open-house/staff y /api/open-house/public.
- Schema privado openhouse: una familia por contacto GHL/evento, citas múltiples y horarios originales, asistencia y horario real separados, asignación equilibrada por bloque serializada con advisory lock, auditoría y outbox idempotente. Importación inicial de openhouse_import.source_snapshots; no sobrescribe asistencia. RPC public.milhano_oh_v1 SECURITY INVOKER, solo service_role; RLS y sin acceso anon/authenticated a tablas. No logs de PII en repositorio.
- Lookup público requiere teléfono/email exacto, devuelve nombre enmascarado; nombre solo no enumera familias. Confirmación exige nombre completo coincidente o teléfono y correo exactos. Límites DB global e IP HMAC. Staff puede corregir y registrar walk-ins; no muta GHL.
- Outbox registra notificaciones; envío opcional vía webhook GHL dedicado configurado en OPEN_HOUSE_GHL_WELCOME_WEBHOOK_URL; DND y sin contacto bloqueados, claim atómico y sin reintento ambiguo. submitted significa aceptación del webhook, no entrega de WhatsApp; sin n8n para lookup, asistencia, distribución y actualización. Sincronización manual desde Vercel por HTTPS directo a GHL; token de lectura obtenido de Vault vía DATABASE_URL o variable privada. Validación de paginación y conjunto de contactos antes de merge. No sobrescribe asistencia ni correcciones. No cambiar pg_net.
- After School oculto del menú sin borrar rutas, datos ni automatizaciones. Ricardo permitido por membresía; alta de otros operadores explícita por admin. Revisar permisos y pruebas antes de merge.

- **Actualización Open House (2026-11-25):** manual por defecto, al abrir la vista o pulsar Actualizar; sincronizar GHL explícitamente también recarga. Guardar asistencia no vuelve a solicitar la lista completa. Únicamente el 27/11/2026, agenda de 06:00 a 15:30 cada media hora, apagado a las 16:00 (America/Merida); no consultas en pestaña oculta, durante edición/guardado, ni solicitudes de actualización simultáneas. Sin cron, SQL ni n8n nuevos.

- Excepción temporal aplicada 26/11: QR lookup y verificación en producción habilitados un día antes; confirmación válida devuelve preview_verified sin escritura de asistencia/outbox/auditoría ni despacho. Mantiene rate limits y protección de identidad. La excepción expira por fecha en DB; no requiere cron. No cambia ventana real del 27/11. Sin cambio de stage todavía.

## Open House: pasadías y recorrido (2026-11-26)
- Public /open-house/pasadia y POST exacto /api/open-house/pasadia; API server-only con disponibilidad por grado, HMAC rate-limit, idempotencia por request_id, deduplicación por alumno/tutor/grado y advisory lock global para reservar/cancelar/bloquear. RLS en schema privado; RPC public.milhano_oh_trial_v1 SECURITY INVOKER solo service_role. /open-house/pasadias y API privada permiten staff autorizado consultar; solo admin cancela/bloquea. GHL no se modifica por reserva local; mirror Pasadía bloquea día completo si tiene cita externa activa sin grado normalizado. Fuente inicial GHL directa 0 citas en el rango; mientras no exista integración bidireccional, todas las altas deben usar esta agenda. No cron ni polling de pasadías.
- Recorrido cliente puro, offsets 0/2/4 por seis rondas, todos en estación 7; 8–10 min por estación, traslados y hora real ajustables, cierre sin hora final. Datos de familias presentes según snapshot manual existente. Impresión por grupo o general.
- Stage sync reemplaza webhook de bienvenida: RPC service-only milhano_oh_stage_v1 claim/finish y retry admin; 26/11 solo TEST exacto (pM8JTFat5Mi02AHQPy9G), 27/11 todos los elegibles, posterior retry admin. GET verifica opportunityId/contactId/pipeline/status; PUT solo pipelineStageId Asistido si stage previo permitido. DND, sin oportunidad única o avanzada bloqueados. Si timeout/fallo, review; no reintentos ciegos. submitted = etapa confirmada, no entrega WhatsApp. No modifica Sofía, permisos pg_net, n8n ni otras pipelines. No envíos de prueba automáticos.

- 26/11/2026 — En Open House, durante 27/11/2026 06:00–16:00 Mérida, los cambios de familias/outbox generan una señal privada Supabase Realtime sin PII (una por transacción). Solo usuarios activos autorizados para OH, sin permiso de leer tablas privadas; el cliente agrupa señales (1.2 s, mínimo 5 s entre refrescos reactivos), no consulta cuando está oculto o editando, y conserva respaldo de 30 min y botón manual. Fuera de la ventana se desactiva la suscripción; no se crean cron ni workflows n8n. Recorrido muestra las tres coordinaciones siempre, impresión general o individual con horarios y familias (nombre, grado y asistentes si disponibles), offsets 0/2/4 intactos.

- Corrección tras prueba de infraestructura: Realtime DB Broadcast no pudo insertar por falta de partición activa en realtime.messages (SQLSTATE 23514); se retiró la policy nueva y el acceso al helper, sin tocar configuración compartida. Implementación final: contador privado openhouse.change_revision (una actualización por transacción en ventana 27/11 06:00–16:00), RPC service-only milhano_oh_revision_v1 y GET staff?revision=1 autorizado. Cada 30 s solo en pestaña visible y ventana activa se consulta el contador; descarga completa únicamente al detectar cambios, al conectar por primera vez, tras guardar localmente o respaldo de 30 min/manual. Agrupa refrescos, sin solapamientos y sin polling fuera del evento. Prueba SQL: contador avanza una vez en 4 cambios simulados en misma transacción; rollback, maestros autorizado, usuario desconocido bloqueado. Sin n8n. Esta implementación sustituye el intento Realtime anterior.

- 26/11/2026: las rutas QR públicas /open-house/registro y /open-house/pasadia ahora entregan HTML/CSS y JS ES5 independiente (XHR, tabla calendario, UUID emitido por servidor; sin hidratación React, AbortController, crypto.randomUUID de cliente o Intl). Mantiene APIs/QR y validación SQL. La confirmación de ingreso real o preview válido del 26 emite cookie firmada HttpOnly/Secure, 48 h, path API; el formulario de pasadía recupera nombre/correo solo con WhatsApp coincidente y sesión verificada, o nombre completo + WhatsApp coincidentes de una única familia presente si se cambia de dispositivo. Sin teléfono solo ni PII pública, RPC service-only y rate limit. Manual siempre disponible. No n8n, no GHL adicional, no cambios a dashboard privado. Objetivo Safari/iOS antiguos; prueba en hardware pendiente.
