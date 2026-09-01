-- supabase/migrations/0002_enable_rls.sql
-- Hardening: enable Row Level Security on every table with no policies.
--
-- The app only ever talks to Supabase through the service-role client
-- (see src/lib/supabase/client.ts, getSupabaseAdminClient), which bypasses
-- RLS regardless of policies, so this has no behavior impact on the app.
-- Without this, Supabase's default anon/authenticated grants on the public
-- schema let anyone with the project's public anon key read AND write these
-- tables directly via PostgREST, bypassing the app entirely.
alter table places enable row level security;
alter table events enable row level security;
alter table sos_places enable row level security;
alter table itineraries enable row level security;
