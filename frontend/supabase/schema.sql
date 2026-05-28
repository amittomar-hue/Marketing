-- Marketing LLM — Pragmatic RLMO schema v1
-- Run this in your Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ─────────────────────────────────────────────
-- Every assistant message generated
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interactions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_query      TEXT NOT NULL,
    intent          TEXT,                 -- ad_copy | trend | email | strategy | competitor | brand_voice | general
    response        TEXT NOT NULL,
    model           TEXT NOT NULL,
    web_search_used BOOLEAN DEFAULT FALSE,
    session_id      TEXT,                 -- browser-side conversation id
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS interactions_intent_idx ON interactions (intent);
CREATE INDEX IF NOT EXISTS interactions_created_idx ON interactions (created_at DESC);
CREATE INDEX IF NOT EXISTS interactions_query_trgm_idx ON interactions USING gin (user_query gin_trgm_ops);

-- ─────────────────────────────────────────────
-- User feedback (RLMO reward signal)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedbacks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interaction_id  UUID NOT NULL REFERENCES interactions(id) ON DELETE CASCADE,
    rating          SMALLINT NOT NULL,    -- +1 thumbs up, -1 thumbs down, 0 neutral
    user_edit       TEXT,                 -- user's edited/corrected version (preference signal)
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feedbacks_interaction_idx ON feedbacks (interaction_id);

-- ─────────────────────────────────────────────
-- Curated learning examples (auto-promoted from high-rated interactions)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS learning_examples (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interaction_id  UUID UNIQUE REFERENCES interactions(id) ON DELETE SET NULL,
    intent          TEXT NOT NULL,
    query_summary   TEXT NOT NULL,        -- short paraphrase for retrieval
    exemplar_response TEXT NOT NULL,      -- the response to inject as few-shot
    score           NUMERIC(4,2) NOT NULL DEFAULT 1.0,
    usage_count     INT NOT NULL DEFAULT 0,
    last_used_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS learning_examples_intent_score_idx
    ON learning_examples (intent, score DESC);
CREATE INDEX IF NOT EXISTS learning_examples_query_trgm_idx
    ON learning_examples USING gin (query_summary gin_trgm_ops);

-- ─────────────────────────────────────────────
-- Aggregated insights (weekly cron writes here)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS learning_insights (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_start    TIMESTAMPTZ NOT NULL,
    period_end      TIMESTAMPTZ NOT NULL,
    intent          TEXT,
    pattern         TEXT NOT NULL,        -- e.g. "headlines with numbers score +18%"
    sample_size     INT NOT NULL,
    confidence      NUMERIC(4,3) NOT NULL,
    applied         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- RLS — allow service role full access (we use service role from server only)
-- ─────────────────────────────────────────────
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_interactions" ON interactions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_feedbacks" ON feedbacks FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_examples" ON learning_examples FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_insights" ON learning_insights FOR ALL USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────
-- RPC: top-rated interactions per intent (used by weekly cron)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_top_rated_interactions(
    p_intent TEXT,
    p_since  TIMESTAMPTZ,
    p_limit  INT DEFAULT 3
)
RETURNS TABLE (
    id          UUID,
    user_query  TEXT,
    response    TEXT,
    avg_rating  NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT i.id, i.user_query, i.response, COALESCE(AVG(f.rating), 0)::NUMERIC AS avg_rating
    FROM interactions i
    LEFT JOIN feedbacks f ON f.interaction_id = i.id
    WHERE i.intent = p_intent
      AND i.created_at >= p_since
    GROUP BY i.id
    HAVING COALESCE(AVG(f.rating), 0) > 0
    ORDER BY avg_rating DESC, i.created_at DESC
    LIMIT p_limit;
$$;
