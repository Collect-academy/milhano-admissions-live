begin;
create schema if not exists openhouse_signal;
revoke all on schema openhouse_signal from public,anon,authenticated;
grant usage on schema openhouse_signal to authenticated;
create or replace function openhouse_signal.can_receive()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.milhano_app_users u where u.auth_user_id=(select auth.uid()) and u.is_active and (u.role='admin' or exists(select 1 from openhouse.staff s where s.app_user_id=u.id::text)))
$$;
revoke all on function openhouse_signal.can_receive() from public,anon,authenticated;
grant execute on function openhouse_signal.can_receive() to authenticated;
create policy oh_event_receive_20261127 on realtime.messages for select to authenticated using (
 extension='broadcast' and (select realtime.topic())='milhano:openhouse:2026-11-27:changes'
 and (select openhouse_signal.can_receive())
);
create or replace function openhouse.emit_event_change()
returns trigger language plpgsql security invoker set search_path='' as $$
declare localnow timestamp:=clock_timestamp() at time zone 'America/Merida';
begin
 if localnow>=timestamp '2026-11-27 06:00:00' and localnow<timestamp '2026-11-27 16:00:00'
 and coalesce(current_setting('milhano.oh_signal_sent',true),'')<>'1' then
  begin
   perform realtime.send(jsonb_build_object('changed',true),'changed','milhano:openhouse:2026-11-27:changes',true);
   perform set_config('milhano.oh_signal_sent','1',true);
  exception when others then
   raise warning 'Open House change notification unavailable';
  end;
 end if;
 return null;
end $$;
revoke all on function openhouse.emit_event_change() from public,anon,authenticated;
grant execute on function openhouse.emit_event_change() to service_role;
create trigger oh_signal_families after insert or update or delete on openhouse.families for each row execute function openhouse.emit_event_change();
create trigger oh_signal_outbox after insert or update or delete on openhouse.outbox for each row execute function openhouse.emit_event_change();
commit;