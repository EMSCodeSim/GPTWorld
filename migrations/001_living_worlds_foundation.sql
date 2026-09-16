BEGIN;

CREATE TABLE IF NOT EXISTS player_worlds (
  id BIGSERIAL PRIMARY KEY,
  owner_player_id BIGINT NOT NULL UNIQUE REFERENCES players(id) ON DELETE CASCADE,
  world_type TEXT NOT NULL DEFAULT 'private' CHECK (world_type = 'private'),
  name TEXT NOT NULL,
  seed BIGINT NOT NULL,
  terrain_state JSONB NOT NULL,
  ecology_state JSONB NOT NULL,
  last_simulated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS player_world_sessions (
  player_id BIGINT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  current_world_type TEXT NOT NULL DEFAULT 'public' CHECK (current_world_type IN ('public', 'private')),
  private_world_id BIGINT REFERENCES player_worlds(id) ON DELETE SET NULL,
  saved_public_x DOUBLE PRECISION NOT NULL DEFAULT 0,
  saved_public_z DOUBLE PRECISION NOT NULL DEFAULT 12,
  private_x DOUBLE PRECISION NOT NULL DEFAULT 0,
  private_z DOUBLE PRECISION NOT NULL DEFAULT 8,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS world_travel_receipts (
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('enter_private', 'return_public')),
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS private_world_resources (
  id BIGSERIAL PRIMARY KEY,
  world_id BIGINT NOT NULL REFERENCES player_worlds(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  x DOUBLE PRECISION NOT NULL,
  z DOUBLE PRECISION NOT NULL,
  max_amount INTEGER NOT NULL CHECK (max_amount >= 0),
  remaining INTEGER NOT NULL CHECK (remaining >= 0 AND remaining <= max_amount),
  regrow_at TIMESTAMPTZ,
  generation INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (world_id, node_id)
);

CREATE TABLE IF NOT EXISTS private_world_buildings (
  id BIGSERIAL PRIMARY KEY,
  world_id BIGINT NOT NULL REFERENCES player_worlds(id) ON DELETE CASCADE,
  building_key TEXT NOT NULL,
  building_type TEXT NOT NULL,
  x DOUBLE PRECISION NOT NULL,
  z DOUBLE PRECISION NOT NULL,
  level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 20),
  condition INTEGER NOT NULL DEFAULT 100 CHECK (condition BETWEEN 0 AND 100),
  status TEXT NOT NULL DEFAULT 'active',
  construction_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (world_id, building_key)
);

CREATE TABLE IF NOT EXISTS private_world_events (
  id BIGSERIAL PRIMARY KEY,
  world_id BIGINT NOT NULL REFERENCES player_worlds(id) ON DELETE CASCADE,
  player_id BIGINT REFERENCES players(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  x DOUBLE PRECISION,
  z DOUBLE PRECISION,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS private_world_events_world_time_idx
  ON private_world_events (world_id, created_at DESC);
CREATE INDEX IF NOT EXISTS private_world_resources_world_type_idx
  ON private_world_resources (world_id, resource_type);
CREATE INDEX IF NOT EXISTS world_travel_receipts_created_idx
  ON world_travel_receipts (created_at);

COMMIT;
