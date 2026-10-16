# PATCH ADITIVO — Milhano Ticketing /boletos

Aplicar estos archivos desde la **raíz** del repositorio actual `milhano-admissions-live` (no subir carpetas contenedoras).

Modificados: `proxy.ts` (lista blanca precisa), `package.json` (solo añade postgres y zod).
Nuevos: `app/boletos/*`, `app/api/boletos/*`, `lib/ticketing/*`.

**IMPORTANTE:** se reconoce explícitamente la ruta de acceso público de los padres. No pide Supabase Auth. El PIN se valida en servidor y sólo después se permite consultar asientos. El evento sigue cerrado (`sales_enabled=false`) y no hay familias/asientos importados, por lo que aún no se puede comprar.

## Variables Vercel (nunca NEXT_PUBLIC)
- `DATABASE_URL`: connection pooler Postgres de Supabase (credencial de servidor; revisar privilegios antes de añadir).
- `ENABLE_SANDBOX=false` en **Production**.
- `ENABLE_STRIPE_LIVE=false` en **Production**.
- `TICKETING_SANDBOX_KEY`: clave aleatoria, sólo en Preview, para futuro panel staff; NO copiar al navegador.

En Preview privado, se permite `ENABLE_SANDBOX=true` pero se requiere clave interna para simular pagos. La UI pública NO incluye botones de simular pago. Queda pendiente UI exclusiva del equipo de testing.

## Precauciones
- Este paquete es un parche de integración, **no** certificación de producción.
- Stripe real sigue bloqueado porque la sesión alojada puede permanecer pagable más de tres minutos.
- No se ha verificado build completo de producción ni ejecutado prueba de 100 workers.
- Debe verificarse `DATABASE_URL` para no otorgar permisos del dashboard al código público. Idealmente cuenta DB dedicada con privilegios exclusivos `ticketing`.
- Hacer pruebas con Vercel Preview antes de merge a main.
- Las compras sandbox requieren modo de test de staff pendiente de interfaz; el endpoint exige clave de servidor, por lo que no se puede llamar desde browser directamente con seguridad.
- El correo y referencias de confirmación necesitan integración real de envíos.
- Verificar bloqueo por IP confiable en Vercel y CSRF/origin antes de lanzar.
