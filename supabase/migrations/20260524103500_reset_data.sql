-- =============================================
-- FULL DATA RESET: Attentions + Posts + AIO + Events
-- Preserves: profiles, wallets, payments, ad_slots, platform config
-- =============================================

BEGIN;

-- 1. AIO Oracle data (child → parent)
TRUNCATE public.aio_llm_verifications CASCADE;
TRUNCATE public.aio_evidence_items CASCADE;
TRUNCATE public.aio_assertions CASCADE;

-- 2. Comments & reactions (child → parent)
TRUNCATE public.comment_translations CASCADE;
TRUNCATE public.comments CASCADE;
TRUNCATE public.post_reactions CASCADE;
TRUNCATE public.post_unlocks CASCADE;
TRUNCATE public.post_translations CASCADE;

-- 3. Posts
TRUNCATE public.posts CASCADE;

-- 4. Bookmarks (references posts & attentions)
TRUNCATE public.bookmarks CASCADE;

-- 5. Attention data (child → parent)
TRUNCATE public.content_topics CASCADE;
TRUNCATE public.topic_trend_snapshots CASCADE;
TRUNCATE public.attention_memberships CASCADE;
TRUNCATE public.attention_sponsorships CASCADE;
TRUNCATE public.attention_sources CASCADE;

-- 6. Attention rules (references events)
TRUNCATE public.attention_rules CASCADE;

-- 7. Attention clusters
TRUNCATE public.attention_clusters CASCADE;

-- 8. Events
TRUNCATE public.events CASCADE;

-- 9. Translation jobs (orphaned references)
DELETE FROM public.translation_jobs
WHERE content_type IN ('event', 'post', 'comment');

COMMIT;
