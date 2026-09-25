-- supabase/migrations/0004_add_establishment_signup_fields.sql
alter table places add column contact_name text;
alter table places add column contact_email text;
alter table places add column contact_phone text;
alter table places add column submission_source text not null default 'admin';
