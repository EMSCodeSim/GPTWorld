import { neon } from '@neondatabase/serverless';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

const requiredTables = ['players', 'player_inventory', 'world_state', 'world_events'];

const safeObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : null;

export default async (req) => {
  if (req.method !== 'GET') return json({ ok: false, status: 'unhealthy', error: 'method_not_allowed' }, 405);
  if (!process.env.DATABASE_URL) return json({ ok: false, status: 'unhealthy', error: 'database_not_configured' }, 503);

  const sql = neon(process.env.DATABASE_URL);

  try {
    const tableRows = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY(${requiredTables})
    `;

    const existingTables = new Set(tableRows.map((row) => row.table_name));
    const tables = Object.fromEntries(requiredTables.map((name) => [name, existingTables.has(name)]));
    const allTablesPresent = requiredTables.every((name) => tables[name]);

    if (!allTablesPresent) {
      return json({
        ok: false,
        status: 'degraded',
        checks: { database: true, required_tables: false },
        tables,
        missing_tables: requiredTables.filter((name) => !tables[name]),
        checked_at: new Date().toISOString()
      }, 503);
    }

    const [stateRows, playerRows, inventoryRows, inventoryOwnerRows, eventRows] = await Promise.all([
      sql`
        SELECT key, value
        FROM world_state
        WHERE key IN ('current_day', 'western_crossing')
      `,
      sql`SELECT count(*)::int AS count FROM players`,
      sql`SELECT count(*)::int AS count FROM player_inventory`,
      sql`
        SELECT
          count(*) FILTER (WHERE p.id IS NULL)::int AS orphan_rows,
          count(DISTINCT pi.player_id)::int AS players_with_inventory
        FROM player_inventory pi
        LEFT JOIN players p ON p.id = pi.player_id
      `,
      sql`SELECT count(*)::int AS count, max(created_at) AS latest_event_at FROM world_events`
    ]);

    const state = Object.fromEntries(stateRows.map((row) => [row.key, row.value]));
    const dayValue = state.current_day ?? null;
    const crossing = safeObject(state.western_crossing);

    const playersCount = Number(playerRows[0]?.count ?? 0);
    const inventoryCount = Number(inventoryRows[0]?.count ?? 0);
    const playersWithInventory = Number(inventoryOwnerRows[0]?.players_with_inventory ?? 0);
    const orphanInventoryRows = Number(inventoryOwnerRows[0]?.orphan_rows ?? 0);
    const worldEventsCount = Number(eventRows[0]?.count ?? 0);

    const checks = {
      database: true,
      required_tables: allTablesPresent,
      current_day: dayValue !== null && dayValue !== undefined,
      shared_world_state: crossing !== null,
      players_table: Number.isFinite(playersCount),
      inventory_table: Number.isFinite(inventoryCount),
      inventory_ownership: orphanInventoryRows === 0,
      world_events_table: Number.isFinite(worldEventsCount)
    };

    const ok = Object.values(checks).every(Boolean);

    return json({
      ok,
      status: ok ? 'healthy' : 'degraded',
      checks,
      tables,
      world: {
        current_day: dayValue,
        western_crossing: crossing
      },
      persistence: {
        players: playersCount,
        inventory_rows: inventoryCount,
        players_with_inventory: playersWithInventory,
        orphan_inventory_rows: orphanInventoryRows,
        world_events: worldEventsCount,
        latest_world_event_at: eventRows[0]?.latest_event_at ?? null
      },
      checked_at: new Date().toISOString()
    }, ok ? 200 : 503);
  } catch (error) {
    console.error('GPTWorld health check failed', error);
    return json({
      ok: false,
      status: 'unhealthy',
      error: 'health_check_failed',
      checked_at: new Date().toISOString()
    }, 503);
  }
};
