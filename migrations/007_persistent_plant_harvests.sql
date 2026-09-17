BEGIN;

CREATE TABLE IF NOT EXISTS public_resource_action_receipts (
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  node_id TEXT NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS public_resource_action_receipts_created_idx
  ON public_resource_action_receipts (created_at);

COMMIT;
