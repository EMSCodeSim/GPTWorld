BEGIN;

-- Living Town: community projects, contribution ledger, town history, demand bootstrap.
-- Additive only — does not drop or rewrite existing player/world data.

CREATE TABLE IF NOT EXISTS town_projects (
  project_key TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','complete')),
  contributed JSONB NOT NULL DEFAULT '{}'::jsonb,
  required JSONB NOT NULL DEFAULT '{}'::jsonb,
  unlocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS town_project_contributions (
  id BIGSERIAL PRIMARY KEY,
  project_key TEXT NOT NULL REFERENCES town_projects(project_key) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  resource TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS town_project_contributions_player_idx
  ON town_project_contributions (player_id, project_key);
CREATE INDEX IF NOT EXISTS town_project_contributions_project_idx
  ON town_project_contributions (project_key, created_at DESC);

CREATE TABLE IF NOT EXISTS town_project_receipts (
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  action TEXT NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS town_project_receipts_created_idx
  ON town_project_receipts (created_at);

CREATE TABLE IF NOT EXISTS town_history (
  id BIGSERIAL PRIMARY KEY,
  event_key TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  game_day INTEGER,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS town_history_event_key_uidx ON town_history (event_key);
CREATE INDEX IF NOT EXISTS town_history_created_idx ON town_history (created_at DESC);

INSERT INTO world_state(key,value,updated_at)
VALUES (
  'town_demand',
  '{"version":1,"wood":55,"stone":45,"herbs":40,"food":50,"tools":35,"furniture":30,"clothing":25,"construction":40,"crafted":35}'::jsonb,
  now()
)
ON CONFLICT (key) DO NOTHING;

COMMIT;
