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
