import { neon } from '@neondatabase/serverless';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

const cleanName = (value) => String(value || 'Traveler').replace(/[<>]/g, '').trim().slice(0, 20) || 'Traveler';
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const nonNegativeInt = (value) => Math.max(0, Math.min(100000, Math.floor(finite(value, 0))));

export default async (req) => {
  if (!process.env.DATABASE_URL) return json({ ok: false, error: 'database_not_configured' }, 503);
  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const clientId = (url.searchParams.get('clientId') || '').slice(0, 80);
      const [worldRows, onlineRows, meRows] = await Promise.all([
        sql`SELECT key, value, updated_at FROM world_state ORDER BY key`,
        sql`SELECT client_id, display_name, x, z, last_seen_at FROM players WHERE last_seen_at > now() - interval '90 seconds' ORDER BY last_seen_at DESC LIMIT 50`,
        clientId ? sql`SELECT p.client_id, p.display_name, p.x, p.z, i.wood, i.stone, i.herbs FROM players p LEFT JOIN player_inventory i ON i.player_id = p.id WHERE p.client_id = ${clientId} LIMIT 1` : Promise.resolve([])
      ]);
      return json({ ok: true, world: Object.fromEntries(worldRows.map(r => [r.key, r.value])), online: onlineRows, me: meRows[0] || null });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const clientId = String(body.clientId || '').trim().slice(0, 80);
      if (!clientId) return json({ ok: false, error: 'client_id_required' }, 400);

      const name = cleanName(body.name);
      const x = Math.max(-33, Math.min(33, finite(body.x, 0)));
      const z = Math.max(-33, Math.min(33, finite(body.z, 12)));
      const inventory = body.inventory || {};
      const wood = nonNegativeInt(inventory.wood);
      const stone = nonNegativeInt(inventory.stone);
      const herbs = nonNegativeInt(inventory.herbs);

      const players = await sql`
        INSERT INTO players (client_id, display_name, x, z, last_seen_at)
        VALUES (${clientId}, ${name}, ${x}, ${z}, now())
        ON CONFLICT (client_id) DO UPDATE SET display_name = EXCLUDED.display_name, x = EXCLUDED.x, z = EXCLUDED.z, last_seen_at = now()
        RETURNING id
      `;
      const playerId = players[0].id;

      await sql`
        INSERT INTO player_inventory (player_id, wood, stone, herbs, updated_at)
        VALUES (${playerId}, ${wood}, ${stone}, ${herbs}, now())
        ON CONFLICT (player_id) DO UPDATE SET wood = EXCLUDED.wood, stone = EXCLUDED.stone, herbs = EXCLUDED.herbs, updated_at = now()
      `;

      if (body.action === 'contribute_bridge') {
        const giveWood = Math.min(20, nonNegativeInt(body.wood));
        const giveStone = Math.min(10, nonNegativeInt(body.stone));
        if (giveWood + giveStone < 1) return json({ ok: false, error: 'nothing_to_contribute' }, 400);

        const inv = await sql`SELECT wood, stone FROM player_inventory WHERE player_id = ${playerId} LIMIT 1`;
        const haveWood = Number(inv[0]?.wood || 0);
        const haveStone = Number(inv[0]?.stone || 0);
        if (haveWood < giveWood || haveStone < giveStone) return json({ ok: false, error: 'not_enough_materials' }, 409);

        const currentRows = await sql`SELECT value FROM world_state WHERE key = 'western_crossing' LIMIT 1`;
        const current = currentRows[0]?.value || { wood: 0, stone: 0, woodGoal: 60, stoneGoal: 30, complete: false };
        if (current.complete) return json({ ok: true, crossing: current, contributed: { wood: 0, stone: 0 } });

        const woodGoal = Number(current.woodGoal || 60);
        const stoneGoal = Number(current.stoneGoal || 30);
        const acceptedWood = Math.min(giveWood, Math.max(0, woodGoal - Number(current.wood || 0)));
        const acceptedStone = Math.min(giveStone, Math.max(0, stoneGoal - Number(current.stone || 0)));
        if (acceptedWood + acceptedStone < 1) return json({ ok: true, crossing: { ...current, complete: true }, contributed: { wood: 0, stone: 0 } });

        await sql`UPDATE player_inventory SET wood = wood - ${acceptedWood}, stone = stone - ${acceptedStone}, updated_at = now() WHERE player_id = ${playerId}`;
        const nextWood = Number(current.wood || 0) + acceptedWood;
        const nextStone = Number(current.stone || 0) + acceptedStone;
        const complete = nextWood >= woodGoal && nextStone >= stoneGoal;
        const crossing = { wood: nextWood, stone: nextStone, woodGoal, stoneGoal, complete };
        await sql`UPDATE world_state SET value = ${JSON.stringify(crossing)}::jsonb, updated_at = now() WHERE key = 'western_crossing'`;
        await sql`INSERT INTO world_events (player_id, event_type, payload) VALUES (${playerId}, 'bridge_contribution', ${JSON.stringify({ wood: acceptedWood, stone: acceptedStone, complete })}::jsonb)`;
        if (complete) await sql`INSERT INTO world_events (player_id, event_type, payload) VALUES (${playerId}, 'western_crossing_completed', ${JSON.stringify({ day: 2 })}::jsonb)`;
        return json({ ok: true, crossing, contributed: { wood: acceptedWood, stone: acceptedStone } });
      }

      if (body.event && typeof body.event.type === 'string') {
        const eventType = body.event.type.replace(/[^a-z0-9_.-]/gi, '').slice(0, 40);
        const payload = JSON.stringify(body.event.payload || {});
        if (eventType) await sql`INSERT INTO world_events (player_id, event_type, payload) VALUES (${playerId}, ${eventType}, ${payload}::jsonb)`;
      }

      const online = await sql`SELECT count(*)::int AS count FROM players WHERE last_seen_at > now() - interval '90 seconds'`;
      return json({ ok: true, playerId, online: online[0]?.count || 1 });
    }

    return json({ ok: false, error: 'method_not_allowed' }, 405);
  } catch (error) {
    console.error('GPTWorld API error', error);
    return json({ ok: false, error: 'world_api_failed' }, 500);
  }
};
