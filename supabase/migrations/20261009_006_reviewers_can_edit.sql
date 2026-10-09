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
