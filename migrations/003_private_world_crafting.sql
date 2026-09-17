BEGIN;

CREATE TABLE IF NOT EXISTS player_crafting_skills (
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  skill_key TEXT NOT NULL CHECK (skill_key IN ('carpentry', 'masonry', 'herbalism')),
  skill_value NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (skill_value BETWEEN 0 AND 100),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, skill_key)
);

CREATE TABLE IF NOT EXISTS player_crafted_items (
  id BIGSERIAL PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  world_id BIGINT NOT NULL REFERENCES player_worlds(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  profession TEXT NOT NULL,
  quality TEXT NOT NULL CHECK (quality IN ('standard', 'fine', 'exceptional')),
  durability INTEGER NOT NULL CHECK (durability >= 0),
  max_durability INTEGER NOT NULL CHECK (max_durability > 0),
  maker_name TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  crafted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crafting_action_receipts (
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  world_id BIGINT NOT NULL REFERENCES player_worlds(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  recipe_key TEXT NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS player_crafted_items_owner_time_idx ON player_crafted_items(player_id, crafted_at DESC);
CREATE INDEX IF NOT EXISTS crafting_action_receipts_created_idx ON crafting_action_receipts(created_at);

COMMIT;
