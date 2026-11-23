# AGENTS.md — protocolo obligatorio para IAs y colaboradores

**Leer README.md, docs/ARCHITECTURE.md y CHANGELOG.md antes de editar.** Este archivo define el contrato de mantenimiento del dashboard Milhano.

## Inicio sin contexto

1. Confirmar repositorio Collect-academy/milhano-admissions-live, HEAD actual de main y estado de despliegue. GitHub main es la referencia, NO ZIPs locales ni documentación histórica.
2. Identificar la ruta Next.js, utilidades lib, componentes, RPC, vistas y tablas afectadas. Trazar dependencias compartidas.
3. Releer definiciones SQL vigentes desde Supabase; no reconstruirlas de recuerdos ni de migraciones antiguas.
4. Identificar dueño del dato (GHL, EOD humano, Sofía, alumno o pago), unidad (appointment, opportunity, contacto, evento) y semántica temporal.
5. Clasificar cambio de solo lectura, escritura o integración externa. Priorizar implementaciones aditivas y aisladas.
6. Planear pruebas de regresión antes del primer cambio.

## Invariantes

- V2 Auto/GHL y Manual/EOD son fuentes diferentes, seleccionables en UI. No mezclar. Setter usa corte 14:30 Mérida; Closer citas reales.
- Agentes usa funciones de atribución y overrides propios. No recalcular productividad desde owner actual del contacto; primero Audit Logs reales.
- Citas: usar vw_milhano_appointment_events_v22, preservar filtros, exclusions, date_added overrides, appointment_status overrides y asignación de hermanos a metric_opportunity_id.
- School Tour Scheduled usa su calendario oficial; Pasadía Scheduled usa únicamente el calendario Pasadía. **Retroalimentación está actualmente clasificada trial_day:** no alterar Booked/Attended sin un proyecto de reconciliación y aprobación específicos.
- No confundir «Booked» (fecha creada) con «Scheduled» (fecha de la visita), ni «Attended» (outcome positivo por fecha programada).
- No inventar llamadas WhatsApp humanas. Stage_change real o booking son evidencia de gestión como límite superior.
- GHL/n8n/ElevenLabs/WhatsApp Calling de Sofía NO deben romperse ni migrarse por un cambio de dashboard. Evaluar cualquier operación que pueda tener efectos indirectos.
- Evitar SQL DROP/ALTER destructivo, GRANT público, cambios a policy/RLS o cron sin prueba de dependencias y aprobación.

## Patrón de implementación

- Extensiones de métricas: RPC separado SECURITY INVOKER, STABLE, permisos de solo service_role. Reutilizar la vista canónica para que conteo y drilldown compartan el mismo universo de citas.
- Frontend: lectura server-only desde createSupabaseAdmin; tipado en lib/admissions-v2.ts; la UI no debe recibir claves. Preferir llamadas en paralelo cuando no dependan entre sí.
- Un commit/PR autocontenido por cambio; prueba de TypeScript/build, fixtures SQL, conteos por scope, fechas límite y casos de hermanos/estado cancelled.
- Verificar permisos con has_function_privilege('anon'...) / authenticated / service_role, nunca asumir.
- No ejecutar pruebas de llamada real ni disparar workflows con efectos secundarios sin autorización.
- No actualizar ramas desprotegidas directamente si existe un flujo de PR seguro.
- Entrega al usuario: explicar exacto qué cambió, qué NO cambió, estado de build, migración, necesidad de n8n y rollback.

## Documentación obligatoria en CADA cambio

1. Añadir entrada a CHANGELOG.md con fecha, motivo, archivos, SQL, métricas, pruebas, riesgos, despliegue y rollback.
2. Si cambia la arquitectura o contratos, actualizar docs/ARCHITECTURE.md y el resumen aplicable de README.md.
3. Si cambia el protocolo o una invariante, actualizar AGENTS.md.
4. Revisar documentación y código juntos antes de fusionar; no afirmar despliegue sin comprobarlo.

## Alertas de referencia (auditadas 2026-11-23)

- El repositorio main no está protegido; revisar permisos y habilitar protección cuando se apruebe.
- RLS desactivado para public.milhano_ai_setter_dispatches, con permisos anon/auth: potencial exposición; revisar consumidores n8n y Sofía antes de modificar.
- Vistas SECURITY DEFINER como vw_milhano_student_directory y RPC antiguas ejecutables por anon: revisar y remediar controladamente; datos de alumnos son sensibles.
- El monitor de calidad puede reportar «unknown stage» muy por encima del número de stages no mapeados al cruzar IDs; investigar la definición del chequeo antes de reparar datos.
- No asumir que JSON de n8n con active:false implica que en producción está inactivo.
- La BD y repo son verificables, pero n8n activo, ElevenLabs y UI autenticada requieren verificación aparte.
