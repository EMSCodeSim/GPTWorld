/** Idempotent additive schema for Living Town projects, history, and demand. */

export async function ensureTownProjectsSchema(sql){
  await sql`
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
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS town_project_contributions (
      id BIGSERIAL PRIMARY KEY,
      project_key TEXT NOT NULL REFERENCES town_projects(project_key) ON DELETE CASCADE,
      player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      resource TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK (amount > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS town_project_contributions_player_idx ON town_project_contributions (player_id, project_key)`;
  await sql`CREATE INDEX IF NOT EXISTS town_project_contributions_project_idx ON town_project_contributions (project_key, created_at DESC)`;
  await sql`
    CREATE TABLE IF NOT EXISTS town_project_receipts (
      player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      idempotency_key TEXT NOT NULL,
      action TEXT NOT NULL,
      response JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (player_id, idempotency_key)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS town_project_receipts_created_idx ON town_project_receipts (created_at)`;
  await sql`
    CREATE TABLE IF NOT EXISTS town_history (
      id BIGSERIAL PRIMARY KEY,
      event_key TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      game_day INTEGER,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS town_history_event_key_uidx ON town_history (event_key)`;
  await sql`CREATE INDEX IF NOT EXISTS town_history_created_idx ON town_history (created_at DESC)`;
  await sql`
    INSERT INTO world_state(key,value,updated_at)
    VALUES ('town_demand','{"version":1,"wood":55,"stone":45,"herbs":40,"food":50,"tools":35,"furniture":30,"clothing":25,"construction":40,"crafted":35}'::jsonb,now())
    ON CONFLICT (key) DO NOTHING
  `;
  return{ok:true,schema:'living-town-012'};
}

export async function townProjectsSchemaReady(sql){
  try{
    await sql`SELECT 1 FROM town_projects LIMIT 0`;
    await sql`SELECT 1 FROM town_project_contributions LIMIT 0`;
    await sql`SELECT 1 FROM town_project_receipts LIMIT 0`;
    await sql`SELECT 1 FROM town_history LIMIT 0`;
    return true;
  }catch{
    return false;
  }
}
