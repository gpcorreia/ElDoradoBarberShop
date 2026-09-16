create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

create table barbers (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) not null,
  photo_url text,
  created_at timestamp default now()
);

create table services (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) not null,
  description text,
  price numeric(8,2) not null,
  duration_minutes int not null,
  created_at timestamp default now()
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references barbers(id) on delete restrict,
  service_id uuid not null references services(id) on delete restrict,
  customer_name varchar(100) not null,
  customer_email varchar(150),
  customer_phone varchar(20),
  starts_at timestamp not null,
  ends_at timestamp not null,
  status varchar(20) not null default 'confirmed'
    check (status in ('confirmed', 'cancelled', 'completed', 'no_show')),
  constraint bookings_valid_time_range check (ends_at > starts_at),
  created_at timestamp default now()
);

create index idx_bookings_barber_id on bookings(barber_id);
create index idx_bookings_service_id on bookings(service_id);
create index idx_bookings_starts_at on bookings(starts_at);
create index idx_bookings_barber_starts on bookings(barber_id, starts_at);

alter table bookings
  add constraint bookings_no_overlapping_appointments
  exclude using gist (
    barber_id with =,
    tsrange(starts_at, ends_at, '[)') with &&
  )
  where (status <> 'cancelled');

create table products (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) not null,
  category varchar(100) not null,
  description text not null,
  price numeric(8,2) not null check (price >= 0),
  image_url text not null,
  active boolean not null default true,
  created_at timestamp default now()
);

insert into barbers (name, photo_url)
values
(
  'Miguel Santos',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e'
),
(
  'Rui Costa',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d'
),
(
  'Diogo Ferreira',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d'
);

insert into services (name, description, price, duration_minutes)
values
(
  'Corte Classico',
  'Corte profissional personalizado.',
  8.00,
  30
),
(
  'Corte Degrade',
  'Corte profissional personalizado moderno.',
  14.00,
  30
),
(
  'Barba',
  'Aparar e definir a barba.',
  10.00,
  30
),
(
  'Corte + Barba',
  'Serviço completo de corte e barba.',
  22.50,
  60
)
;
