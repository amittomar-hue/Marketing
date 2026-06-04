-- ─────────────────────────────────────────────────────────────────
-- Migration 0080: server-side chat conversation persistence.
--
-- Until now chat history lived only in browser localStorage
-- (the "dmoop-chat-store" Zustand persist namespace). That made
-- every device a separate silo for the same logged-in user —
-- desktop conversations never reached mobile and vice versa.
--
-- This migration adds a single JSONB-blob table that stores each
-- conversation as a row keyed by the auth user. The blob shape
-- matches the existing client-side `Conversation` type (id, title,
-- model, messages[], createdAt, updatedAt) so the chat-store can
-- serialise/deserialise without translation.
--
-- RLS is user-scoped via auth.uid() so the browser client can
-- read and write its own rows directly with the anon key —
-- no API route round-trips needed.
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_conversations (
    -- Conversation ID mirrors the client-side Zustand uid (short
    -- base36 string, e.g. "k3h8j2lqp"). Kept as TEXT primary key
    -- so existing localStorage conversations migrate without
    -- regenerating IDs (preserves URLs / message references).
    id           TEXT PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title        TEXT NOT NULL DEFAULT 'New conversation',
    model        TEXT NOT NULL,
    -- Full conversation snapshot — { id, title, model, messages[], createdAt, updatedAt }.
    -- Written wholesale on every mutation. Conversations stay small
    -- (typical: <50KB) so wholesale writes are simpler and cheaper
    -- than maintaining a separate chat_messages table with fan-out.
    data         JSONB NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hot path: list-my-conversations-newest-first for the sidebar
CREATE INDEX IF NOT EXISTS chat_conversations_user_updated_idx
    ON chat_conversations (user_id, updated_at DESC);

-- ─────────────────────────────────────────────────────────────────
-- Row-level security: a user can only see/write their own
-- conversations. Service role bypasses for admin tooling.
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_convo_select_own"  ON chat_conversations;
DROP POLICY IF EXISTS "chat_convo_insert_own"  ON chat_conversations;
DROP POLICY IF EXISTS "chat_convo_update_own"  ON chat_conversations;
DROP POLICY IF EXISTS "chat_convo_delete_own"  ON chat_conversations;
DROP POLICY IF EXISTS "chat_convo_service_all" ON chat_conversations;

CREATE POLICY "chat_convo_select_own" ON chat_conversations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "chat_convo_insert_own" ON chat_conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "chat_convo_update_own" ON chat_conversations
    FOR UPDATE USING (auth.uid() = user_id)
                 WITH CHECK (auth.uid() = user_id);

CREATE POLICY "chat_convo_delete_own" ON chat_conversations
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "chat_convo_service_all" ON chat_conversations
    FOR ALL USING (auth.role() = 'service_role');
