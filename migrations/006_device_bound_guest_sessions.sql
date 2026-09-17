BEGIN;

CREATE TABLE IF NOT EXISTS player_device_sessions (
  id BIGSERIAL PRIMARY KEY,
  player_id BIGINT NOT NULL UNIQUE REFERENCES players(id) ON DELETE CASCADE,
  device_token_hash TEXT NOT NULL UNIQUE,
  backup_token_hash TEXT NOT NULL UNIQUE,
  recovery_code_hash TEXT NOT NULL UNIQUE,
  registration_key TEXT UNIQUE,
  claimed_legacy_client_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  token_rotated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS player_device_sessions_last_seen_idx
  ON player_device_sessions(last_seen_at DESC);

COMMIT;
