alter table public.posts
add column if not exists link_title text,
add column if not exists link_url text,
add column if not exists media_items jsonb not null default '[]'::jsonb;

create index if not exists posts_link_url_idx
on public.posts(link_url)
where link_url is not null;

comment on column public.posts.original_title is
'Required user-facing post title for rich post creation. Existing lightweight posts may leave it null.';

comment on column public.posts.media_items is
'Client-selected image/audio attachment metadata for MVP. Actual storage upload can be added later.';
