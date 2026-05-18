alter table public.profiles
add column if not exists banner_url text,
add column if not exists social_links jsonb not null default '{}'::jsonb;

comment on column public.profiles.banner_url is
'Public profile background image URL. Can point to Supabase Storage later.';

comment on column public.profiles.social_links is
'Public profile hotlinks keyed by platform, e.g. polymarket, x, reddit, instagram, telegram.';
