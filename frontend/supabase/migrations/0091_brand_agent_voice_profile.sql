-- ─────────────────────────────────────────────────────────────────
-- Migration 0091: structured Brand Voice Profile per agent.
--
-- Phase 4 (multi-agent) gave every user N siloed Brand Agents, each
-- with its own RAG document library. RAG alone is reactive — every
-- chat turn is a fresh similarity search against chunks. Users
-- writing brand-on copy want PROACTIVE brand voice: a small
-- structured profile (tone, audience, preferred vocab, avoided terms,
-- writing style) extracted once per upload from the doc library
-- and injected into every chat turn for that agent as a permanent
-- system-prompt addendum, separate from the per-query brand chunks.
--
-- The profile shape lives in a JSONB column on brand_agents so the
-- schema doesn't have to change every time we tune the extractor's
-- output structure. A timestamp tracks when it was last re-extracted
-- (used to decide whether to refresh after a new upload or skip).
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE brand_agents
    -- Structured profile. NULL = never extracted (new agent with no
    -- docs yet, or extractor failed on the latest run). Shape:
    --   {
    --     tone_descriptors: string[],
    --     audience:        string,
    --     value_props:     string[],
    --     preferred_terms: string[],
    --     avoid_terms:     string[],
    --     writing_style:   string,
    --     extracted_from_chars: number,
    --     doc_count: number
    --   }
    ADD COLUMN IF NOT EXISTS voice_profile JSONB,
    -- When the profile was last successfully extracted. Cheaper to
    -- check than to compare doc upload timestamps.
    ADD COLUMN IF NOT EXISTS voice_profile_updated_at TIMESTAMPTZ;
