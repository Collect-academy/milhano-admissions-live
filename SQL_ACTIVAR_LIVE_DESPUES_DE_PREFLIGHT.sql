-- NO EJECUTAR hasta que el parche esté en Vercel, TICKETING_MODE=live
-- y las tres claves Stripe Live y webhook estén VERIFICADOS por el preflight.
-- Admin podrá comprar antes de 18:00; familias normales esperarán al horario SQL.
BEGIN;
DO $$
DECLARE e ticketing.events%rowtype; nseats int; nfam int; nadmin int;
BEGIN
 SELECT * INTO STRICT e FROM ticketing.events WHERE slug='halloween-2026' FOR UPDATE;
 SELECT count(*) INTO nseats FROM ticketing.seats WHERE event_id=e.id;
 SELECT count(*) INTO nfam FROM ticketing.families WHERE event_id=e.id;
 SELECT count(*) INTO nadmin FROM ticketing.families WHERE event_id=e.id AND is_ticketing_admin;
 IF e.environment <> 'live' OR e.access_enabled IS NOT TRUE OR e.sale_policy <> 'all'
    OR e.opens_at <> ('2026-10-22 18:00:00'::timestamp AT TIME ZONE 'America/Merida')
    OR e.closes_at <> ('2026-10-26 00:00:00'::timestamp AT TIME ZONE 'America/Merida')
    OR nseats <> 210 OR nfam <> 68 OR nadmin <> 1
 THEN RAISE EXCEPTION 'NO ACTIVATE: incorrect live event inventory / mode / dates'; END IF;
 UPDATE ticketing.events SET sales_enabled=true WHERE id=e.id;
END $$;
COMMIT;
