begin;
create or replace function public.milhano_oh_trial_match_v2(p_phone text,p_verified_id uuid,p_bucket text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare ph text:=openhouse.phone10(p_phone); localday date:=(now() at time zone 'America/Merida')::date; k text; n int; matches jsonb;
begin
 if ph='' or coalesce(p_bucket,'') !~ '^[a-f0-9]{64}$' or localday not between date '2026-11-26' and date '2027-01-31' then return jsonb_build_object('matches','[]'::jsonb);end if;
 foreach k in array array['trial-profile:global','trial-profile:'||p_bucket] loop
  insert into openhouse.rate_limits(bucket,window_start) values(k,date_bin(interval '5 minutes',now(),timestamptz '2026-01-01'))
  on conflict(bucket,window_start) do update set hits=openhouse.rate_limits.hits+1 returning hits into n;
  if n>(case when k='trial-profile:global' then 300 else 30 end) then return jsonb_build_object('error','Demasiadas consultas. Puedes completar los datos manualmente.','code','rate');end if;
 end loop;
 select coalesce(jsonb_agg(q.item order by q.priority,q.sort_name,q.id),'[]'::jsonb) into matches
 from (select ff.id,ff.name as sort_name,case when ff.attendance='present' then 0 else 1 end as priority,
 jsonb_build_object('id',ff.id,'label',left(split_part(trim(ff.name),' ',1),2)||'••• '||left(split_part(trim(ff.name),' ',2),2)||'•••','email_label',case when coalesce(ff.email,'')<>'' then left(ff.email,1)||'•••@•••' else '' end,'verified',coalesce(ff.id=p_verified_id and (ff.attendance='present' or localday=date '2026-11-26'),false))
 ||case when ff.id=p_verified_id and (ff.attendance='present' or localday=date '2026-11-26') then jsonb_build_object('guardian',ff.name,'email',ff.email) else '{}'::jsonb end as item
 from openhouse.families ff where ff.event_key=date '2026-11-27' and openhouse.phone10(ff.phone)=ph order by priority,ff.name,ff.id limit 20) q;
 return jsonb_build_object('matches',matches);
end $$;
create or replace function public.milhano_oh_trial_book_family_v2(p_payload jsonb,p_family_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare f openhouse.families%rowtype; ph text:=openhouse.phone10(p_payload->>'phone');
begin
 if ph='' then return jsonb_build_object('error','WhatsApp inválido.');end if;
 select * into f from openhouse.families ff where ff.id=p_family_id and ff.event_key=date '2026-11-27' and openhouse.phone10(ff.phone)=ph;
 if not found then return jsonb_build_object('error','La familia seleccionada ya no coincide. Busca nuevamente.','code','family_changed');end if;
 return public.milhano_oh_trial_v1('book',p_payload||jsonb_build_object('guardian',f.name,'email',coalesce(f.email,'')),null);
end $$;
revoke all on function public.milhano_oh_trial_match_v2(text,uuid,text),public.milhano_oh_trial_book_family_v2(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.milhano_oh_trial_match_v2(text,uuid,text),public.milhano_oh_trial_book_family_v2(jsonb,uuid) to service_role;
commit;