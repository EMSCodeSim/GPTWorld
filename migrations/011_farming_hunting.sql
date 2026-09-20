BEGIN;

ALTER TABLE player_crafting_skills DROP CONSTRAINT IF EXISTS player_crafting_skills_skill_key_check;
ALTER TABLE player_crafting_skills ADD CONSTRAINT player_crafting_skills_skill_key_check
  CHECK (skill_key IN ('carpentry','masonry','herbalism','blacksmithing','tailoring','cooking','farming','construction','hunting'));

CREATE TABLE IF NOT EXISTS private_farm_plots (
  id BIGSERIAL PRIMARY KEY,
  world_id BIGINT NOT NULL REFERENCES player_worlds(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  x DOUBLE PRECISION NOT NULL,
  z DOUBLE PRECISION NOT NULL,
  crop_key TEXT,
  stage TEXT NOT NULL DEFAULT 'prepared',
  moisture DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (moisture>=0 AND moisture<=100),
  health DOUBLE PRECISION NOT NULL DEFAULT 100 CHECK (health>=0 AND health<=100),
  planted_at TIMESTAMPTZ,
  watered_at TIMESTAMPTZ,
  harvested_at TIMESTAMPTZ,
  harvest_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (crop_key IS NULL OR crop_key IN ('wheat','carrot','potato','pumpkin','farm-herbs'))
);
CREATE INDEX IF NOT EXISTS private_farm_plots_world_idx ON private_farm_plots(world_id);

CREATE TABLE IF NOT EXISTS private_hunting_state (
  world_id BIGINT NOT NULL REFERENCES player_worlds(id) ON DELETE CASCADE,
  animal_id TEXT NOT NULL,
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  species TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','harvested')),
  harvested_at TIMESTAMPTZ,
  respawn_after TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(world_id,animal_id)
);

CREATE TABLE IF NOT EXISTS survival_action_receipts (
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  action TEXT NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(player_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS survival_action_receipts_created_idx ON survival_action_receipts(created_at);

COMMIT;
