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
