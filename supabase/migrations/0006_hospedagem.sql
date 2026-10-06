-- supabase/migrations/0006_hospedagem.sql
-- Hospedagem parceira no roteiro (see docs/superpowers/specs/2026-10-06-hospedagem-parceira-design.md).

-- Lodging contact for reservations. Only meaningful for category 'Hospedagem'.
alter table places add column booking_whatsapp text;
alter table places add column booking_url text;

-- Lodging picked at itinerary creation: {"featured_id": uuid, "alternative_ids": [uuid]}.
-- Null = no lodging card (old itineraries, other quiz answers, no eligible partner).
alter table itineraries add column lodging jsonb;

create index itineraries_lodging_featured_idx on itineraries ((lodging->>'featured_id'));

-- One row per tap on "Consultar disponibilidade" / "Reservar pelo site".
-- No tourist personal data.
create table lodging_leads (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places(id) on delete cascade,
  itinerary_slug text not null,
  channel text not null check (channel in ('whatsapp', 'site')),
  check_in date,
  check_out date,
  guests int,
  created_at timestamptz not null default now()
);

create index lodging_leads_place_created_idx on lodging_leads (place_id, created_at);

-- Same hardening as 0002: no policies, so only the service-role client can touch it.
alter table lodging_leads enable row level security;
