# Milhano International School — Dashboard y Automatizaciones

**Punto de entrada oficial del proyecto.** Para que cualquier persona o IA pueda realizar cambios con contexto cero, leer en este orden:

1. **README.md** (este documento): alcance, reglas y rutas.
2. **AGENTS.md**: protocolo obligatorio para asistentes, agentes de código y colaboradores.
3. **docs/ARCHITECTURE.md**: mapa de componentes, datos, métricas, seguridad y flujos operativos.
4. **CHANGELOG.md**: registro cronológico de cambios, migraciones, efectos y pruebas.
5. **docs/MILHANO_PROJECT_NOTES.md**: antecedentes históricos; **no** es la referencia de versión actual.

> **Regla permanente:** todo cambio de comportamiento, SQL, UI, seguridad, workflow, configuración o métrica requiere una entrada en CHANGELOG.md en el mismo commit. Si cambia arquitectura, contrato, nomenclatura, ruta, integración o proceso, actualizar también README.md, AGENTS.md y/o docs/ARCHITECTURE.md. Nunca dejar la documentación para después.

## Estado y alcance (verificado el 2026-11-23)

- **Repositorio:** Collect-academy/milhano-admissions-live; rama de producción: main; despliegue en Vercel.
- **Frontend:** Next.js (App Router), React, TypeScript, CSS y Recharts; paquete postgres para el módulo de boletaje.
- **BD:** Supabase milhano-operations, proyecto mhfncmxlpwzyuupxjlxo, PostgreSQL 17; datos CRM, eventos, EOD, agentes, alumnos, After School y Sofía.
- **Origen CRM:** GoHighLevel (GHL). **Integración:** n8n; ElevenLabs para Sofía. El código JSON del repo es referencia/versionado, no prueba de que sea el workflow activo.
- **Zona horaria:** America/Merida. **Regla de cohortes Setter:** corte operativo 14:30; citas y eventos Closer usan fecha real local.
- **Servicios no verificados directamente:** ejecución/configuración viva de n8n y ElevenLabs y navegación autenticada de Vercel; corroborar antes de operaciones sensibles.

## Navegación del producto

| Ruta | Función | Lógica principal |
|---|---|---|
| / | V2 Summary; Auto (GHL) o Manual (EOD) | app/page.tsx, lib/admissions-v2.ts, RPC milhano_get_admissions_v2_payload |
| /v2/leads | Drilldown de scorecards por evento/opportunity | lib/admissions-v2.ts, RPC milhano_get_v2_closer_metric_events y lecturas aisladas |
| /agentes | Productividad y atribución | lib/agent-analytics.ts, RPC de agentes y overrides |
| /analisis-leads | Análisis de Tiempos V3; 50 leads por página | RPC milhano_get_timing_analytics_v3, lib/timing-v3-metrics.ts |
| /pipeline | Inventario y stages operativos | lib/data.ts, stage map |
| /eod | Declaraciones EOD, historial y validación | app/eod/actions.ts, lib/eod-manual.ts |
| /sofia | Indicadores y campañas de Sofía | lib/sofia-analytics.ts, app/api/sofia |
| /alumnos | Expedientes y Formatos 1–5 | lib/student-records.ts, app/alumnos/actions.ts |
| /open-house | Recepción, asistencia y Kanban | Schema privado openhouse, RPC service-only milhano_oh_v1 |
| /open-house/registro | Check-in público por QR | API server-only, solo coincidencia con WhatsApp/correo y verificación adicional |
| /after-school | Talleres y registros (oculto del menú, recuperable) | lib/after-school, tablas as26_* |
| /boletos | Boletaje y pagos | lib/ticketing, esquema ticketing, Stripe |
| /sistema, /reconciliation, /logs | Salud, conciliaciones y auditoría | lib/system-health.ts, lib/reconciliation.ts |

## Reglas de oro (NO romper)

1. **V2 Summary y Agentes son métricas oficiales e híbridas.** Auto/GHL y Manual/EOD deben permanecer separados. No reinterpretar, sumar ni sobrescribir sus datos.
2. **No modificar funciones SQL oficiales para agregar una métrica auxiliar** si se puede añadir un read model separado de solo lectura. Ver la implementación de Pasadía Scheduled.
3. **Unidad de las citas = appointment_id**, no lead único. Los hermanos pueden compartir contacto; vw_milhano_appointment_events_v22 aplica vinculación de cita a opportunity.
4. **Booked ≠ Scheduled ≠ Attended**: fecha de creación de la cita, fecha para la que está programada y esa misma fecha con outcome de asistencia.
5. **No atribuir llamadas WhatsApp humanas no registradas como llamadas comprobadas**. Primer movimiento real de stage o cita creada es evidencia indirecta, no marca exacta de llamada.
6. **Sofía/ElevenLabs es un sistema protegido.** No migrar, sustituir, desconectar ni limitar WhatsApp Calling o agentes al tocar GHL, Meta, n8n, Supabase o dashboard.
7. **No tocar n8n sin necesidad demostrada.** Los cambios de scorecard que reutilizan datos de citas existentes no requieren modificar el workflow.
8. **Pruebas y documentación en el mismo cambio.** Build de Next/TypeScript, pruebas SQL de conteo vs detalle, seguridad/RLS, regresión de V2/Agentes y revisión de Vercel.

## V2 — Contrato de calendarios (2026-11-23)

**Cambio vigente:** Pasadía y Retroalimentación se separan completamente en scorecards Auto/GHL de V2 General y Closer, y en la zona Closer de Agentes. Ya no se clasifican por `appointment_type=trial_day` solamente; se utiliza el **calendar_id de GHL**.

| Calendario | calendar_id | Scorecards |
|---|---|---|
| Pasadía | `a0bvCaXgCdVwSrgPELza` | `trial_days_booked`, `trial_days_scheduled`, `trial_days_showed` |
| Retroalimentación | `Vkw8NTh2ag1QyEzu962b` | `feedback_booked`, `feedback_scheduled`, `feedback_attended` |

- **Booked:** fecha local Mérida en que se creó la cita (`date_added`); se preserva incluso si luego cambia el outcome.
- **Scheduled:** fecha local para cuando está programada la cita (`scheduled_date`); se excluyen `cancelled` y `canceled`.
- **Attended:** fecha programada en el periodo + estado `showed/completed/show/attended`.
- **Unidad:** `appointment_id`, con la atribución a alumno/opportunity de `vw_milhano_appointment_events_v22`, overrides y exclusiones vigentes.
- **Drilldowns:** `/v2/leads` muestra `Agendada el (Mérida)` y `Programada para (Mérida)` y el calendario correcto. Conteo = citas del mismo modelo de datos.
- **EOD Manual:** conserva los totales históricos reportados; NO existe clasificación retroactiva fiable por calendario a partir de números agregados. Tampoco se altera el SQL de Agentes usado para productividad.
- **Agenda de hoy:** `Pasadías Hoy` solo considera el calendario Pasadía; se agrega `Retroalimentación Hoy`, ambos sin canceladas.
- **Modelo auxiliar:** RPC `milhano_get_calendar_appointment_rows_v1(date,date,text)`, `SECURITY INVOKER`, `service_role` únicamente, alimenta V2/Agentes y los seis drilldowns. Fuente SQL en `supabase/migrations/20261123_milhano_calendar_split_pasadia_retro_v1.sql`.
- **Persistencia histórica:** la vista GHL todavía puede etiquetar Retroalimentación como `trial_day`; **no** se mutan citas de origen ni se alteran workflows n8n para resolverlo, pues la separación usa `calendar_id`.

## Desarrollo y despliegue

1. Trabajar desde HEAD de main y comparar con cambios externos. Nunca aplicar un ZIP viejo encima de main.
2. Modificar sólo las rutas y RPC necesarias; conservar IDs de pipeline/calendario y overrides.
3. Preparar migraciones aditivas e idempotencia/rollback explícitos; primero validar lecturas y permisos.
4. Ejecutar npm install --no-audit --no-fund --package-lock=false, npx tsc --noEmit --incremental false y npm run build. El lockfile actual está desincronizado; no usar npm ci hasta reconciliarlo como cambio separado. Probar conteos sobre fechas conocidas (incluido límite de rango y citas de hermanos).
5. Abrir rama/PR; la comprobación automática .github/workflows/dashboard-ci.yml ejecuta TypeScript y build para cambios app/components/lib. No fusionar si falla. Tras aprobar, desplegar en Vercel y verificar UI con usuario autorizado.
6. **Actualizar CHANGELOG.md siempre.** Actualizar el mapa técnico si hay nuevas rutas, funciones o dependencias; dejar las pruebas y el resultado del despliegue.

**Seguridad:** Nunca guardar API keys, contraseñas, datos personales de alumnos, JWT o audio/transcripciones en README, cambios, logs, archivos de ejemplo o commits. Ver riesgos conocidos y controles de revisión en docs/ARCHITECTURE.md.

### Open House: integración directa

- Botón de sincronización exclusivo de administradores: Vercel consulta GHL por HTTPS con el token de lectura en Vault vía DATABASE_URL (alternativamente OPEN_HOUSE_GHL_READ_TOKEN server-only), verifica paginación y cruces, y actualiza el modelo sin tocar asistencia, correcciones ni otros pipelines. Sin cron automático y sin n8n.
- Bienvenida: configurar OPEN_HOUSE_GHL_WELCOME_WEBHOOK_URL (trigger Inbound Webhook de GHL dedicado al evento), encontrar contacto existente por teléfono/email, validar DND y deduplicar por attendance_id; no crear contacto automáticamente ni modificar otros pipelines. Desactivado si falta URL. submitted = webhook aceptado, no WhatsApp entregado. review/dispatching requieren revisión manual, nunca reintento ciego.

- Actualización del listado Open House: manual por defecto; solo el 27/11/2026, cada 30 minutos entre 06:00 y 16:00 Mérida (apagado a las 16:00), en pestaña visible. El aviso y botón Actualizar permiten ver cambios de otros dispositivos y los registros recién guardados sin polling continuo.

- 26/11/2026: búsqueda QR abierta en modo prueba hasta medianoche Mérida. Verificación correcta devuelve aviso preview_verified (sin guardar ni enviar). El 27/11 de 07:00 a 15:30 vuelve al registro real automáticamente; URL permanente sin cambios.
