# Milhano Ticketing — Bloque 2 / V0.4 TEST ONLY

**Aplicar sobre el repo subido del 16 de octubre (V0.3.2 más webhook ticketing).** No sustituyas el repositorio completo. Este ZIP trae sólo 6 archivos que van a su misma ruta.

## Integrado
- 10 posiciones visuales reservadas no comprables a la izquierda de primera fila; asientos 1–10 colocados a la derecha. Inventario comercial numerado se mantiene en 210; confirmar aforo físico definitivo antes de habilitar venta.
- Espacio de pasillo antes de asiento 21 en segunda fila (entre 20 y 21).
- Textos visibles de reserva de 10 minutos y pago antes del vencimiento.
- Mantiene deselección automática de asientos empalmados y modal de conflictos de V0.3.2.
- Modal Payment Element con tarjeta en el propio /boletos; usa solamente sk_test_ / pk_test_ nuevas de Ticketing.
- Reservación => pedido sandbox en DB => se convierte a stripe TEST. Un PaymentIntent por pedido idempotente.
- El botón «Liberar asientos» permanece deshabilitado mientras el modal está abierto. Tras cerrarlo, la API comprueba y cancela el PaymentIntent antes de liberar; nunca libera PI succeeded / processing / requires_capture.
- Webhook separado ahora verifica eventos PAYMENT INTENT en lugar de los 3 eventos anteriores de Checkout Session. Valida firma, cuenta TEST, ID pedido, importe, moneda y referencia.
- Confirma venta sólo desde Stripe webhook con settle_order(). Cobra únicamente tarjetas de prueba; no se habilitan live keys ni IYES real.

## Requisito en Stripe ANTES de probar
En Stripe de Milhano -> Sandbox -> Workbench -> Webhooks -> destino /api/boletos/webhooks/stripe-ticketing -> añadir eventos Snapshot:
- payment_intent.succeeded
- payment_intent.canceled
- payment_intent.payment_failed
Conservar los eventos de checkout.session antiguos no perjudica, pero ya no se usan. No regenerar whsec si sólo se editan los eventos. STRIPE_TICKETING_WEBHOOK_SECRET debe seguir siendo el whsec de este destino. OJO: Stripe dashboard podría tener múltiples sandboxes/cuentas; keys y webhook deben corresponder a la MISMA cuenta y sandbox.

## Configuración Vercel Production (sólo pruebas)
- ENABLE_SANDBOX=true
- DATABASE_URL=<privada, ya configurada>
- STRIPE_TICKETING_SECRET_KEY=sk_test_...
- NEXT_PUBLIC_STRIPE_TICKETING_PUBLISHABLE_KEY=pk_test_...
- STRIPE_TICKETING_WEBHOOK_SECRET=whsec_...
NO editar STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, STRIPE_AFTERSCHOOL_PRICE_ID ni STRIPE_WEBHOOK_SECRET.

## Checklist necesario ANTES DE DECLARARLO TERMINADO
1. Ejecutar npm ci y npm run build dentro de tu checkout local (este entorno no pudo completar npm ci; sólo se pasó revisión sintáctica TS/TSX).
2. Hacer push a main sólo si compila.
3. Prueba dos familias distintas y tarjeta Stripe test 4242 4242 4242 4242, fecha futura, CVC cualquiera. Confirmar que llega el webhook `payment_intent.succeeded` y /api/boletos/order muestra paid.
4. Cerrar modal sin pagar, presionar Liberar, corroborar que devuelve los asientos a available.
5. Comprobar doble clic, reservas concurrentes, 10 minutos, webhook repetido y pagos tardíos.
6. La conciliación de pagos en procesamiento/expiración y reembolsos automáticos sigue siendo un BLOQUEADOR antes de activar live.
7. PDF con QR y entrega de emails aún NO están implementados. Requieren bloque dedicado, token verificable, generación de PDFs y servicio de correo; no mostrar botones ficticios en producción.
8. Filas de auditorio: confirmar si las diez plazas reservadas son físicas adicionales; no se añadieron asientos a la base de datos.

## Condición importante
Este parche no es una certificación de aptitud para cobros reales: limita Stripe a sk_test_ y el evento de laboratorio. Mantener modo LIVE desactivado hasta auditoría del vencimiento y confirmación asíncrona.
