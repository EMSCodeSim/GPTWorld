BEGIN;

ALTER TABLE player_crafted_items ADD COLUMN IF NOT EXISTS placed_x DOUBLE PRECISION;
ALTER TABLE player_crafted_items ADD COLUMN IF NOT EXISTS placed_z DOUBLE PRECISION;
ALTER TABLE player_crafted_items ADD COLUMN IF NOT EXISTS placed_rotation DOUBLE PRECISION;
ALTER TABLE player_crafted_items ADD COLUMN IF NOT EXISTS placed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS crafted_item_action_receipts (
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('place_item', 'pickup_item')),
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS player_crafted_items_placed_idx
  ON player_crafted_items(world_id, placed_at) WHERE placed_at IS NOT NULL;

COMMIT;
