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
