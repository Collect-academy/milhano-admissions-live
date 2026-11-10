# Sofía IA — lotes WhatsApp con concurrencia de ElevenLabs

## Decisión vigente — 9 de noviembre de 2026
**Se elimina el requisito de cola FIFO propia y de una sola llamada activa.**
En el nuevo modelo, cada lote emite X solicitudes de autorización de llamada mediante ElevenLabs. Una vez que las familias aceptan (en momentos independientes), **ElevenLabs inicia las llamadas automáticamente** y administra la concurrencia según la configuración del agente, el límite del plan y la cola nativa si aplica. No se bloquea el envío de otras autorizaciones a la espera de una conversación.

La cola FIFO de permisos desarrollada previamente en Supabase **no se usa para despachar este lote**, ni se debe activar para el envío de autorizaciones.

## Primer lote programado
- Fecha: **martes 10 de noviembre de 2026**.
- Inicio: **08:00 a. m. hora de Mérida (America/Merida)**.
- Job único: `sofia-2026-11-10-0800-newlead-10`.
- Workflow: `MILHANO | Sofia | 08 One Shot Authorizations | 10 NOV 08:00 MERIDA`.
- Cantidad: **10 autorizaciones**, no 10 llamadas completadas garantizadas.
- Segmento: las 10 oportunidades elegibles más antiguas del stage **New Lead** en Setter, seleccionadas según el espejo Supabase y verificadas de nuevo en GHL, excluyendo duplicados, contactos con DND y oportunidades que ya cambiaron de estado.
- Agente: Sofía **ElevenLabs main**; el WF03 productivo fue auditado para comprobar que no fija la antigua branch V2.
- El workflow cron está configurado con `0 8 10 11 *`, zona `America/Merida`; una función transaccional solo autoriza una ejecución dentro de la ventana 08:00–08:12 del **10 de noviembre de 2026**, evitando ejecuciones repetidas en años posteriores.
- Reglas: si no se encuentran diez contactos válidos, **no se envía un lote parcial sin advertencia**. Las respuestas ambiguas de ElevenLabs quedan para revisión, sin reintentos automáticos.
- No publicar WF06 ni activar `live_dispatch_enabled` en paralelo para este lote; el nuevo cron funciona de forma aislada.
- La solicitud puede ser aceptada más tarde o nunca. Una aceptación posterior puede desencadenar una llamada cuando ElevenLabs la procese, siempre conforme a su mecanismo de concurrencia.
- Seguimiento: WF07 lee tanto los intentos de campaña como la tabla `milhano_ai_wa_scheduled_dispatches` y recupera resultados con la credencial existente de ElevenLabs cada 15 minutos, cuando corresponda.

## Controles de seguridad
1. No se envía ninguna autorización antes de las 08:00.
2. Una sola reclamación atómica del job (`armed` → `claimed`); no se repite en caso de falla.
3. Reserva atómica de las 10 oportunidades antes de realizar las solicitudes.
4. GHL se vuelve a consultar en vivo; si la oportunidad no sigue en New Lead o el contacto tiene DND, no se incluye.
5. Se reutiliza el WF03 existente; no se cambia ni el agent ID ni los webhooks productivos.
6. El registro de envío diferencia aceptación de la solicitud `DISPATCHED` y llamada efectivamente iniciada/terminada.
7. Las escrituras de etapas GHL siguen desactivadas en `milhano_ai_runtime_control.stage_writes_enabled` mientras se validan.

## Nota operativa
Que el envío esté programado **no garantiza que Meta entregue los permisos** ni que las personas los acepten. Verificar después los resultados reales en Supabase, n8n y ElevenLabs; no confundir una autorización enviada con una llamada conectada.

Fuentes oficiales:
- https://elevenlabs.io/docs/eleven-agents/whatsapp/outbound
- https://elevenlabs.io/docs/api-reference/integrations/whats-app/outbound-call
