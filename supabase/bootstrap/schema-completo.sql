-- Quality Control · esquema completo (12 migraciones en orden).
-- Para un proyecto de Supabase NUEVO y VACÍO: pegar todo en SQL Editor y pulsar Run.
-- Generado a partir de supabase/migrations/*.sql. No ejecutar dos veces.


-- ======================================================================
-- 20261009_001_init.sql
-- ======================================================================
-- FrutaCheck QA · esquema inicial

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'inspector' check (role in ('inspector','admin')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active);
$$;

-- El primer usuario registrado es administrador; el resto, inspectores.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''),
          case when exists (select 1 from public.profiles) then 'inspector' else 'admin' end);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.agreements (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  product text not null check (product in ('Piña','Mango','Aguacate')),
  format text not null default '',
  boxes_per_pallet integer not null default 80 check (boxes_per_pallet >= 0),
  min_kg_box numeric(8,3) not null default 0 check (min_kg_box >= 0),
  tare_box numeric(8,3) not null default 0 check (tare_box >= 0),
  tare_pallet numeric(8,3) not null default 0 check (tare_pallet >= 0),
  tare_other numeric(8,3) not null default 0 check (tare_other >= 0),
  created_at timestamptz not null default now(),
  unique (supplier_id, product, format)
);

create table public.receptions (
  id uuid primary key default gen_random_uuid(),
  inspector_id uuid not null default auth.uid() references public.profiles(id),
  received_at timestamptz not null default now(),
  product text not null check (product in ('Piña','Mango','Aguacate')),
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_name text not null default '',
  lot text not null default '',
  origin text not null default '',
  truck text not null default '',
  format text not null default '',
  boxes_per_pallet integer not null default 80,
  min_kg_box numeric(8,3) not null default 0,
  tare_box numeric(8,3) not null default 0,
  tare_pallet numeric(8,3) not null default 0,
  tare_other numeric(8,3) not null default 0,
  temperature numeric(5,1),
  firmness text not null default '',
  brix numeric(5,1),
  lab_ref text not null default '',
  dry_matter numeric(5,1),
  notes text not null default '',
  status text not null default 'draft' check (status in ('draft','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.receptions (inspector_id, received_at desc);
create index on public.receptions (received_at desc);
create index on public.receptions (supplier_id);

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$ begin new.updated_at = now(); return new; end $$;
create trigger receptions_touch before update on public.receptions
  for each row execute function public.touch_updated_at();

create table public.pallets (
  id uuid primary key default gen_random_uuid(),
  reception_id uuid not null references public.receptions(id) on delete cascade,
  position integer not null,
  boxes integer not null default 0,
  gross_kg numeric(10,2),
  unique (reception_id, position)
);

create table public.defects (
  id uuid primary key default gen_random_uuid(),
  reception_id uuid not null references public.receptions(id) on delete cascade,
  name text not null default '',
  percent numeric(5,2) check (percent is null or (percent >= 0 and percent <= 100))
);
create index on public.defects (reception_id);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  reception_id uuid not null references public.receptions(id) on delete cascade,
  defect_id uuid references public.defects(id) on delete cascade,
  kind text not null check (kind in ('label','pallet','cut','defect')),
  storage_path text not null,
  created_at timestamptz not null default now()
);
create index on public.photos (reception_id);
create index on public.photos (defect_id);

create or replace function public.owns_reception(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.receptions r
    where r.id = rid and (r.inspector_id = auth.uid() or public.is_admin()));
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.suppliers enable row level security;
alter table public.agreements enable row level security;
alter table public.receptions enable row level security;
alter table public.pallets enable row level security;
alter table public.defects enable row level security;
alter table public.photos enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid())
    and role = (select p.role from public.profiles p where p.id = (select auth.uid())) and active);

create policy suppliers_select on public.suppliers for select to authenticated using (true);
create policy suppliers_write on public.suppliers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy agreements_select on public.agreements for select to authenticated using (true);
create policy agreements_write on public.agreements for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy receptions_select on public.receptions for select to authenticated
  using (inspector_id = (select auth.uid()) or public.is_admin());
create policy receptions_insert on public.receptions for insert to authenticated
  with check (inspector_id = (select auth.uid()));
create policy receptions_update on public.receptions for update to authenticated
  using (inspector_id = (select auth.uid()) or public.is_admin())
  with check (inspector_id = (select auth.uid()) or public.is_admin());
create policy receptions_delete on public.receptions for delete to authenticated
  using (inspector_id = (select auth.uid()) or public.is_admin());

create policy pallets_all on public.pallets for all to authenticated
  using (public.owns_reception(reception_id)) with check (public.owns_reception(reception_id));
create policy defects_all on public.defects for all to authenticated
  using (public.owns_reception(reception_id)) with check (public.owns_reception(reception_id));
create policy photos_all on public.photos for all to authenticated
  using (public.owns_reception(reception_id)) with check (public.owns_reception(reception_id));

-- Storage: bucket privado, ruta {reception_id}/{archivo}
insert into storage.buckets (id, name, public) values ('reception-photos','reception-photos',false)
  on conflict (id) do nothing;

create policy photos_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'reception-photos' and public.owns_reception(((storage.foldername(name))[1])::uuid));
create policy photos_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'reception-photos' and public.owns_reception(((storage.foldername(name))[1])::uuid));
create policy photos_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'reception-photos' and public.owns_reception(((storage.foldername(name))[1])::uuid));


-- ======================================================================
-- 20261009_002_revoke_function_execute.sql
-- ======================================================================
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.owns_reception(uuid) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.owns_reception(uuid) to authenticated;


-- ======================================================================
-- 20261009_003_fix_profiles_self_update_recursion.sql
-- ======================================================================
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;
revoke execute on function public.my_role() from public, anon;
grant execute on function public.my_role() to authenticated;

drop policy profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and role = public.my_role() and active);


-- ======================================================================
-- 20261009_004_masters.sql
-- ======================================================================
-- Maestros: productos, calibres y proveedores gestionables por el administrador.

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  has_dry_matter boolean not null default false, -- pide materia seca de laboratorio (aguacate)
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.calibers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (product_id, name)
);
create index on public.calibers (product_id);

alter table public.suppliers add column active boolean not null default true;

insert into public.products (name, has_dry_matter) values ('Piña', false), ('Mango', false), ('Aguacate', true);

-- Recepciones: ya no hay lista fija de productos; se guardan la referencia y el nombre (histórico).
alter table public.receptions drop constraint receptions_product_check;
alter table public.receptions
  add column product_id uuid references public.products(id) on delete restrict,
  add column caliber_id uuid references public.calibers(id) on delete restrict,
  add column caliber text not null default '';
update public.receptions r set product_id = p.id from public.products p where p.name = r.product;
create index on public.receptions (product_id);

-- Acuerdos: pasan a referenciar el producto maestro.
alter table public.agreements add column product_id uuid references public.products(id) on delete cascade;
update public.agreements a set product_id = p.id from public.products p where p.name = a.product;
alter table public.agreements alter column product_id set not null;
alter table public.agreements drop column product; -- elimina también el unique anterior
alter table public.agreements add constraint agreements_supplier_product_format_key unique (supplier_id, product_id, format);
create index on public.agreements (product_id);

alter table public.products enable row level security;
alter table public.calibers enable row level security;

create policy products_select on public.products for select to authenticated using (true);
create policy products_write on public.products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy calibers_select on public.calibers for select to authenticated using (true);
create policy calibers_write on public.calibers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());


-- ======================================================================
-- 20261009_005_role_calidad.sql
-- ======================================================================
-- Rol "calidad": ve el historial y los informes de TODAS las recepciones (solo lectura),
-- sin administrar maestros, especificaciones ni usuarios.

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('inspector','calidad','admin'));

create or replace function public.is_reviewer() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
    where id = auth.uid() and role in ('admin','calidad') and active);
$$;
revoke execute on function public.is_reviewer() from public, anon;
grant execute on function public.is_reviewer() to authenticated;

create policy profiles_select_reviewer on public.profiles for select to authenticated
  using (public.is_reviewer());
create policy receptions_select_reviewer on public.receptions for select to authenticated
  using (public.is_reviewer());
create policy pallets_select_reviewer on public.pallets for select to authenticated
  using (public.is_reviewer());
create policy defects_select_reviewer on public.defects for select to authenticated
  using (public.is_reviewer());
create policy photos_select_reviewer on public.photos for select to authenticated
  using (public.is_reviewer());
create policy photos_storage_select_reviewer on storage.objects for select to authenticated
  using (bucket_id = 'reception-photos' and public.is_reviewer());

update public.profiles set role = 'calidad'
  where id = (select id from auth.users where email = 'calidad@frutacheck.test');


-- ======================================================================
-- 20261009_006_reviewers_can_edit.sql
-- ======================================================================
-- Administrador y Calidad pueden modificar y eliminar cualquier recepción (módulo Historial).
-- Los inspectores siguen limitados a las suyas.

create or replace function public.owns_reception(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.receptions r
    where r.id = rid and (r.inspector_id = auth.uid() or public.is_reviewer()));
$$;

drop policy receptions_update on public.receptions;
create policy receptions_update on public.receptions for update to authenticated
  using (inspector_id = (select auth.uid()) or public.is_reviewer())
  with check (inspector_id = (select auth.uid()) or public.is_reviewer());

drop policy receptions_delete on public.receptions;
create policy receptions_delete on public.receptions for delete to authenticated
  using (inspector_id = (select auth.uid()) or public.is_reviewer());


-- ======================================================================
-- 20261021_007_defect_types_origin_photos.sql
-- ======================================================================
-- Lista de defectos (maestro) y fotos del palet de origen.

create table public.defect_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.defect_types enable row level security;
create policy defect_types_select on public.defect_types for select to authenticated using (true);
create policy defect_types_write on public.defect_types for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

insert into public.defect_types (name) values
  ('Deshidratación'), ('Pudrición'), ('Golpes'), ('Verde'), ('Arañazos'), ('Otros');

-- El defecto conserva el nombre (histórico) y la referencia al maestro.
alter table public.defects add column defect_type_id uuid references public.defect_types(id) on delete restrict;
update public.defects d set defect_type_id = t.id from public.defect_types t where lower(t.name) = lower(d.name);
create index on public.defects (defect_type_id);

-- Fotos del palet de origen: kind 'origin' + posición del palet.
alter table public.photos drop constraint photos_kind_check;
alter table public.photos add constraint photos_kind_check check (kind in ('label','pallet','cut','defect','origin'));
alter table public.photos add column pallet_position integer;


-- ======================================================================
-- 20261021_008_audit_log.sql
-- ======================================================================
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


-- ======================================================================
-- 20261021_009_audit_window.sql
-- ======================================================================
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


-- ======================================================================
-- 20261021_010_spec_limits_decision.sql
-- ======================================================================
-- Límites de calidad por especificación, evaluación guardada en cada recepción y decisión final de Calidad.

-- Límites de la especificación (todos opcionales: sin valor = no se comprueba).
alter table public.agreements
  add column max_temperature numeric(5,1) check (max_temperature is null or max_temperature >= -30),
  add column min_brix numeric(5,1) check (min_brix is null or min_brix >= 0),
  add column max_defect_pct numeric(5,2) check (max_defect_pct is null or (max_defect_pct >= 0 and max_defect_pct <= 100)),
  add column min_dry_matter numeric(5,1) check (min_dry_matter is null or min_dry_matter >= 0),
  add column max_transport_temp numeric(5,1) check (max_transport_temp is null or max_transport_temp >= -30);

-- La recepción guarda los límites con que se evaluó (si la especificación cambia luego, no cambia el pasado),
-- el resultado propuesto por las reglas y la decisión final.
alter table public.receptions
  add column limit_max_temperature numeric(5,1),
  add column limit_min_brix numeric(5,1),
  add column limit_max_defect_pct numeric(5,2),
  add column limit_min_dry_matter numeric(5,1),
  add column limit_max_transport_temp numeric(5,1),
  add column breaches integer not null default 0,
  add column auto_result text check (auto_result in ('accepted', 'reserves', 'rejected')),
  add column decision text check (decision in ('accepted', 'reserves', 'rejected')),
  add column decision_note text not null default '',
  add column decided_by uuid references public.profiles(id) on delete set null,
  add column decided_at timestamptz;
create index on public.receptions (auto_result);

-- Solo Calidad y el administrador pueden fijar o cambiar la decisión final.
create or replace function public.guard_decision() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if (new.decision is not null or new.decision_note <> '') and not public.is_reviewer() then
      raise exception 'Solo Calidad o el administrador pueden decidir el resultado' using errcode = '42501';
    end if;
  elsif (new.decision is distinct from old.decision or new.decision_note is distinct from old.decision_note)
        and not public.is_reviewer() then
    raise exception 'Solo Calidad o el administrador pueden decidir el resultado' using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function public.guard_decision() from public, anon, authenticated;

create trigger receptions_guard_decision before insert or update on public.receptions
  for each row execute function public.guard_decision();


-- ======================================================================
-- 20261021_011_thermographs.sql
-- ======================================================================
-- Termógrafo del transporte: archivos (CSV, TXT, Excel, PDF) con las lecturas calculadas, y fotos.

create table public.thermographs (
  id uuid primary key default gen_random_uuid(),
  reception_id uuid not null references public.receptions(id) on delete cascade,
  file_name text not null,
  file_size integer,
  storage_path text, -- el archivo original se guarda en el bucket reception-photos
  column_label text not null default '', -- columna de temperatura que se leyó
  n_readings integer,
  min_temp numeric(6,2),
  max_temp numeric(6,2),
  avg_temp numeric(6,2),
  started_at text not null default '',
  ended_at text not null default '',
  series jsonb not null default '[]', -- lecturas reducidas (máx. ~120) para dibujar la gráfica
  created_at timestamptz not null default now()
);
create index on public.thermographs (reception_id);

alter table public.thermographs enable row level security;
create policy thermographs_all on public.thermographs for all to authenticated
  using (public.owns_reception(reception_id)) with check (public.owns_reception(reception_id));
create policy thermographs_select_reviewer on public.thermographs for select to authenticated
  using (public.is_reviewer());

-- Resumen en la propia recepción (para Excel, estadísticas y alertas).
alter table public.receptions
  add column transport_min numeric(6,2),
  add column transport_max numeric(6,2),
  add column transport_avg numeric(6,2);

-- Fotos del termógrafo.
alter table public.photos drop constraint photos_kind_check;
alter table public.photos add constraint photos_kind_check
  check (kind in ('label', 'pallet', 'cut', 'defect', 'origin', 'thermo'));

-- Registro de cambios: archivos de termógrafo añadidos o eliminados.
create or replace function public.audit_thermograph() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.audit_merge(new.reception_id, 'termografos_anadidos', jsonb_build_array(new.file_name));
    return new;
  end if;
  if not exists (select 1 from public.receptions where id = old.reception_id) then return old; end if;
  perform public.audit_merge(old.reception_id, 'termografos_eliminados', jsonb_build_array(old.file_name));
  return old;
end $$;
revoke execute on function public.audit_thermograph() from public, anon, authenticated;

create trigger audit_thermographs after insert or delete on public.thermographs
  for each row execute function public.audit_thermograph();


-- ======================================================================
-- 20261022_012_origins.sql
-- ======================================================================
-- Orígenes (país / zona) como maestro, para elegirlos de una lista desplegable.

create table public.origins (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.origins enable row level security;
create policy origins_select on public.origins for select to authenticated using (true);
create policy origins_write on public.origins for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Lista inicial de ejemplo: el administrador la ajusta en Maestros → Orígenes.
insert into public.origins (name) values
  ('Costa Rica'), ('Perú'), ('Colombia'), ('Ecuador'), ('México'), ('Brasil'),
  ('República Dominicana'), ('Chile'), ('Ghana'), ('Costa de Marfil'), ('España');

-- La recepción guarda la referencia y el nombre (histórico), igual que el resto de maestros.
alter table public.receptions add column origin_id uuid references public.origins(id) on delete restrict;
update public.receptions r set origin_id = o.id from public.origins o where lower(o.name) = lower(r.origin);
create index on public.receptions (origin_id);

