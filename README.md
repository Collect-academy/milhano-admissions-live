Parche V0.4.1: corregir serialización JSON de verificación en webhook PaymentIntent.
No modifica After School ni credenciales.
Copiar app/api/boletos/webhooks/stripe-ticketing/route.ts al repo, npm run build, commit/push.
Reenviar eventos ya firmados desde Stripe después de desplegar. Reservas vencidas pueden quedar refund_required y no marcarse vendidas.
