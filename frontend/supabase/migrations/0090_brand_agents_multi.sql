-- ─────────────────────────────────────────────────────────────────
-- Migration 0090: multi-Brand-Agent support.
--
-- Until now Brand Agent was hardcoded to one-per-user — brand_documents
-- and brand_doc_chunks were keyed only by user_id, and the agent name
-- lived in browser localStorage. Marketing agencies with 10 clients
-- had to dump every brand into one undifferentiated pile.
--
-- This migration introduces a brand_agents table (user_id → many
-- agents) and adds an agent_id FK to brand_documents, brand_doc_chunks,
-- and chat_conversations. Existing data is backfilled into one
-- "Default brand" agent per user so nothing breaks for current users
-- — they just see their existing library scoped under that agent name.
-- They can rename it or create siblings any time.
--
-- The retrieve_brand_chunks RPC is updated to accept an optional
-- p_agent_id parameter; when present, only that agent's chunks are
-- searched. When NULL (e.g. for callers that haven't been updated
-- yet), it falls back to the user's default agent — keeps API
-- backwards-compat during the rollout.
-- ─────────────────────────────────────────────────────────────────

-- ── 1. brand_agents table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brand_agents (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    -- Hex color used by the UI to visually distinguish agents in the
    -- switcher / library headers. Defaults to DMOOP accent if unset.
    color       TEXT NOT NULL DEFAULT '#c14a2a',
    -- Exactly one agent per user has is_default = true; that's the
    -- agent the chat falls back to when a conversation has no
    -- explicit agent_id bound (legacy conversations, new conversations
    -- before the user picks one).
    is_default  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS brand_agents_user_idx
    ON brand_agents (user_id, created_at DESC);

-- Partial unique index: at most one default agent per user
CREATE UNIQUE INDEX IF NOT EXISTS brand_agents_one_default_per_user
    ON brand_agents (user_id) WHERE is_default = TRUE;

-- ── 2. RLS for brand_agents ───────────────────────────────────────
ALTER TABLE brand_agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brand_agents_select_own"  ON brand_agents;
DROP POLICY IF EXISTS "brand_agents_insert_own"  ON brand_agents;
DROP POLICY IF EXISTS "brand_agents_update_own"  ON brand_agents;
DROP POLICY IF EXISTS "brand_agents_delete_own"  ON brand_agents;
DROP POLICY IF EXISTS "brand_agents_service_all" ON brand_agents;

CREATE POLICY "brand_agents_select_own" ON brand_agents
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "brand_agents_insert_own" ON brand_agents
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "brand_agents_update_own" ON brand_agents
    FOR UPDATE USING (auth.uid() = user_id)
                 WITH CHECK (auth.uid() = user_id);
CREATE POLICY "brand_agents_delete_own" ON brand_agents
    FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "brand_agents_service_all" ON brand_agents
    FOR ALL USING (auth.role() = 'service_role');

-- ── 3. Add agent_id columns (nullable for now) ─────────────────────
ALTER TABLE brand_documents
    ADD COLUMN IF NOT EXISTS agent_id UUID
    REFERENCES brand_agents(id) ON DELETE CASCADE;

ALTER TABLE brand_doc_chunks
    ADD COLUMN IF NOT EXISTS agent_id UUID
    REFERENCES brand_agents(id) ON DELETE CASCADE;

ALTER TABLE chat_conversations
    ADD COLUMN IF NOT EXISTS agent_id UUID
    REFERENCES brand_agents(id) ON DELETE SET NULL;

-- ── 4. Backfill: one default agent per existing user ──────────────
-- For every user that already has at least one brand_document but no
-- brand_agent yet, create a "Default brand" agent and point all that
-- user's existing brand_documents + brand_doc_chunks at it. Idempotent
-- so re-running is safe.
INSERT INTO brand_agents (user_id, name, is_default)
SELECT DISTINCT bd.user_id, 'Default brand', TRUE
FROM brand_documents bd
LEFT JOIN brand_agents ba
    ON ba.user_id = bd.user_id AND ba.is_default = TRUE
WHERE ba.id IS NULL;

UPDATE brand_documents bd
SET agent_id = ba.id
FROM brand_agents ba
WHERE bd.user_id = ba.user_id
  AND ba.is_default = TRUE
  AND bd.agent_id IS NULL;

UPDATE brand_doc_chunks bdc
SET agent_id = ba.id
FROM brand_agents ba
WHERE bdc.user_id = ba.user_id
  AND ba.is_default = TRUE
  AND bdc.agent_id IS NULL;

-- Backfill chat_conversations: bind every existing conversation to
-- the user's default agent so historical chats stay grounded in the
-- same brand they were originally drafted against.
UPDATE chat_conversations cc
SET agent_id = ba.id
FROM brand_agents ba
WHERE cc.user_id = ba.user_id
  AND ba.is_default = TRUE
  AND cc.agent_id IS NULL;

-- ── 5. Tighten constraints AFTER backfill ─────────────────────────
-- brand_documents and brand_doc_chunks must always belong to an agent
-- going forward. chat_conversations stays nullable — a brand-new
-- conversation can be opened before the user picks an agent, and a
-- user who hasn't uploaded any brand docs yet has no agent to bind.
ALTER TABLE brand_documents
    ALTER COLUMN agent_id SET NOT NULL;
ALTER TABLE brand_doc_chunks
    ALTER COLUMN agent_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS brand_documents_agent_idx
    ON brand_documents (agent_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS brand_doc_chunks_agent_idx
    ON brand_doc_chunks (agent_id);
CREATE INDEX IF NOT EXISTS chat_conversations_agent_idx
    ON chat_conversations (agent_id);

-- ── 6. Updated retrieve_brand_chunks RPC ──────────────────────────
-- New signature accepts an optional p_agent_id. When NULL, fall back
-- to the user's default agent so the old chat-route call signature
-- (which doesn't pass agent yet) keeps working during the rollout.
-- Old function is dropped and recreated since the parameter list
-- changed — Postgres doesn't auto-update parameter signatures.
DROP FUNCTION IF EXISTS retrieve_brand_chunks(UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS retrieve_brand_chunks(UUID, UUID, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION retrieve_brand_chunks(
    p_user_id  UUID,
    p_agent_id UUID,
    p_query    TEXT,
    p_limit    INTEGER DEFAULT 5
)
RETURNS TABLE (
    chunk_id   UUID,
    doc_id     UUID,
    filename   TEXT,
    doc_type   TEXT,
    text       TEXT,
    similarity REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_agent_id UUID;
BEGIN
    -- Resolve effective agent: explicit if passed, else user's default.
    IF p_agent_id IS NOT NULL THEN
        v_agent_id := p_agent_id;
    ELSE
        SELECT id INTO v_agent_id
        FROM brand_agents
        WHERE user_id = p_user_id AND is_default = TRUE
        LIMIT 1;
    END IF;

    -- If the user has no agent at all (never uploaded a brand doc),
    -- return empty set rather than scanning every chunk.
    IF v_agent_id IS NULL THEN RETURN; END IF;

    RETURN QUERY
    SELECT
        bdc.id           AS chunk_id,
        bdc.doc_id,
        bd.filename,
        bd.doc_type,
        bdc.text,
        similarity(bdc.text, p_query) AS similarity
    FROM brand_doc_chunks bdc
    JOIN brand_documents  bd ON bd.id = bdc.doc_id
    WHERE bdc.user_id  = p_user_id
      AND bdc.agent_id = v_agent_id
      AND similarity(bdc.text, p_query) > 0.05
    ORDER BY similarity DESC, bdc.created_at DESC
    LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION retrieve_brand_chunks(UUID, UUID, TEXT, INTEGER) TO authenticated, service_role;

-- ── 7. Trigger: keep updated_at fresh on brand_agents ─────────────
CREATE OR REPLACE FUNCTION brand_agents_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS brand_agents_set_updated_at ON brand_agents;
CREATE TRIGGER brand_agents_set_updated_at
    BEFORE UPDATE ON brand_agents
    FOR EACH ROW
    EXECUTE FUNCTION brand_agents_touch_updated_at();
