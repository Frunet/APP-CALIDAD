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
