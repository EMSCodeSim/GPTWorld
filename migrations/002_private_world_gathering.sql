BEGIN;

CREATE TABLE IF NOT EXISTS private_world_action_receipts (
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  world_id BIGINT NOT NULL REFERENCES player_worlds(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('gather_resource')),
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS private_world_action_receipts_created_idx
  ON private_world_action_receipts (created_at);

COMMIT;
