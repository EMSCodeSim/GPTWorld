BEGIN;

-- Player coins (additive; does not replace wood/stone/herbs).
ALTER TABLE player_inventory ADD COLUMN IF NOT EXISTS coins INTEGER NOT NULL DEFAULT 0;
ALTER TABLE player_inventory DROP CONSTRAINT IF EXISTS player_inventory_coins_nonneg;
ALTER TABLE player_inventory ADD CONSTRAINT player_inventory_coins_nonneg CHECK (coins >= 0);

-- Stack quantity on crafted items (1 row can represent a stack).
ALTER TABLE player_crafted_items ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;
ALTER TABLE player_crafted_items DROP CONSTRAINT IF EXISTS player_crafted_items_quantity_positive;
ALTER TABLE player_crafted_items ADD CONSTRAINT player_crafted_items_quantity_positive CHECK (quantity > 0 AND quantity <= 999);

-- Merchant budgets + trade receipts (idempotent sales).
CREATE TABLE IF NOT EXISTS merchant_budgets (
  merchant_key TEXT PRIMARY KEY,
  budget INTEGER NOT NULL DEFAULT 0 CHECK (budget >= 0),
  replenish_day_key TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS merchant_trade_receipts (
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  merchant_key TEXT NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS merchant_trade_receipts_created_idx
  ON merchant_trade_receipts (created_at);

CREATE TABLE IF NOT EXISTS merchant_trade_ledger (
  id BIGSERIAL PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  merchant_key TEXT NOT NULL,
  item_key TEXT NOT NULL,
  quality TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL CHECK (unit_price > 0),
  total_coins INTEGER NOT NULL CHECK (total_coins > 0),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS merchant_trade_ledger_player_idx
  ON merchant_trade_ledger (player_id, created_at DESC);

-- Inventory mutation receipts (split stacks, etc.).
CREATE TABLE IF NOT EXISTS inventory_action_receipts (
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  action TEXT NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, idempotency_key)
);

COMMIT;
