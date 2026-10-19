-- Limpia las ventas, reservaciones y eventos de pago del entorno de pruebas
-- Evento objetivo: halloween-2026-sandbox
-- Ejecutar solo cuando quieran reiniciar el entorno de testing.

begin;

with sandbox_event as (
  select id from ticketing.events where slug = 'halloween-2026-sandbox' limit 1
), sandbox_reservations as (
  select r.id
  from ticketing.reservations r
  join sandbox_event e on e.id = r.event_id
), sandbox_orders as (
  select o.id
  from ticketing.orders o
  join sandbox_reservations r on r.id = o.reservation_id
)
delete from ticketing.notification_outbox
where order_id in (select id from sandbox_orders);

with sandbox_event as (
  select id from ticketing.events where slug = 'halloween-2026-sandbox' limit 1
), sandbox_reservations as (
  select r.id
  from ticketing.reservations r
  join sandbox_event e on e.id = r.event_id
), sandbox_orders as (
  select o.id
  from ticketing.orders o
  join sandbox_reservations r on r.id = o.reservation_id
)
delete from ticketing.payment_events
where order_id in (select id from sandbox_orders);

with sandbox_event as (
  select id from ticketing.events where slug = 'halloween-2026-sandbox' limit 1
), sandbox_reservations as (
  select r.id
  from ticketing.reservations r
  join sandbox_event e on e.id = r.event_id
)
delete from ticketing.orders
where reservation_id in (select id from sandbox_reservations);

with sandbox_event as (
  select id from ticketing.events where slug = 'halloween-2026-sandbox' limit 1
), sandbox_reservations as (
  select r.id
  from ticketing.reservations r
  join sandbox_event e on e.id = r.event_id
)
delete from ticketing.reservation_seats
where reservation_id in (select id from sandbox_reservations);

with sandbox_event as (
  select id from ticketing.events where slug = 'halloween-2026-sandbox' limit 1
)
delete from ticketing.reservations
where event_id in (select id from sandbox_event);

commit;
