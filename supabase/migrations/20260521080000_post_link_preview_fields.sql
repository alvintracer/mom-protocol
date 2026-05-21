-- Add columns for Open Graph link previews
alter table public.posts
add column if not exists link_image_url text,
add column if not exists link_description text;
