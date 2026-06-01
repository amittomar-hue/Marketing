-- ─────────────────────────────────────────────────────────────────
-- Migration 0070: WizardLM-style evol-instruct for training_pairs.
--
-- After the initial pair is generated from a scraped artifact, the
-- converter runs 3 evolution passes (more-specific, more-tactical,
-- more-strategic) and stores each variant as a new training_pair
-- linked back to the parent via parent_pair_id. The is_evolved
-- column lets the admin tab show what % of the corpus is augmented.
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE training_pairs
    ADD COLUMN IF NOT EXISTS is_evolved BOOLEAN DEFAULT FALSE;

ALTER TABLE training_pairs
    ADD COLUMN IF NOT EXISTS parent_pair_id UUID
    REFERENCES training_pairs(id) ON DELETE SET NULL;

ALTER TABLE training_pairs
    ADD COLUMN IF NOT EXISTS evolution_kind TEXT;  -- 'specific' | 'tactical' | 'strategic' | NULL

CREATE INDEX IF NOT EXISTS training_pairs_parent_idx
    ON training_pairs (parent_pair_id) WHERE parent_pair_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS training_pairs_is_evolved_idx
    ON training_pairs (is_evolved);

-- Refresh the health view to surface evolution metrics (must DROP — adding
-- new columns to an existing view requires recreation, not REPLACE)
DROP VIEW IF EXISTS v_training_pairs_health;
CREATE VIEW v_training_pairs_health AS
SELECT
    COUNT(*)                                                                AS total_pairs,
    COUNT(*) FILTER (WHERE is_evolved = FALSE)                              AS original_pairs,
    COUNT(*) FILTER (WHERE is_evolved = TRUE)                               AS evolved_pairs,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')         AS pairs_last_7d,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')       AS pairs_last_24h,
    COUNT(DISTINCT intent)                                                  AS intents_covered,
    COUNT(DISTINCT asset_type)                                              AS asset_types_covered,
    AVG(quality)::NUMERIC(4,2)                                              AS avg_quality
FROM training_pairs;
