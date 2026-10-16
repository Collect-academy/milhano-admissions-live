# Parche reserva de asientos — 30 minutos

Aplicar sobre el patch integrado V0.2, respetando rutas exactas. Archivo modificados: `lib/ticketing/server.ts`, `app/boletos/page.tsx`, `app/api/boletos/reserve/route.ts`.

## Modo ensayo
En Vercel Preview (NO Production) establecer `ENABLE_SANDBOX=true` y `DATABASE_URL` privada. El backend apuntará a `halloween-2026-sandbox`, no al evento real. La prueba exige familia y PIN, reserva los asientos físicamente en PostgreSQL durante 1800 segundos, y se reflejará en otro navegador mediante polling cada 3 segundos. Nunca hay cobro.

PIN de prueba (rotarlos antes de compartir públicamente): Equipo prueba A `946527`, Equipo prueba B `436890`.

Abrir dos navegadores separados, entrar con familias distintas, seleccionar los mismos asientos y reservar a la vez. Sólo uno deberá ganar; el segundo verá los números ocupados.

## Precauciones
No desplegar a producción sin build/test ni carga, este parche integra únicamente reserva sandbox. La expiración a 30 min no implica emisión de boleto. El evento comercial permanece deshabilitado.
