# MILHANO — Stripe Bloque 1 (integración independiente)

## Alcance
Agrega **una ruta nueva**, `app/api/boletos/webhooks/stripe-ticketing/route.ts`, sin modificar la ruta webhook existente, las claves Stripe anteriores ni After School.

Este endpoint acepta solamente firma de `STRIPE_TICKETING_WEBHOOK_SECRET` y opera solamente con `STRIPE_TICKETING_SECRET_KEY` de prueba. Valida evento con Stripe, importe, moneda, ID de sesión, pedido y evento sandbox antes de liquidar.

**No activa pagos ni Checkout.** El endpoint actual de `app/api/boletos/checkout/route.ts` sigue bloqueando checkout real; el bloque siguiente debe resolver la expiración a 10 minutos y el pago iniciado antes de habilitar cobros. No configurar Stripe live.

## Instalación
1. Copiar el archivo nuevo a su ruta exacta. No reemplazar `/api/boletos/webhooks/stripe/route.ts` (pertenece a la integración anterior).
2. `npm run build`; commit y push `main` sólo si compila.
3. En Stripe de Milhano **modo prueba** → Workbench / Webhooks → Crear destino → Eventos de esta cuenta → Snapshot events → URL: `https://milhano-admissions-live.vercel.app/api/boletos/webhooks/stripe-ticketing`.
4. Suscribir: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`.
5. Copiar el `whsec_...` **del destino nuevo** a Vercel Production bajo `STRIPE_TICKETING_WEBHOOK_SECRET` y redeploy.
6. No sustituir las variables existentes `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` o `STRIPE_AFTERSCHOOL_PRICE_ID`.

## Verificación
Sin una firma válida un POST debe devolver HTTP 400. Antes de configurar el secreto: HTTP 503. Eventos no incluidos o sin una orden real coincidente son ignorados o rechazados. Una prueba de webhook genérica desde Stripe NO debe producir venta de asientos.

## Pendientes bloque 2
- Diseñar pago embebido con ventana de 10 minutos; Checkout Session tradicional tiene expiración mínima 30 minutos.
- Coordinar cancelación de pago en proceso, liberación manual tras cierre de modal y expiración de holds sin ventas duplicadas.
- Enrolar evento real, familias, precio, layout y PDF; todavía NO vender boletos reales.
