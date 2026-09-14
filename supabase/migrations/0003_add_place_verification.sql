-- supabase/migrations/0003_add_place_verification.sql
alter table places add column is_verified boolean not null default true;
