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
