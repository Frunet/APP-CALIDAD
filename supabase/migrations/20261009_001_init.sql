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
