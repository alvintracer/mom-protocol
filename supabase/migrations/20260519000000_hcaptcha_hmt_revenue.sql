-- =============================================================================
-- hCaptcha Verification Tracking
-- Bot prevention + Trust Score + Smart Captcha decisions
--
-- ⚠️ NOTE: hCaptcha publisher rewards (HMT) were discontinued in 2023.
-- hCaptcha is used purely for bot prevention. No revenue is generated.
-- Platform monetization uses separate channels (AdSense, Brave, etc.)
-- =============================================================================

-- Track every captcha verification for:
-- 1. Smart captcha decisions (risk-based triggering for posts)
-- 2. Bot detection analytics
-- 3. Trust Score: captcha completions count toward Verification Participation
-- 4. Rate limiting and abuse detection
CREATE TABLE IF NOT EXISTS captcha_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action_type TEXT NOT NULL,       -- 'aio_assertion', 'aio_challenge', 'attention_build', 'post_create'
  verified BOOLEAN NOT NULL DEFAULT false,
  ip_hash TEXT,                    -- Hashed IP for rate limiting (not raw IP)
  user_agent_hash TEXT,            -- Hashed UA for bot detection
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for user-level stats and smart captcha decisions
CREATE INDEX IF NOT EXISTS idx_captcha_user_action
  ON captcha_verifications(user_id, action_type, created_at DESC);

-- Index for platform-level analytics
CREATE INDEX IF NOT EXISTS idx_captcha_action_created
  ON captcha_verifications(action_type, created_at DESC);

COMMENT ON TABLE captcha_verifications IS 'Tracks hCaptcha verifications for bot prevention, Trust Score, and Smart Captcha decisions. No revenue — HMT publisher rewards ended 2023.';
