-- Milhano Ticketing: remove cumulative/per-order 20-seat cap ONLY for is_ticketing_admin.
-- Ordinary families retain both 20-seat per-request and max_per_family cumulative cap.
-- Live sale window and sales_enabled must remain enforced by ticketing.can_purchase().
-- Does not activate Live payments, alter events, or remove existing reservations.
BEGIN;
DO $check$ BEGIN
  IF (SELECT count(*) FROM ticketing.families f JOIN ticketing.events e ON e.id=f.event_id
      WHERE e.slug='halloween-2026' AND e.environment='live' AND f.is_ticketing_admin AND f.active) <> 1
  THEN RAISE EXCEPTION 'Expected exactly one active ticketing admin in Live; abort'; END IF;
END $check$;

CREATE OR REPLACE FUNCTION ticketing.reserve_seats(
  p_session_token text,p_event uuid,p_seats uuid[],p_idempotency text,p_ip text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
 fid uuid; ev ticketing.events%rowtype; r ticketing.reservations%rowtype;
 s uuid; n integer; already integer; fingerprint text;
 is_admin boolean := false; admin_cap integer; now_time timestamptz:=clock_timestamp();
BEGIN
 IF NOT ticketing.check_rate_limit('reserve_ip',coalesce(p_ip,''),30,60,120) THEN RAISE EXCEPTION 'RATE_LIMITED'; END IF;
 fid:=ticketing.authorize_family(p_session_token);
 IF NOT ticketing.check_rate_limit('reserve_family',fid::text,10,60,120) THEN RAISE EXCEPTION 'RATE_LIMITED'; END IF;
 IF p_idempotency IS NULL OR length(p_idempotency)<12 OR length(p_idempotency)>128 THEN RAISE EXCEPTION 'INVALID_IDEMPOTENCY'; END IF;
 SELECT f.is_ticketing_admin INTO is_admin FROM ticketing.families f WHERE f.id=fid AND f.event_id=p_event AND f.active;
 is_admin:=coalesce(is_admin,false);
 n:=cardinality(p_seats);
 IF n IS NULL OR n<1 OR n>210 OR (NOT is_admin AND n>20)
    OR (SELECT count(distinct x) FROM unnest(p_seats) x)<>n
 THEN RAISE EXCEPTION 'INVALID_SEATS'; END IF;
 fingerprint:=encode(extensions.digest(p_event::text||':'||(SELECT string_agg(x::text,',' ORDER BY x) FROM unnest(p_seats) x),'sha256'),'hex');
 SELECT * INTO ev FROM ticketing.events WHERE id=p_event;
 IF NOT FOUND OR NOT ticketing.can_purchase(fid,p_event) THEN RAISE EXCEPTION 'PURCHASES_NOT_ALLOWED'; END IF;
 SELECT * INTO r FROM ticketing.reservations WHERE family_id=fid AND idempotency_key=p_idempotency;
 IF FOUND THEN
  IF r.request_fingerprint<>fingerprint THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
  RETURN r.id;
 END IF;
 -- Serialize family purchases; lock seats in sorted order to prevent race conditions.
 PERFORM 1 FROM ticketing.families WHERE id=fid AND event_id=p_event AND active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'FAMILY_EVENT_MISMATCH'; END IF;
 SELECT * INTO r FROM ticketing.reservations WHERE family_id=fid AND idempotency_key=p_idempotency;
 IF FOUND THEN
  IF r.request_fingerprint<>fingerprint THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
  RETURN r.id;
 END IF;
 FOR s IN SELECT x FROM unnest(p_seats) x ORDER BY x LOOP
  PERFORM 1 FROM ticketing.seats WHERE id=s AND event_id=p_event AND status='available' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SEAT_UNAVAILABLE'; END IF;
 END LOOP;
 IF EXISTS(
  SELECT 1 FROM ticketing.reservation_seats rs JOIN ticketing.reservations rr ON rr.id=rs.reservation_id
  WHERE rs.seat_id=ANY(p_seats) AND
    (rr.status IN ('paid','payment_review') OR
     (rr.status IN ('held','checkout_pending') AND rr.expires_at>clock_timestamp()))
 ) THEN RAISE EXCEPTION 'SEAT_UNAVAILABLE'; END IF;
 SELECT coalesce(sum(CASE WHEN rr.status IN ('paid','payment_review') OR
  (rr.status IN ('held','checkout_pending') AND rr.expires_at>clock_timestamp()) THEN 1 ELSE 0 END),0)
 INTO already FROM ticketing.reservations rr
 JOIN ticketing.reservation_seats rs ON rs.reservation_id=rr.id
 WHERE rr.family_id=fid AND rr.event_id=p_event;
 IF is_admin THEN
  SELECT count(*) INTO admin_cap FROM ticketing.seats WHERE event_id=p_event AND status='available';
 ELSE
  admin_cap:=ev.max_per_family;
 END IF;
 IF already+n>admin_cap THEN RAISE EXCEPTION 'FAMILY_LIMIT'; END IF;
 INSERT INTO ticketing.reservations(event_id,family_id,idempotency_key,request_fingerprint,session_id,expires_at)
 SELECT p_event,fid,p_idempotency,fingerprint,id,clock_timestamp()+make_interval(secs=>ev.hold_seconds)
 FROM ticketing.family_sessions
 WHERE token_hash=encode(extensions.digest(p_session_token,'sha256'),'hex')
 RETURNING * INTO r;
 INSERT INTO ticketing.reservation_seats(reservation_id,seat_id) SELECT r.id,x FROM unnest(p_seats) x;
 INSERT INTO ticketing.audit_log(event_id,family_id,reservation_id,action,details)
 VALUES(p_event,fid,r.id,'reservation_created',jsonb_build_object('seat_count',n));
 RETURN r.id;
END $function$;
REVOKE ALL ON FUNCTION ticketing.reserve_seats(text,uuid,uuid[],text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION ticketing.reserve_seats(text,uuid,uuid[],text,text) TO postgres,service_role;
COMMIT;
