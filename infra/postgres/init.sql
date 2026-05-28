-- Marketing LLM — PostgreSQL schema v0.1

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ─────────────────────────────────────────────
-- Users & Organizations
-- ─────────────────────────────────────────────
CREATE TABLE organizations (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          TEXT NOT NULL,
    plan          TEXT NOT NULL DEFAULT 'trial',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
    email             TEXT NOT NULL UNIQUE,
    name              TEXT NOT NULL,
    hashed_password   TEXT NOT NULL,
    role              TEXT NOT NULL DEFAULT 'member',  -- owner|admin|member|viewer
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- Brands & Voice Profiles
-- ─────────────────────────────────────────────
CREATE TABLE brands (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                 TEXT NOT NULL,
    tone_dimensions      JSONB,
    prohibited_terms     TEXT[] DEFAULT '{}',
    voice_score          INT,
    training_examples    INT NOT NULL DEFAULT 0,
    status               TEXT NOT NULL DEFAULT 'new',  -- new|training|active
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE brand_examples (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id    UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    text        TEXT NOT NULL,
    approved    BOOLEAN NOT NULL DEFAULT TRUE,
    source      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- Campaigns & Content
-- ─────────────────────────────────────────────
CREATE TABLE campaigns (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id         UUID NOT NULL REFERENCES brands(id),
    created_by       UUID NOT NULL REFERENCES users(id),
    name             TEXT NOT NULL,
    channel          TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'draft',  -- draft|review|live|paused|complete
    brief_context    JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    launched_at      TIMESTAMPTZ
);

CREATE TABLE content_pieces (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id      UUID REFERENCES campaigns(id),
    brand_id         UUID REFERENCES brands(id),
    created_by       UUID NOT NULL REFERENCES users(id),
    channel          TEXT NOT NULL,
    headline         TEXT,
    body             TEXT,
    cta              TEXT,
    brand_score      INT,
    predicted_ctr    NUMERIC(5,2),
    actual_ctr       NUMERIC(5,2),
    actual_roas      NUMERIC(8,2),
    prompt_context   JSONB,
    status           TEXT NOT NULL DEFAULT 'draft',  -- draft|approved|published|rejected
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ab_tests (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id     UUID NOT NULL REFERENCES campaigns(id),
    variant_a_id    UUID NOT NULL REFERENCES content_pieces(id),
    variant_b_id    UUID NOT NULL REFERENCES content_pieces(id),
    winner_id       UUID REFERENCES content_pieces(id),
    status          TEXT NOT NULL DEFAULT 'running',
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at        TIMESTAMPTZ
);

-- ─────────────────────────────────────────────
-- Trends
-- ─────────────────────────────────────────────
CREATE TABLE trends (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    category        TEXT,
    sentiment       TEXT,
    velocity        TEXT,
    mentions        INT NOT NULL DEFAULT 0,
    confidence      NUMERIC(4,3) NOT NULL,
    stage           TEXT NOT NULL DEFAULT 'emerging',  -- emerging|rising|peak|fading
    summary         TEXT,
    sources         JSONB DEFAULT '[]',
    raw_signals     JSONB,
    detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX trends_confidence_idx ON trends (confidence DESC);
CREATE INDEX trends_stage_idx ON trends (stage);
CREATE INDEX trends_detected_idx ON trends (detected_at DESC);

-- ─────────────────────────────────────────────
-- Personas
-- ─────────────────────────────────────────────
CREATE TABLE personas (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id       UUID NOT NULL REFERENCES organizations(id),
    name                  TEXT NOT NULL,
    demographics          JSONB,
    psychographics        JSONB,
    language_patterns     JSONB,
    pain_points           TEXT[],
    desires               TEXT[],
    objections            TEXT[],
    data_sources          TEXT[],
    last_updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- Competitors
-- ─────────────────────────────────────────────
CREATE TABLE competitors (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    name                TEXT NOT NULL,
    domain              TEXT NOT NULL,
    share_of_voice      INT,
    sentiment           TEXT,
    ads_running         INT DEFAULT 0,
    content_frequency   TEXT,
    last_checked_at     TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE competitor_alerts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competitor_id   UUID NOT NULL REFERENCES competitors(id),
    event           TEXT NOT NULL,
    severity        TEXT NOT NULL DEFAULT 'medium',  -- low|medium|high|critical
    metadata        JSONB,
    detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- Integrations
-- ─────────────────────────────────────────────
CREATE TABLE integrations (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    platform            TEXT NOT NULL,  -- hubspot|google_ads|meta|mailchimp|klaviyo|slack
    credentials         JSONB,          -- encrypted at app layer
    status              TEXT NOT NULL DEFAULT 'disconnected',
    last_synced_at      TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- Performance Metrics (RLMO feedback)
-- ─────────────────────────────────────────────
CREATE TABLE performance_metrics (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id          UUID NOT NULL REFERENCES content_pieces(id),
    integration_id      UUID REFERENCES integrations(id),
    metric_type         TEXT NOT NULL,  -- ctr|open_rate|roas|engagement_rate|conversion_rate
    value               NUMERIC(10,4) NOT NULL,
    recorded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX perf_content_idx ON performance_metrics (content_id, metric_type);
