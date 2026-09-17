BEGIN;

CREATE TABLE IF NOT EXISTS crafted_item_storage (
  item_id BIGINT PRIMARY KEY REFERENCES player_crafted_items(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  wood INTEGER NOT NULL DEFAULT 0 CHECK (wood >= 0),
  stone INTEGER NOT NULL DEFAULT 0 CHECK (stone >= 0),
  herbs INTEGER NOT NULL DEFAULT 0 CHECK (herbs >= 0),
  capacity INTEGER NOT NULL DEFAULT 60 CHECK (capacity > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (wood + stone + herbs <= capacity)
);

CREATE TABLE IF NOT EXISTS crafted_item_use_receipts (
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('light_campfire', 'extinguish_campfire', 'crate_transfer')),
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS crafted_item_storage_owner_idx ON crafted_item_storage(player_id);
CREATE INDEX IF NOT EXISTS crafted_item_use_receipts_created_idx ON crafted_item_use_receipts(created_at);

COMMIT;
