-- =============================================================================
-- hCaptcha + HMT Revenue Tracking
-- All hCaptcha earnings flow to the platform wallet (not individual users)
-- Platform converts HMT → platform energy → distributes via Contribution Ratio
-- =============================================================================

-- Track every captcha verification for:
-- 1. HMT revenue attribution per action type
-- 2. Smart captcha decisions (risk-based triggering for posts)
-- 3. Bot detection analytics
-- 4. Contribution Ratio: captcha completions count as verification participation
CREATE TABLE IF NOT EXISTS captcha_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action_type TEXT NOT NULL,       -- 'aio_assertion', 'aio_challenge', 'attention_build', 'post_create'
  hcaptcha_response_token TEXT,    -- hCaptcha token (for audit trail)
  verified BOOLEAN NOT NULL DEFAULT false,
  ip_hash TEXT,                    -- Hashed IP for rate limiting (not raw IP)
  user_agent_hash TEXT,            -- Hashed UA for bot detection
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for user-level stats and smart captcha decisions
CREATE INDEX IF NOT EXISTS idx_captcha_user_action
  ON captcha_verifications(user_id, action_type, created_at DESC);

-- Index for platform-level HMT revenue tracking
CREATE INDEX IF NOT EXISTS idx_captcha_action_created
  ON captcha_verifications(action_type, created_at DESC);

-- Platform HMT revenue ledger
-- Tracks HMT tokens earned from hCaptcha → platform wallet
CREATE TABLE IF NOT EXISTS platform_hmt_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'hcaptcha',        -- 'hcaptcha', 'data_labeling', etc.
  amount_hmt NUMERIC(18,8) NOT NULL DEFAULT 0,
  amount_usd NUMERIC(12,4),                        -- USD equivalent at time of receipt
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  captcha_count INT NOT NULL DEFAULT 0,            -- Number of verifications in this period
  wallet_address TEXT,                              -- Platform wallet that received HMT
  tx_hash TEXT,                                     -- Blockchain transaction hash
  status TEXT NOT NULL DEFAULT 'pending',           -- 'pending', 'received', 'converted', 'distributed'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for revenue reporting
CREATE INDEX IF NOT EXISTS idx_hmt_revenue_period
  ON platform_hmt_revenue(period_start DESC);

COMMENT ON TABLE captcha_verifications IS 'Tracks all hCaptcha verifications across the platform for HMT revenue, bot detection, and contribution scoring';
COMMENT ON TABLE platform_hmt_revenue IS 'Platform-level HMT revenue ledger — all earnings go to platform wallet, then distributed via Contribution Ratio';
