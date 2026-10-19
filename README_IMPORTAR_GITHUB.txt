MILHANO TICKETING — AJUSTES FINALES PARA GITHUB

Archivos incluidos:
1) app/boletos/page.tsx
2) app/boletos/ticketing.bloque2.css
3) app/api/boletos/webhooks/stripe-ticketing/route.ts
4) supabase/ticketing_reset_sandbox_sales.sql

Qué corrige:
- Restaura el fix del webhook de Stripe (evita la regresión del pago que quedó abierta en V0.5).
- Alinea toda la cuadrícula de asientos.
- Hace que todos los asientos tengan el mismo tamaño.
- Mueve el pasillo al centro y muestra PASILLO verticalmente.
- Reemplaza el vendido visual por V.
- Quita zona de fotos y añade bocinas/cafetería más visibles.
- Mantiene la leyenda visual con ejemplos reales de estado.

Cómo aplicar:
A) Copia los 3 archivos de app/ en tu repo, respetando las rutas.
B) Si deseas limpiar los boletos vendidos del sandbox, ejecuta el SQL de supabase/ticketing_reset_sandbox_sales.sql en SQL Editor.
C) Luego corre npm run build, commit y push.
