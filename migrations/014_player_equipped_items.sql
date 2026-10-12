BEGIN;

CREATE TABLE IF NOT EXISTS player_equipped_items (
  player_id bigint NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  slot text NOT NULL CHECK (slot IN ('head','chest','legs','feet','back','mainHand','offHand')),
  item_id bigint NOT NULL REFERENCES player_crafted_items(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, slot),
  UNIQUE (player_id, item_id)
);

CREATE INDEX IF NOT EXISTS player_equipped_items_item_id_idx
  ON player_equipped_items (item_id);

COMMIT;
