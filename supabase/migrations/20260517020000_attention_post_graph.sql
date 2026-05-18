alter table public.posts
add column if not exists attention_cluster_id uuid references public.attention_clusters(id) on delete set null,
add column if not exists parent_post_id uuid references public.posts(id) on delete set null,
add column if not exists repost_of_post_id uuid references public.posts(id) on delete set null,
add column if not exists post_kind text not null default 'post'
  check (post_kind in ('post', 'reply', 'repost', 'quote'));

create index if not exists posts_attention_created_at_idx
on public.posts(attention_cluster_id, created_at desc);

create index if not exists posts_parent_post_created_at_idx
on public.posts(parent_post_id, created_at asc);

create index if not exists posts_repost_of_post_created_at_idx
on public.posts(repost_of_post_id, created_at desc);

comment on column public.posts.attention_cluster_id is
'Primary a/ attention community this post belongs to. Null means global/free post.';

comment on column public.posts.parent_post_id is
'Post-level reply/thread parent. Comments remain lightweight replies under posts.';

comment on column public.posts.repost_of_post_id is
'Original post being reposted or quote-posted.';

comment on column public.posts.post_kind is
'Post graph kind: post, reply, repost, quote.';
