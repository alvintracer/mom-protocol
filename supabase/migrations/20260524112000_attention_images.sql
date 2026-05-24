-- Add avatar and cover image URLs to attention_clusters
ALTER TABLE public.attention_clusters
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS cover_url text;
