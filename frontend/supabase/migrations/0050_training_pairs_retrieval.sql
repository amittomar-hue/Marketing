-- ─────────────────────────────────────────────────────────────────
-- Migration 0050: make `training_pairs` queryable as the Tuned
-- model's primary knowledge base.
--
-- Context: scrape-intel → convert-pairs writes high-quality, asset-type-
-- aware Q&A pairs into `training_pairs` every 6 hours. Until now the
-- chat route never read from this table, so the Tuned model behaved
-- like plain Groq with thumbs-up retrieval. This migration adds the
-- index + RPC needed to use training_pairs as Tuned's primary signal.
-- ─────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram index for fast similarity search on the instruction text
CREATE INDEX IF NOT EXISTS training_pairs_instruction_trgm_idx
    ON training_pairs USING gin (instruction gin_trgm_ops);

CREATE INDEX IF NOT EXISTS training_pairs_intent_quality_idx
    ON training_pairs (intent, quality DESC);

CREATE INDEX IF NOT EXISTS training_pairs_asset_type_idx
    ON training_pairs (asset_type);

-- ─────────────────────────────────────────────────────────────────
-- RPC: retrieve_training_pairs_for_chat
-- Returns the top-N training pairs most similar to the user's query,
-- with intent match as a tie-breaker, ranked by a composite score:
--   similarity(instruction, query) * 0.65
-- + intent_match * 0.25
-- + (quality - 0.5) * 0.10
-- Quality floor: 0.7 (excludes anything explicitly down-rated).
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION retrieve_training_pairs_for_chat(
    p_query TEXT,
    p_intent TEXT DEFAULT NULL,
    p_limit INT DEFAULT 5,
    p_min_quality NUMERIC DEFAULT 0.7
)
RETURNS TABLE (
    id UUID,
    intent TEXT,
    asset_type TEXT,
    instruction TEXT,
    output TEXT,
    source_url TEXT,
    source_title TEXT,
    similarity REAL,
    composite_score REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT
        tp.id,
        tp.intent,
        COALESCE(tp.asset_type, 'article') AS asset_type,
        tp.instruction,
        tp.output,
        tp.source_url,
        tp.source_title,
        similarity(tp.instruction, p_query)::REAL AS similarity,
        (
            similarity(tp.instruction, p_query) * 0.65
            + CASE WHEN tp.intent = p_intent THEN 0.25 ELSE 0 END
            + (COALESCE(tp.quality, 1.0) - 0.5) * 0.10
        )::REAL AS composite_score
    FROM training_pairs tp
    WHERE
        COALESCE(tp.quality, 1.0) >= p_min_quality
        AND length(tp.instruction) > 10
        AND length(tp.output) > 80
        AND similarity(tp.instruction, p_query) > 0.08
    ORDER BY composite_score DESC, similarity DESC
    LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION retrieve_training_pairs_for_chat TO authenticated, anon, service_role;

-- ─────────────────────────────────────────────────────────────────
-- View: training_pairs_health — surfaces the breadth/depth of the
-- knowledge base for the admin dashboard.
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_training_pairs_health AS
SELECT
    COUNT(*) AS total_pairs,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')  AS pairs_last_7d,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS pairs_last_24h,
    COUNT(DISTINCT intent) AS intents_covered,
    COUNT(DISTINCT asset_type) AS asset_types_covered,
    AVG(quality)::NUMERIC(4,2) AS avg_quality
FROM training_pairs;
