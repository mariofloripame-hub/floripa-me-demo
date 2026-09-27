-- supabase/migrations/0005_checkin_cortesia.sql
-- Check-in por cortesia + Portal do Parceiro (Fase 1).

-- Partner-submitted offer waiting for founder approval. `pending_offer_submitted_at`
-- being non-null is what marks "there is a pending submission"; an empty
-- `pending_offer` with a timestamp means "the partner asked to remove the offer".
alter table places add column pending_offer text;
alter table places add column pending_offer_submitted_at timestamptz;

create table courtesy_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  place_id uuid not null references places(id) on delete cascade,
  itinerary_id uuid references itineraries(id) on delete set null,
  device_id text not null,
  offer_text text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by uuid
);

create index courtesy_codes_place_redeemed_idx on courtesy_codes (place_id, redeemed_at);
create index courtesy_codes_device_place_idx on courtesy_codes (device_id, place_id, created_at);

-- Same hardening as 0002: no policies, so only the service-role client can touch it.
alter table courtesy_codes enable row level security;

-- Roteiros that currently contain the place (activities carry `place_id` inside
-- the `days` JSON). Uses the itinerary's current state: a place the tourist
-- swapped out no longer counts.
create or replace function itineraries_with_place(p_place_id uuid, p_since timestamptz)
returns table (id uuid, created_at timestamptz, quiz_answers jsonb)
language sql
stable
as $$
  select i.id, i.created_at, i.quiz_answers
  from itineraries i
  where i.created_at >= p_since
    and jsonb_path_exists(
      i.days,
      '$[*].activities[*] ? (@.place_id == $pid)',
      jsonb_build_object('pid', p_place_id::text)
    )
  order by i.created_at desc;
$$;

-- Functions are executable by PUBLIC by default; keep this one server-only.
revoke execute on function itineraries_with_place(uuid, timestamptz) from public, anon, authenticated;
grant execute on function itineraries_with_place(uuid, timestamptz) to service_role;
