-- Migration consolidada e idempotente da ElDorado Barbershop.
-- Executar no SQL Editor do Supabase antes da publicação.
-- IMPORTANTE: configurar SUPABASE_SERVICE_ROLE_KEY no backend antes de ativar RLS.

begin;

create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

alter table public.bookings
  add column if not exists status varchar(20) not null default 'confirmed';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_status_check'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_status_check
      check (status in ('confirmed', 'cancelled', 'completed', 'no_show'));
  end if;
end $$;

-- Converte instalações antigas que guardavam datas como texto.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bookings'
      and column_name = 'starts_at' and data_type in ('character varying', 'text')
  ) then
    alter table public.bookings
      alter column starts_at type timestamp without time zone
      using starts_at::timestamp;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bookings'
      and column_name = 'ends_at' and data_type in ('character varying', 'text')
  ) then
    alter table public.bookings
      alter column ends_at type timestamp without time zone
      using ends_at::timestamp;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_valid_time_range'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_valid_time_range
      check (ends_at > starts_at);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_no_overlapping_appointments'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_no_overlapping_appointments
      exclude using gist (
        barber_id with =,
        tsrange(starts_at, ends_at, '[)') with &&
      )
      where (status <> 'cancelled');
  end if;
end $$;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) not null,
  category varchar(100),
  description text,
  price numeric(8,2) not null check (price >= 0),
  image_url text,
  active boolean not null default true,
  created_at timestamp default now()
);

alter table public.products add column if not exists category varchar(100);
update public.products set category = 'Styling' where category is null;
alter table public.products alter column category set not null;

-- Todos os membros da equipa são barbeiros; função deixou de ser utilizada.
alter table public.barbers drop column if exists role;

create index if not exists idx_bookings_barber_id on public.bookings(barber_id);
create index if not exists idx_bookings_service_id on public.bookings(service_id);
create index if not exists idx_bookings_starts_at on public.bookings(starts_at);
create index if not exists idx_bookings_barber_starts on public.bookings(barber_id, starts_at);
create index if not exists idx_products_active_created on public.products(active, created_at desc);

-- Impede acesso direto pelas chaves públicas do Supabase. O backend utiliza
-- exclusivamente a service role key e continua a ter acesso às tabelas.
alter table public.barbers enable row level security;
alter table public.services enable row level security;
alter table public.bookings enable row level security;
alter table public.products enable row level security;

revoke all on table public.barbers from anon, authenticated;
revoke all on table public.services from anon, authenticated;
revoke all on table public.bookings from anon, authenticated;
revoke all on table public.products from anon, authenticated;

commit;
