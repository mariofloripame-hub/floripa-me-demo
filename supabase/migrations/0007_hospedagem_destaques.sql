-- supabase/migrations/0007_hospedagem_destaques.sql
-- Short highlights shown over the lodging photo in the "Onde ficar" card
-- (e.g. {"🌊 Vista para o mar","☕ Café da manhã"}). Only used for category 'Hospedagem'.
alter table places add column highlights text[];
