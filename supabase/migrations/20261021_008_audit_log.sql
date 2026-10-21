-- Registro de cambios de recepciones: quién creó, modificó o eliminó, y cuándo.
-- Lo escriben triggers (no se puede falsear desde la app); solo lo lee el administrador.

create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid,
  user_name text not null default '',
  action text not null check (action in ('insert', 'update', 'delete')),
  entity_id uuid not null, -- id de la recepción (sin FK: el registro sobrevive a su borrado)
  summary jsonb not null default '{}',
  changes jsonb not null default '{}'
);
create index on public.audit_log (at desc);
create index on public.audit_log (entity_id);

alter table public.audit_log enable row level security;
create policy audit_log_select_admin on public.audit_log for select to authenticated
  using (public.is_admin());
-- Sin políticas de escritura: solo las funciones de abajo (security definer) pueden insertar.

create or replace function public.audit_summary(rid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('lote', r.lot, 'proveedor', r.supplier_name, 'producto', r.product, 'fecha', r.received_at)
  from public.receptions r where r.id = rid;
$$;

-- Añade un cambio al registro de la recepción. Los cambios que llegan seguidos (un guardado reescribe
-- palets, defectos y fotos) se agrupan en una sola entrada; los de la propia creación no cuentan.
create or replace function public.audit_merge(eid uuid, k text, val jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  rid bigint;
  cur jsonb;
  actor text := coalesce((select full_name from public.profiles where id = auth.uid()), '');
begin
  if exists (select 1 from public.audit_log
             where entity_id = eid and action = 'insert' and user_id is not distinct from auth.uid()
               and at > now() - interval '60 seconds') then
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

create or replace function public.audit_reception() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  actor text := coalesce((select full_name from public.profiles where id = auth.uid()), '');
  o jsonb;
  n jsonb;
  k text;
  diff jsonb := '{}';
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (user_id, user_name, action, entity_id, summary)
    values (auth.uid(), actor, 'insert', new.id,
            jsonb_build_object('lote', new.lot, 'proveedor', new.supplier_name, 'producto', new.product, 'fecha', new.received_at));
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.audit_log (user_id, user_name, action, entity_id, summary, changes)
    values (auth.uid(), actor, 'delete', old.id,
            jsonb_build_object('lote', old.lot, 'proveedor', old.supplier_name, 'producto', old.product, 'fecha', old.received_at),
            jsonb_build_object('estado', old.status,
                               'inspector', coalesce((select full_name from public.profiles where id = old.inspector_id), '')));
    return old;
  end if;

  o := to_jsonb(old) - 'updated_at';
  n := to_jsonb(new) - 'updated_at';
  for k in select jsonb_object_keys(n) loop
    if o -> k is distinct from n -> k then
      -- la fecha pierde los segundos al guardar desde el formulario: no es un cambio real
      if k = 'received_at' and abs(extract(epoch from (new.received_at - old.received_at))) < 60 then
        continue;
      end if;
      diff := diff || jsonb_build_object(k, jsonb_build_object('de', o -> k, 'a', n -> k));
    end if;
  end loop;
  if diff <> '{}'::jsonb then
    perform public.audit_merge(new.id, 'campos', diff);
  end if;
  return new;
end $$;

create or replace function public.audit_pallet() returns trigger
language plpgsql security definer set search_path = public as $$
declare r public.pallets;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  -- el borrado en cascada de una recepción eliminada no se anota aparte
  if not exists (select 1 from public.receptions where id = r.reception_id) then return r; end if;
  perform public.audit_merge(r.reception_id,
    case when tg_op = 'DELETE' then 'palets_antes' else 'palets_despues' end,
    jsonb_build_array(jsonb_build_object('palet', r.position, 'cajas', r.boxes, 'bruto', r.gross_kg)));
  return r;
end $$;

create or replace function public.audit_defect() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if old.name is not distinct from new.name and old.percent is not distinct from new.percent then return new; end if;
    perform public.audit_merge(new.reception_id, 'defectos_antes', jsonb_build_array(jsonb_build_object('defecto', old.name, 'pct', old.percent)));
    perform public.audit_merge(new.reception_id, 'defectos_despues', jsonb_build_array(jsonb_build_object('defecto', new.name, 'pct', new.percent)));
    return new;
  elsif tg_op = 'INSERT' then
    perform public.audit_merge(new.reception_id, 'defectos_despues', jsonb_build_array(jsonb_build_object('defecto', new.name, 'pct', new.percent)));
    return new;
  end if;
  if not exists (select 1 from public.receptions where id = old.reception_id) then return old; end if;
  perform public.audit_merge(old.reception_id, 'defectos_antes', jsonb_build_array(jsonb_build_object('defecto', old.name, 'pct', old.percent)));
  return old;
end $$;

create or replace function public.audit_photo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.audit_merge(new.reception_id, 'fotos_anadidas', jsonb_build_array(new.kind));
    return new;
  end if;
  if not exists (select 1 from public.receptions where id = old.reception_id) then return old; end if;
  perform public.audit_merge(old.reception_id, 'fotos_eliminadas', jsonb_build_array(old.kind));
  return old;
end $$;

create trigger audit_receptions after insert or update or delete on public.receptions
  for each row execute function public.audit_reception();
create trigger audit_pallets after insert or delete on public.pallets
  for each row execute function public.audit_pallet();
create trigger audit_defects after insert or update or delete on public.defects
  for each row execute function public.audit_defect();
create trigger audit_photos after insert or delete on public.photos
  for each row execute function public.audit_photo();

-- Las funciones solo las ejecutan los triggers: no deben poder llamarse desde la API.
revoke execute on function public.audit_summary(uuid) from public, anon, authenticated;
revoke execute on function public.audit_merge(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.audit_reception() from public, anon, authenticated;
revoke execute on function public.audit_pallet() from public, anon, authenticated;
revoke execute on function public.audit_defect() from public, anon, authenticated;
revoke execute on function public.audit_photo() from public, anon, authenticated;
