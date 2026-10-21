-- Límites de calidad por especificación, evaluación guardada en cada recepción y decisión final de Calidad.

-- Límites de la especificación (todos opcionales: sin valor = no se comprueba).
alter table public.agreements
  add column max_temperature numeric(5,1) check (max_temperature is null or max_temperature >= -30),
  add column min_brix numeric(5,1) check (min_brix is null or min_brix >= 0),
  add column max_defect_pct numeric(5,2) check (max_defect_pct is null or (max_defect_pct >= 0 and max_defect_pct <= 100)),
  add column min_dry_matter numeric(5,1) check (min_dry_matter is null or min_dry_matter >= 0);

-- La recepción guarda los límites con que se evaluó (si la especificación cambia luego, no cambia el pasado),
-- el resultado propuesto por las reglas y la decisión final.
alter table public.receptions
  add column limit_max_temperature numeric(5,1),
  add column limit_min_brix numeric(5,1),
  add column limit_max_defect_pct numeric(5,2),
  add column limit_min_dry_matter numeric(5,1),
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
