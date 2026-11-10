# Sofía — permisos primero, llamadas después (cola FIFO)

## Regla de producto confirmada

El lote de 10 (y posteriormente cualquier número) **envía las solicitudes de permiso sin mantener una llamada ocupada**.
La aceptación es asíncrona: cada destinatario puede aceptar hoy, mañana, más tarde o nunca. Sólo las aceptaciones verificadas y vigentes participan en la cola. Las llamadas deben iniciarse **una por una**, en orden de fecha/hora real de aceptación y desempate estable. No bloquear el envío de otras solicitudes mientras una está pendiente.

## Importante: ElevenLabs puede romper la concurrencia si se usa directamente

La API de ElevenLabs `/v1/convai/whatsapp/outbound-call` combina permiso y llamada:
- sin permiso, manda autorización y coloca la llamada *automáticamente* al aprobarse;
- con permiso, llama inmediatamente.

Por eso NO se puede usar esta API para mandar 10 autorizaciones a la vez esperando conservar una cola de marcación propia. La serie de disparos actual del WF03 (y su réplica en WF06) debe **permanecer bloqueada** para la fase masiva hasta resolver la separación.

Fuentes oficiales:
- https://elevenlabs.io/docs/eleven-agents/whatsapp/outbound
- https://elevenlabs.io/docs/api-reference/integrations/whats-app/outbound-call

## Modelo aprobado

1. **Solicitud de permiso**: enviar plantilla de solicitud de permiso aprobada (o mensaje interactivo permitido), sin programar llamada. Guardar el ID de mensaje del proveedor y timestamp.
2. **Recepción**: recibir `call_permission_reply` autenticado desde WhatsApp/Meta; relacionar el evento con el ID de mensaje y contacto. Idempotencia por ID de evento; registrar `approved_at`, `approval_received_at`, expiración o aprobación permanente.
3. **Cola**: elegir sólo permisos aprobados y vigentes. Orden `approved_at ASC, approval_received_at ASC, id ASC`; un permiso pendiente o rechazado nunca bloquea a otro.
4. **Despacho**: obtener lock transaccional global y validar en GHL contacto, DND, etapa y ausencia de citas/campañas competidoras; confirmar que no hay otra llamada activa.
5. **Llamada**: sólo cuando se adjudica el turno, invocar `outbound-call` con permiso ya vigente, agente Sofía **main**. Guardar ID de conversación.
6. **Liberación**: sólo tras confirmar el fin de la conversación real, error terminal o revisión manual. Una llamada en `initiated`/esperando permisos NO equivale a una llamada completa; si la respuesta es ambigua, retener lock o dejar caso para revisión.
7. **Ventanas**: aplicar las franjas horarias al momento de llamar; las aceptaciones se conservan en FIFO fuera de horario, hasta caducar. Si el permiso vence antes de su turno, no llamar.

## Implementación existente comprobada

Supabase ya contiene `public.milhano_ai_call_permissions` con:
`request_state`, `permission_message_id`, `requested_at`, `approval_event_id`, `approved_at`, `approval_received_at`, `expires_at`, `permanent`, `dial_state`, `dial_claim_token`, `dial_claimed_at`, `actual_call_started_at`, `conversation_id` y `call_finished_at`.

Funciones:
- `milhano_ai_register_permission_request`
- `milhano_ai_record_permission_reply`
- `milhano_ai_claim_next_permissioned_call`

La función de reclamación implementa el orden de aceptación y la exclusión mutua con los despachos anteriores. **Esto no confirma que los webhooks de autorización ni el envío independiente estén conectados.** No volver a crear esa tabla con un esquema distinto.

## Integración pendiente antes de una prueba con 10 autorizaciones

Verificar en la cuenta concreta de WhatsApp que n8n pueda:
- enviar una **solicitud de permiso real** sin disparar una llamada, mediante canal oficial compatible con el número ya administrado por ElevenLabs;
- recibir y autenticar la respuesta `call_permission_reply`, sin interferir con los webhooks de ElevenLabs;
- utilizar el permiso concedido en la llamada programada por ElevenLabs y respetar las reglas de Meta.

Si el número sólo permite la autorización gestionada por ElevenLabs con llamada automática, ese camino **no cumple** el requisito FIFO/serial. No activar un lote de solicitudes hasta disponer de una ruta separada de permisos verificable.

## Escenario de aceptación

Enviar permisos a A–J. F acepta a las 10:01, C a las 10:02 y A a las 10:03.
La cola ejecuta **F → C → A**, no A → C → F. Si J acepta mañana, entra al final de lo pendiente en ese momento, siempre dentro de vigencia y horario.

## Seguridad actual

`milhano_ai_runtime_control.live_dispatch_enabled=false`; no habilitar hasta validar el sender de permisos, webhook, cola y fin real de conversación. Ningún workflow existente debe pasar a activo como efecto de este documento.
