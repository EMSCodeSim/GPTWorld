BEGIN;

-- Progression, discovery, and long-term gameplay.
-- Additive only — preserves inventory, skills, structures, town history, and identity.

-- Allow poor quality on crafted goods (additive constraint refresh).
ALTER TABLE player_crafted_items DROP CONSTRAINT IF EXISTS player_crafted_items_quality_check;
ALTER TABLE player_crafted_items ADD CONSTRAINT player_crafted_items_quality_check
  CHECK (quality IN ('poor', 'standard', 'fine', 'exceptional'));

CREATE TABLE IF NOT EXISTS player_milestones (
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  milestone_key TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (player_id, milestone_key)
);

CREATE INDEX IF NOT EXISTS player_milestones_earned_idx
  ON player_milestones (player_id, earned_at DESC);

CREATE TABLE IF NOT EXISTS player_field_journal (
  player_id BIGINT NOT NULL PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  journal JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS private_world_discoveries (
  world_id BIGINT NOT NULL REFERENCES player_worlds(id) ON DELETE CASCADE,
  discovery_id TEXT NOT NULL,
  discovery_key TEXT NOT NULL,
  x DOUBLE PRECISION NOT NULL,
  z DOUBLE PRECISION NOT NULL,
  found BOOLEAN NOT NULL DEFAULT FALSE,
  found_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (world_id, discovery_id)
);

CREATE INDEX IF NOT EXISTS private_world_discoveries_world_idx
  ON private_world_discoveries (world_id, found);

CREATE TABLE IF NOT EXISTS player_legacy_events (
  id BIGSERIAL PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'personal',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, event_key)
);

CREATE INDEX IF NOT EXISTS player_legacy_events_created_idx
  ON player_legacy_events (created_at DESC);

CREATE TABLE IF NOT EXISTS progression_action_receipts (
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  action TEXT NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS progression_action_receipts_created_idx
  ON progression_action_receipts (created_at);

-- Structure upgrade metadata lives on existing private_world_buildings.level/metadata.
-- Cart cargo is stored as crafted item metadata / optional cart cargo table.

CREATE TABLE IF NOT EXISTS player_cart_cargo (
  player_id BIGINT NOT NULL PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  wood INTEGER NOT NULL DEFAULT 0 CHECK (wood >= 0),
  stone INTEGER NOT NULL DEFAULT 0 CHECK (stone >= 0),
  herbs INTEGER NOT NULL DEFAULT 0 CHECK (herbs >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Town identity / arrivals bootstrap keys (world_state rows; non-destructive).
INSERT INTO world_state(key, value, updated_at)
VALUES
  ('town_identity', '{"version":1,"key":"frontier_settlement","name":"Frontier Settlement","completed":[]}'::jsonb, now()),
  ('town_arrivals', '{"version":1,"residents":[]}'::jsonb, now()),
  ('regional_hooks', '{"version":1,"hints":["north_trail","river_trail","abandoned_signpost"]}'::jsonb, now())
ON CONFLICT (key) DO NOTHING;

COMMIT;
