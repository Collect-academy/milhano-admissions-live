# CHANGELOG — Milhano dashboard

Registro obligatorio y acumulativo. **Cada commit que cambie comportamiento, datos, SQL, seguridad, integraciones o interfaz debe agregar una entrada**. No borrar entradas anteriores. Versiones antiguas en docs/MILHANO_PROJECT_NOTES.md y CAMBIOS_* son antecedentes, no estado actual.

## 2026-11-26 — Open House: cambios reactivos e impresión por coordinación

- Botón Actualizar separado a la derecha, indicador de conexión. Realtime privado solo el viernes 06:00–16:00; cambios de familias/outbox agrupados por transacción, sin PII; debounce y pausa en pestañas ocultas/edición, respaldo de 30 min y manual fuera de ventana. Permisos restringidos a admin/staff activo, sin exponer schema openhouse. Migración aplicada; pruebas SQL de permisos para maestros, usuario desconocido y anónimo. Prueba de entrega WebSocket real pendiente en ventana del evento; CI pendiente.
- Recorrido conserva rondas y separación; vista general permanente e impresión individual por José Lugo, Miguel y Aurora con roster propio. No cambia fechas, pasadías, GHL, Sofía ni n8n. Rollback: revertir frontend y retirar exclusivamente triggers/policy/helper de señal OH; conservar datos.

## 2026-11-26 — Open House: pasadías, recorrido y stage Asistido

- Agenda pública y staff, 11 grados y cupos 2/1, reglas de fecha, idempotencia, privacidad, cancelación/bloqueo admin, QR independiente. GHL calendar leído 26/11 sin citas de dic/ene; reserva local, no inserción GHL, sin polling. SQL aplicado y fixtures: restricciones primaria/sec/prepa, enero, capacidad 1 y 2, retry idempotente, cancelación libera, bloqueo, acceso no autorizado; revertidos, cero reservas reales iniciales.
- Recorrido: rotación sin cruces, 8–10 minutos, transición ajustable, estación 7 conjunta sin duración fija; lista por coordinador e impresión/PDF. No consultas nuevas.
- Stage Asistido: reemplaza webhook por backend HTTPS PUT y RPC outbox service-only; solo pipeline OH, early stages, verify identity, DND y duplicados, test exacto previo al evento, retry manual admin. No movimiento real durante desarrollo; permiso de escritura y workflow por verificar con TEST. No cambios a Sofía, otros pipelines, n8n ni permisos pg_net.
- CI inicial detectó TS18048 en el guard de oportunidad GHL; corregido con type predicate explícito, sin alterar lógica. Revalidación pendiente.
- Archivos: app/open-house/pasadia y pasadias, app/api/open-house/pasadia y pasadias, lib/open-house-trial*, lib/open-house-rotation.ts, componentes booking/admin/rotation, dashboard, proxy, lib/open-house-ghl.ts, API staff y dos migraciones. CI/preview y UI autenticada pendientes. Rollback: revertir frontend; preservar reservas/outbox, no borrar información.

## 2026-11-26 — Open House: verificación pública previa al evento

- SQL aditivo aplicado en producción: permite lookup y validación QR el 26/11, pero no guarda asistencia ni activa WhatsApp; el 27/11 conserva ventana real 07:00–15:30 Mérida. Verificado con un registro de cada uno de los cinco bloques y transacción revertida. Mantiene RPC service-only y privacidad.
- Actualización puntual GHL → Supabase: 159 oportunidades, 158 contactos únicos, 87 con reserva, 91 citas, sin conflictos manuales; oportunidad TEST en Agendado vinculada por ID exacto (existe otra oportunidad de prueba). No modificar GHL ni n8n. El futuro cambio a Asistido requiere implementación/permiso de escritura y validación de oportunidad única.
- Sin modificación de URL o QR. Rollback: restaurar guard de fecha previo si necesario; la excepción vence automáticamente.

## 2026-11-25 — Open House: reducción de consultas y egress

- Sustituye polling 5 s por actualización manual, con aviso persistente, última actualización y estado de cambios guardados. Guardar no consulta de nuevo la lista completa. Sync GHL sigue siendo manual y recarga por solicitud del operador.
- Solo el 27/11/2026, 06:00–16:00 Mérida (fin exclusivo), ticks de 30 min en pestaña visible, sin superposición, sin recuperar ticks perdidos, y apagado definitivo a las 16:00. Hasta 20 consultas automáticas por dispositivo. Verificados 8 casos de calendario y los 20 ticks; CI/preview de esta revisión pendientes.
- Archivos: components/open-house-dashboard.tsx, lib/open-house-refresh.ts, README.md, docs/ARCHITECTURE.md, CHANGELOG.md. Sin cambios SQL, n8n, GHL ni otros módulos. Rollback: revertir commit de frontend.

## 2026-11-25 — Open House: check-in, lista y Kanban (rama de revisión)

- Validación SQL: 149 contactos, 82 reservas únicas y 86 citas; fixture 6 familias 2/2/2, corrección, cambio de bloque, duplicados, QR con reloj de prueba aislado, merge preservando asistencia y claim de bienvenida. Fixtures revertidos; cero asistencias/auditorías/outbox de prueba. RPCs sin EXECUTE anon/authenticated. CI y prueba UI real todavía pendientes.
- QR PNG descargable desde el dashboard; usar URL de producción definitiva.
- Nuevo módulo /open-house y /open-house/registro; registro público limitado a evento, coincidencias enmascaradas y verificación adicional, staff autorizado, lista, búsqueda, edición, walk-ins, estadísticas, distribución por bloque y polling 5 s.
- Migración aditiva: schema openhouse, RPC service-only, importación desde snapshots privados, lock transaccional, auditoría y outbox. No modificar CRM, V2, Sofía, n8n, After School ni pg_net. After School queda accesible por ruta, oculto del menú.
- Integración: botón admin de sync directo GHL (Vault o env privada), actualización transaccional; bienvenida opcional por webhook GHL dedicado, claim atómico y estado submitted/review, sin envíos reales todavía. Decisiones pendientes: configurar y probar el workflow de bienvenida, revisar cuentas de operadores, prueba autenticada y del QR en preview, CI y prueba integral. Sin envíos reales. No afirmar despliegue hasta verificar.
- Rollback: revertir PR; conservar datos de asistencia/auditoría y desactivar acceso a nuevas rutas, no borrar tablas con datos.

## 2026-11-23 — V2/Agentes: separación completa de calendarios Pasadía y Retroalimentación

**Estado final:** PR #3 fusionado a `main` (squash commit `36a40346dc118e85cffe902c8d2b459abe6de1ce`); migración aditiva SQL aplicada. CI del PR validó TypeScript y build Next.js; Vercel Preview y despliegue de producción del commit fueron satisfactorios. Comprobación manual de interfaz autenticada pendiente.

- **Objetivo:** eliminar citas de Retroalimentación de **todas** las scorecards de Pasadía y ofrecer **Retroalimentación Booked, Scheduled y Attended**, con sus desgloses clicables.
- **Calendarios:** Pasadía `a0bvCaXgCdVwSrgPELza`, Retroalimentación `Vkw8NTh2ag1QyEzu962b`, clasificados exclusivamente por `calendar_id`. No modificar ni reclasificar citas históricas en GHL.
- **Modelo:** nueva función `milhano_get_calendar_appointment_rows_v1` SECURITY INVOKER y service_role-only. Reusa `vw_milhano_appointment_events_v22` con overrides y vinculación de hermanos; recupera citas del periodo por `booked_date`, `scheduled_date` o agenda de hoy. Frontend comparte una única normalización para General, Closer, Agentes, drilldowns y agenda de hoy.
- **UI:** V2 General y Closer Auto y sección de citas de Agentes con seis scorecards. `/v2/leads` presenta `Agendada el`, `Programada para` y el criterio temporal explícito para cada calendario. `Pasadías Hoy` deja de mezclar Retroalimentación y aparece `Retroalimentación Hoy`.
- **Sin cambios:** modelo original de oportunidades, stage timings, RPCs SQL de V2/Agentes, Manual EOD, pipelines GHL, n8n, ElevenLabs, Sofía y pagos.
- **Fixture SQL del 1 al 23 de noviembre 2026:** Pasadía `6/6/2`; Retroalimentación `4/4/2` (Booked/Scheduled/Attended). 32 citas totales entre los dos calendarios, 32 appointment_id únicos; lectura SQL noviembre ≈130 ms. Permisos EXECUTE anon=false, authenticated=false, service_role=true.
- **Archivos:** `lib/admissions-calendar-metrics.ts`, `lib/admissions-v2.ts`, `lib/agent-analytics.ts`, `app/page.tsx`, `app/v2/leads/page.tsx`, `components/admissions-v2-cascade.tsx`, `components/agent-conversion-funnel.tsx`, migración SQL, README.md, AGENTS.md, docs/ARCHITECTURE.md y CHANGELOG.md.
- **Verificación automática:** TypeScript y build Next.js aprobados en PR; Vercel Preview y despliegue de `main` exitosos. **Verificación SQL:** conteos por calendario en sep/oct/nov coinciden con el total combinado anterior de Booked; los seis drilldowns filtran los mismos registros que sus scorecards. **Pendiente:** comprobación visual autenticada de los seis enlaces. 
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
