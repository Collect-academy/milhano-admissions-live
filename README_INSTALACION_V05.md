# Milhano Ticketing V0.5 — Parche integrado para el ZIP (16)

## Alcance
- Ruta /boletos; ingreso mediante código de familia, sin dropdown ni PIN complementario.
- Compras repetidas por familia hasta el límite acumulado de 20 (ya protegido también por el motor SQL).
- Identificación de asientos propios en naranja; vendidos ajenos con V morada.
- Pasillo visual central continuo; zona de fotos eliminada; alerta por bocinas a la izquierda.
- Fila reservada ilustrativa de diez casillas. **No se ha alterado el inventario de 210 asientos.** Confirmar aforo antes de publicar.
- Reserva por 10 minutos (ya ajustada en Supabase); pagos confirmados no expiran.
- PDF generado en Next.js (uno por asiento, todos los pagos de la familia); QR firmado y verificación online.
- Correo OPT-IN únicamente al escribir una dirección y tocar Enviar. No hay envíos automáticos.
- Configuración `TICKETING_MODE=test|live` selecciona evento, credenciales y secreto de webhook. Por seguridad NO cambiar a live hasta importar familias/inventario y superar pruebas.

## Preparación en VS Code
1. Extraer archivos encima del repositorio main actual, respetando rutas.
2. En VS Code TERMINAL: `npm install` (necesario para pdf-lib, qrcode, @types/qrcode y actualizar package-lock.json).
3. `npm run build`. No hacer push si falla.
4. `git add app/boletos app/api/boletos lib/ticketing package.json package-lock.json`
5. `git commit -m "feat: family codes, accumulated tickets, PDF, optional email and ticket modes"`
6. `git push origin main` y confirmar Vercel Ready.

## Entorno actual: TEST
- `TICKETING_MODE=test` en Vercel Production (único switch de modo).
- Mantener `STRIPE_TICKETING_SECRET_KEY=sk_test_...`, `NEXT_PUBLIC_STRIPE_TICKETING_PUBLISHABLE_KEY=pk_test_...`, `STRIPE_TICKETING_WEBHOOK_SECRET=whsec_...`.
- `TICKETING_QR_SECRET`: valor aleatorio y secreto de 32+ caracteres; NO cambiarlo después de emitir boletos porque invalida los QR anteriores.
- `TICKETING_PUBLIC_BASE_URL=https://milhano-admissions-live.vercel.app`
- Correo opcional: `TICKETING_RESEND_API_KEY` (de Resend) y `TICKETING_EMAIL_FROM` (remitente de dominio verificado, ej. boletos@dominioverificado). **Hasta configurarlas el botón devuelve EMAIL_NOT_CONFIGURED y NO envía.**
- No modificar `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` ni `STRIPE_AFTERSCHOOL_PRICE_ID` de After School.
- Códigos de demostración actualmente disponibles en Supabase: `test-team-a` y `test-team-b`; las familias reales todavía no están importadas/validadas.

## Cambio futuro LIVE (no ejecutarlo ahora)
Solo cuando la BD real y pruebas estén listas: configurar `STRIPE_TICKETING_LIVE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_TICKETING_LIVE_PUBLISHABLE_KEY`, `STRIPE_TICKETING_LIVE_WEBHOOK_SECRET` (destino webhook separado del modo test), y cambiar `TICKETING_MODE=live` en entorno Production; redeploy. **El cambio de modo NO debe copiar datos ni ventas de sandbox.** El evento `halloween-2026` sigue cerrado y vacío por ahora.

## Migración aplicada
`ticketing_v05_family_code_sessions` creó `ticketing.verify_family_code(event_id, code, ip)` para `service_role`, con sesiones de 6h y rate limit. No requiere ejecutar SQL manual.

## Validación mínima
- Verifica código A y B en navegadores separados.
- Compra de prueba 2 asientos, espera confirmación de webhook y compara las vistas.
- Cierra/reabre y compra más con el MISMO código; comprueba límite acumulado 20.
- Descarga PDF tras una compra; QR debe abrir /api/boletos/verify y marcar válido.
- Configura proveedor de email; usa campo para enviar acumulado de compras.
- Prueba conflictos, doble clic, retardo, 10 minutos, pagos tardíos y reintentos webhook.

## Limitaciones conocidas de este paquete
- Se verificó sintaxis TS/TSX mediante TypeScript transpileModule; no se pudo instalar dependencias ni ejecutar `npm run build` en este entorno (npm sin acceso al registro). El build real es obligatorio antes de publicar.
- El módulo de correo usa Resend: necesita configuración y prueba real de entrega, no se envía automáticamente.
- No se importaron 67 familias preliminares debido a inconsistencias pendientes (reporte inicial incluye 83 alumnos frente a 82 elegibles confirmados); las dos familias demo sí están disponibles.
- Los pedidos de pruebas antiguos con `refund_required` requieren conciliación/reembolso explícito; no se purgó la BD.
- El código nuevo no modifica tablas ni rutas de Admisiones o After School. La ruta LEGACY `/api/boletos/webhooks/stripe` queda desactivada con 410 para evitar mezclar credenciales de otra cuenta; conservar sólo el webhook `/stripe-ticketing`.
