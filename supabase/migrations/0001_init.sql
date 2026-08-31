-- supabase/migrations/0001_init.sql
create extension if not exists "pgcrypto";

create table places (
  id uuid primary key default gen_random_uuid(),
  region text not null,
  neighborhood text not null,
  name text not null,
  category text not null,
  target_profiles text[] not null default '{}',
  price_range text not null check (price_range in ('Gratuito','R$','R$$','R$$$')),
  point_type text not null,
  short_description text not null default '',
  address text not null default '',
  opening_hours text,
  phone text,
  instagram text,
  notes text,
  google_place_id text,
  lat double precision,
  lng double precision,
  rating double precision,
  photos text[] not null default '{}',
  is_partner boolean not null default false,
  partner_plan text,
  partner_offer text,
  partner_status text,
  special_needs_tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_month int not null check (start_month between 1 and 12),
  end_month int not null check (end_month between 1 and 12),
  location text not null default '',
  target_profiles text[] not null default '{}',
  is_free text not null default 'Não',
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create table sos_places (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('saude','veiculo','seguranca','financeiro')),
  tag text not null check (tag in ('publico','parceiro')),
  name text not null,
  meta text not null default '',
  lat double precision,
  lng double precision,
  phone text,
  created_at timestamptz not null default now()
);

create table itineraries (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  quiz_answers jsonb not null,
  welcome_message text not null,
  days jsonb not null,
  created_at timestamptz not null default now()
);

create index places_category_idx on places (category);
create index places_is_partner_idx on places (is_partner);
create index events_active_idx on events (active);
create index itineraries_slug_idx on itineraries (slug);
