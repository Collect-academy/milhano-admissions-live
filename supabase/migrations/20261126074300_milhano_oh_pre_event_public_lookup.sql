-- Applied to production on 2026-11-26. Preview day is read-only for attendance.
do $migration$
declare ddl text; old_gate text; new_gate text; marker text;
begin
 ddl:=pg_get_functiondef('public.milhano_oh_v1(text,jsonb,text)'::regprocedure);
 old_gate:=$old$if localnow::date<>ev or localnow::time<time '07:00' or localnow::time>time '15:30' then return jsonb_build_object('error','El registro estará disponible el viernes 27 de noviembre, de 07:00 a 15:30.','code','closed'); end if;$old$;
 new_gate:=$new$if localnow::date<>ev-1 and (localnow::date<>ev or localnow::time<time '07:00' or localnow::time>time '15:30') then return jsonb_build_object('error','El registro estará disponible el viernes 27 de noviembre, de 07:00 a 15:30.','code','closed'); end if;$new$;
 marker:=$mark$if f.attendance='present' then return jsonb_build_object('ok',true,'already',true); end if;$mark$;
 if position('preview_verified' in ddl)>0 then return; end if;
 if position(old_gate in ddl)=0 or position(marker in ddl)=0 then raise exception 'Unexpected live function; no change applied'; end if;
 ddl:=replace(ddl,old_gate,new_gate);
 ddl:=replace(ddl,marker,$preview$if localnow::date=ev-1 then return jsonb_build_object('error','Prueba exitosa: tus datos coinciden. La asistencia real se habilita mañana a las 07:00. No se guardó ninguna asistencia ni se envió WhatsApp.','code','preview_verified'); end if;
     $preview$||marker);
 execute ddl;
end $migration$;
revoke all on function public.milhano_oh_v1(text,jsonb,text) from public,anon,authenticated;
grant execute on function public.milhano_oh_v1(text,jsonb,text) to service_role;