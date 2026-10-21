-- Ajuste del registro de cambios: la ventana en la que lo que se guarda tras crear una recepción
-- se considera parte de la creación pasa de 60 s a 15 s (120 s para las fotos, que se suben más despacio).

create or replace function public.audit_merge(eid uuid, k text, val jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  rid bigint;
  cur jsonb;
  actor text := coalesce((select full_name from public.profiles where id = auth.uid()), '');
  creation_window interval := case when k = 'fotos_anadidas' then interval '120 seconds' else interval '15 seconds' end;
begin
  if exists (select 1 from public.audit_log
             where entity_id = eid and action = 'insert' and user_id is not distinct from auth.uid()
               and at > now() - creation_window) then
    return;
  end if;

  select id, changes into rid, cur from public.audit_log
   where entity_id = eid and action = 'update' and user_id is not distinct from auth.uid()
     and at > now() - interval '30 seconds'
   order by at desc limit 1;

  if rid is null then
    insert into public.audit_log (user_id, user_name, action, entity_id, summary, changes)
    values (auth.uid(), actor, 'update', eid, coalesce(public.audit_summary(eid), '{}'), jsonb_build_object(k, val));
  else
    update public.audit_log
       set changes = cur || jsonb_build_object(k,
             case when jsonb_typeof(val) = 'array' then coalesce(cur -> k, '[]'::jsonb) || val
                  else coalesce(cur -> k, '{}'::jsonb) || val end)
     where id = rid;
  end if;
end $$;
