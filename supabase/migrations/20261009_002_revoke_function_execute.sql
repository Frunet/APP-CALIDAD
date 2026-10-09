revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.owns_reception(uuid) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.owns_reception(uuid) to authenticated;
