-- RLS already limits country creation to System Admin. The Data API role also
-- needs table-level INSERT before that policy can be evaluated.
grant insert on table public.countries to authenticated;
