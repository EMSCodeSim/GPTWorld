import { neon } from '@neondatabase/serverless';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

export default async (req) => {
  if (req.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405);
  if (!process.env.DATABASE_URL) return json({ ok: false, error: 'database_not_configured' }, 503);

  const sql = neon(process.env.DATABASE_URL);
  try {
    const [dayRows, crossingRows, playerRows, inventoryRows, eventRows] = await Promise.all([
      sql`SELECT value FROM world_state WHERE key = 'current_day' LIMIT 1`,
      sql`SELECT value FROM world_state WHERE key = 'western_crossing' LIMIT 1`,
      sql`SELECT count(*)::int AS count FROM players`,
      sql`SELECT count(*)::int AS count FROM player_inventory`,
      sql`SELECT count(*)::int AS count FROM world_events`
    ]);

    const checks = {
      database: true,
      current_day: Boolean(dayRows[0]?.value),
      shared_world_state: Boolean(crossingRows[0]?.value),
      players_table: Number.isFinite(Number(playerRows[0]?.count)),
      inventory_table: Number.isFinite(Number(inventoryRows[0]?.count)),
      world_events_table: Number.isFinite(Number(eventRows[0]?.count))
    };
    const ok = Object.values(checks).every(Boolean);
    return json({
      ok,
      status: ok ? 'healthy' : 'degraded',
      checks,
      day: dayRows[0]?.value || null,
      checked_at: new Date().toISOString()
    }, ok ? 200 : 503);
  } catch (error) {
    console.error('GPTWorld health check failed', error);
    return json({ ok: false, status: 'unhealthy', error: 'health_check_failed', checked_at: new Date().toISOString() }, 503);
  }
};
