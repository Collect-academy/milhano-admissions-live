begin;
create or replace function public.milhano_oh_trial_profile_v1(p_phone text,p_name text,p_verified_id uuid,p_bucket text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare phone10 text:=openhouse.phone10(p_phone); nm text:=openhouse.norm(p_name); f openhouse.families%rowtype; n int; k text; localday date:=(now() at time zone 'America/Merida')::date;
begin
 if phone10='' or coalesce(p_bucket,'') !~ '^[a-f0-9]{64}$' or localday<date '2026-11-26' or localday>date '2027-01-31' then return jsonb_build_object('matched',false);end if;
 foreach k in array array['trial-profile:global','trial-profile:'||p_bucket] loop
  insert into openhouse.rate_limits(bucket,window_start) values(k,date_bin(interval '5 minutes',now(),timestamptz '2026-01-01'))
  on conflict(bucket,window_start) do update set hits=openhouse.rate_limits.hits+1 returning hits into n;
  if n>(case when k='trial-profile:global' then 300 else 30 end) then return jsonb_build_object('error','Demasiadas consultas. Puedes completar los datos manualmente.','code','rate');end if;
 end loop;
 if p_verified_id is not null then
  select * into f from openhouse.families ff where ff.id=p_verified_id and ff.event_key=date '2026-11-27' and openhouse.phone10(ff.phone)=phone10 and (ff.attendance='present' or localday=date '2026-11-26');
  if found then return jsonb_build_object('matched',true,'guardian',f.name,'email',f.email);end if;
 end if;
 if length(nm)>=3 then
  select count(*) into n from openhouse.families ff where ff.event_key=date '2026-11-27' and ff.attendance='present' and openhouse.phone10(ff.phone)=phone10 and openhouse.norm(ff.name)=nm;
  if n=1 then
   select * into f from openhouse.families ff where ff.event_key=date '2026-11-27' and ff.attendance='present' and openhouse.phone10(ff.phone)=phone10 and openhouse.norm(ff.name)=nm;
   return jsonb_build_object('matched',true,'guardian',f.name,'email',f.email);
  end if;
 end if;
 return jsonb_build_object('matched',false);
end $$;
revoke all on function public.milhano_oh_trial_profile_v1(text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.milhano_oh_trial_profile_v1(text,text,uuid,text) to service_role;
commit;