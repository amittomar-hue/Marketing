-- ─────────────────────────────────────────────────────────────────
-- Migration 0060: Responsible-AI guardrail logging.
--
-- Captures three classes of events so the admin Safety tab can
-- surface what was caught and why:
--   • input_unsafe     — Llama-Guard flagged the USER message
--   • output_unsafe    — Llama-Guard flagged the ASSISTANT response
--   • prompt_injection — regex/LLM-judge flagged a jailbreak attempt
--   • pii_redacted     — Brand Library upload had PII scrubbed
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS safety_incidents (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id      UUID,
    user_email   TEXT,
    kind         TEXT NOT NULL,              -- 'input_unsafe' | 'output_unsafe' | 'prompt_injection' | 'pii_redacted'
    severity     TEXT NOT NULL DEFAULT 'medium',  -- 'low' | 'medium' | 'high'
    categories   TEXT[] DEFAULT '{}',        -- Llama-Guard category codes (S1..S14) or PII types or injection patterns
    excerpt      TEXT,                       -- ~500 chars of the offending content (truncated)
    action_taken TEXT NOT NULL,              -- 'blocked' | 'sanitized' | 'flagged' | 'redacted'
    model        TEXT,                       -- which model was about to run (for chat events)
    metadata     JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS safety_incidents_occurred_at_idx
    ON safety_incidents (occurred_at DESC);
CREATE INDEX IF NOT EXISTS safety_incidents_kind_idx
    ON safety_incidents (kind, occurred_at DESC);
CREATE INDEX IF NOT EXISTS safety_incidents_user_idx
    ON safety_incidents (user_id, occurred_at DESC);

ALTER TABLE safety_incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_safety" ON safety_incidents;
CREATE POLICY "service_role_all_safety" ON safety_incidents
    FOR ALL USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────
-- Health view for the admin Safety tab header
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_safety_health AS
SELECT
    COUNT(*)                                                           AS total_incidents,
    COUNT(*) FILTER (WHERE occurred_at >= NOW() - INTERVAL '24 hours') AS last_24h,
    COUNT(*) FILTER (WHERE occurred_at >= NOW() - INTERVAL '7 days')   AS last_7d,
    COUNT(*) FILTER (WHERE kind = 'input_unsafe')                      AS input_unsafe,
    COUNT(*) FILTER (WHERE kind = 'output_unsafe')                     AS output_unsafe,
    COUNT(*) FILTER (WHERE kind = 'prompt_injection')                  AS prompt_injection,
    COUNT(*) FILTER (WHERE kind = 'pii_redacted')                      AS pii_redacted,
    COUNT(*) FILTER (WHERE severity = 'high')                          AS high_severity,
    MAX(occurred_at)                                                   AS last_incident_at
FROM safety_incidents;
