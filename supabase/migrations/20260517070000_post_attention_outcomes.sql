alter table public.posts
add column if not exists selected_outcome text;

create index if not exists posts_attention_outcome_idx
on public.posts(attention_cluster_id, selected_outcome, created_at desc);

comment on column public.posts.selected_outcome is
'Optional attention case/outcome the post is discussing. This is not a wager or paid position.';
