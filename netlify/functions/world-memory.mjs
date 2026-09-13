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
    const [worldRows, recentEvents, activityRows, populationRows] = await Promise.all([
      sql`SELECT key, value, updated_at FROM world_state ORDER BY key`,
      sql`SELECT we.id, we.event_type, we.payload, we.created_at, p.display_name FROM world_events we LEFT JOIN players p ON p.id = we.player_id ORDER BY we.created_at DESC LIMIT 50`,
      sql`SELECT event_type, count(*)::int AS count, max(created_at) AS last_seen_at FROM world_events WHERE created_at > now() - interval '24 hours' GROUP BY event_type ORDER BY count(*) DESC, event_type ASC`,
      sql`SELECT count(*)::int AS known_players, count(*) FILTER (WHERE last_seen_at > now() - interval '24 hours')::int AS active_24h, count(*) FILTER (WHERE last_seen_at > now() - interval '90 seconds')::int AS online_now FROM players`
    ]);

    const world = Object.fromEntries(worldRows.map((row) => [row.key, row.value]));
    return json({
      ok: true,
      generated_at: new Date().toISOString(),
      world,
      population: populationRows[0] || {},
      activity_24h: activityRows,
      recent_events: recentEvents,
      evolution_context: {
        current_day: world.current_day || null,
        active_projects: Object.entries(world).filter(([key, value]) => key !== 'current_day' && value && typeof value === 'object' && value.complete === false).map(([key, value]) => ({ key, value })),
        completed_projects: Object.entries(world).filter(([key, value]) => value && typeof value === 'object' && value.complete === true).map(([key, value]) => ({ key, value }))
      }
    });
  } catch (error) {
    console.error('GPTWorld world-memory error', error);
    return json({ ok: false, error: 'world_memory_failed' }, 500);
  }
};
