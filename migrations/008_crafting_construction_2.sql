BEGIN;

-- Widen crafting professions without resetting existing skill rows.
ALTER TABLE player_crafting_skills DROP CONSTRAINT IF EXISTS player_crafting_skills_skill_key_check;
ALTER TABLE player_crafting_skills
  ADD CONSTRAINT player_crafting_skills_skill_key_check
  CHECK (skill_key IN (
    'carpentry','masonry','herbalism',
    'blacksmithing','tailoring','cooking','farming','construction'
  ));

-- Construction attempt receipts (idempotent house builds).
CREATE TABLE IF NOT EXISTS private_construction_receipts (
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  world_id BIGINT NOT NULL REFERENCES player_worlds(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  blueprint_key TEXT NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS private_construction_receipts_created_idx
  ON private_construction_receipts (created_at);

-- Persist simple interior furniture placements for private houses.
CREATE TABLE IF NOT EXISTS private_building_furniture (
  id BIGSERIAL PRIMARY KEY,
  building_id BIGINT NOT NULL REFERENCES private_world_buildings(id) ON DELETE CASCADE,
  world_id BIGINT NOT NULL REFERENCES player_worlds(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  item_id BIGINT REFERENCES player_crafted_items(id) ON DELETE SET NULL,
  item_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  x DOUBLE PRECISION NOT NULL,
  z DOUBLE PRECISION NOT NULL,
  rotation DOUBLE PRECISION NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  placed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS private_building_furniture_building_idx
  ON private_building_furniture (building_id);

-- Optional metadata columns on buildings for interior unlock + footprint.
ALTER TABLE private_world_buildings ADD COLUMN IF NOT EXISTS width DOUBLE PRECISION;
ALTER TABLE private_world_buildings ADD COLUMN IF NOT EXISTS depth DOUBLE PRECISION;
ALTER TABLE private_world_buildings ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMIT;
