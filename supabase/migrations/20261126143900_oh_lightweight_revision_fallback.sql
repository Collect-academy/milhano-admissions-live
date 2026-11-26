begin;
create table if not exists openhouse.change_revision (event_key date primary key,revision bigint not null default 0);
insert into openhouse.change_revision(event_key) values ('2026-11-27') on conflict do nothing;
alter table openhouse.change_revision enable row level security;
revoke all on openhouse.change_revision from public,anon,authenticated;
grant select,update on openhouse.change_revision to service_role;
create or replace function openhouse.emit_event_change()
returns trigger language plpgsql security invoker set search_path='' as $$
declare localnow timestamp:=clock_timestamp() at time zone 'America/Merida';
begin
 if localnow>=timestamp '2026-11-27 06:00:00' and localnow<timestamp '2026-11-27 16:00:00'
 and coalesce(current_setting('milhano.oh_signal_sent',true),'')<>'1' then
  update openhouse.change_revision set revision=revision+1 where event_key=date '2026-11-27';
  perform set_config('milhano.oh_signal_sent','1',true);
 end if;
 return null;
end $$;
create or replace function public.milhano_oh_revision_v1(p_actor text) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.milhano_app_users u where u.id::text=p_actor and u.is_active and (u.role='admin' or exists(select 1 from openhouse.staff s where s.app_user_id=u.id::text))) then return jsonb_build_object('error','Acceso no autorizado.','code','forbidden');end if;
 return jsonb_build_object('revision',(select revision::text from openhouse.change_revision where event_key=date '2026-11-27'));
end $$;
revoke all on function public.milhano_oh_revision_v1(text) from public,anon,authenticated;
grant execute on function public.milhano_oh_revision_v1(text) to service_role;
drop policy if exists oh_event_receive_20261127 on realtime.messages;
revoke execute on function openhouse_signal.can_receive() from authenticated;
revoke usage on schema openhouse_signal from authenticated;
commit;