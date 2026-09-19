import {neon} from '@neondatabase/serverless';

/** Idempotent additive schema for inventory stacking + merchant economy (migration 009). */
export async function ensureEconomySchema(sql){
  await sql`ALTER TABLE player_inventory ADD COLUMN IF NOT EXISTS coins INTEGER NOT NULL DEFAULT 0`;
  await sql`
    DO $$ BEGIN
      ALTER TABLE player_inventory ADD CONSTRAINT player_inventory_coins_nonneg CHECK (coins >= 0);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;
  await sql`ALTER TABLE player_crafted_items ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1`;
  await sql`
    DO $$ BEGIN
      ALTER TABLE player_crafted_items ADD CONSTRAINT player_crafted_items_quantity_positive CHECK (quantity > 0 AND quantity <= 999);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS merchant_budgets (
      merchant_key TEXT PRIMARY KEY,
      budget INTEGER NOT NULL DEFAULT 0 CHECK (budget >= 0),
      replenish_day_key TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS merchant_trade_receipts (
      player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      idempotency_key TEXT NOT NULL,
      merchant_key TEXT NOT NULL,
      response JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (player_id, idempotency_key)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS merchant_trade_receipts_created_idx ON merchant_trade_receipts (created_at)`;
  await sql`
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
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS merchant_trade_ledger_player_idx ON merchant_trade_ledger (player_id, created_at DESC)`;
  await sql`
    CREATE TABLE IF NOT EXISTS inventory_action_receipts (
      player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      idempotency_key TEXT NOT NULL,
      action TEXT NOT NULL,
      response JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (player_id, idempotency_key)
    )
  `;
  return{ok:true,schema:'economy-009'};
}

export async function economySchemaReady(sql){
  try{
    await sql`SELECT coins FROM player_inventory LIMIT 0`;
    await sql`SELECT quantity FROM player_crafted_items LIMIT 0`;
    await sql`SELECT 1 FROM merchant_budgets LIMIT 0`;
    await sql`SELECT 1 FROM merchant_trade_receipts LIMIT 0`;
    await sql`SELECT 1 FROM inventory_action_receipts LIMIT 0`;
    return true;
  }catch{
    return false;
  }
}
