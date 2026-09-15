import { neon } from '@neondatabase/serverless';
import { ecologyRenderEntities, simulationSummary } from './_sim-core.mjs';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

const cleanName = (value) => String(value || 'Traveler').replace(/[<>]/g, '').trim().slice(0, 20) || 'Traveler';
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const cleanInt = (value, max = 100000) => Math.max(0, Math.min(max, Math.floor(finite(value, 0))));

function entityArray(world) {
  const entities = world.world_entities;
  if (!entities || typeof entities !== 'object' || Array.isArray(entities)) return [];
  return Object.entries(entities).map(([entity_id, value]) => ({ entity_id, ...(value || {}) }));
}

function baseRenderEntities(value){
  if(Array.isArray(value)) return value;
  if(Array.isArray(value?.entities)) return value.entities;
  return [];
}

export default async (req) => {
  if (!process.env.DATABASE_URL) return json({ ok: false, error: 'database_not_configured' }, 503);
  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const clientId = String(url.searchParams.get('clientId') || '').trim().slice(0, 80);
      const [worldRows, onlineRows, meRows] = await Promise.all([
        sql`SELECT key, value FROM world_state ORDER BY key`,
        sql`SELECT client_id, display_name, x, z, last_seen_at FROM players WHERE last_seen_at > now() - interval '90 seconds' ORDER BY last_seen_at DESC LIMIT 50`,
        clientId ? sql`SELECT p.client_id, p.display_name, p.x, p.z, i.wood, i.stone, i.herbs FROM players p LEFT JOIN player_inventory i ON i.player_id = p.id WHERE p.client_id = ${clientId} LIMIT 1` : Promise.resolve([])
      ]);
      const world = Object.fromEntries(worldRows.map(row => [row.key, row.value]));
      const persistent=baseRenderEntities(world.render_entities).filter(e=>!String(e?.id||'').startsWith('eco-'));
      world.render_entities=[...persistent,...ecologyRenderEntities(world.ecosystem)];
      return json({ ok: true, world, simulations: simulationSummary(world), entities: entityArray(world), online: onlineRows, me: meRows[0] || null });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const clientId = String(body.clientId || '').trim().slice(0, 80);
      if (!clientId) return json({ ok: false, error: 'client_id_required' }, 400);

      const name = cleanName(body.name);
      const x = Math.max(-33, Math.min(33, finite(body.x, 0)));
      const z = Math.max(-33, Math.min(33, finite(body.z, 12)));
      const players = await sql`
        INSERT INTO players (client_id, display_name, x, z, last_seen_at)
        VALUES (${clientId}, ${name}, ${x}, ${z}, now())
        ON CONFLICT (client_id) DO UPDATE SET display_name = EXCLUDED.display_name, x = EXCLUDED.x, z = EXCLUDED.z, last_seen_at = now()
        RETURNING id
      `;
      const playerId = players[0].id;
      await sql`INSERT INTO player_inventory (player_id, wood, stone, herbs, updated_at) VALUES (${playerId}, 0, 0, 0, now()) ON CONFLICT (player_id) DO NOTHING`;

      if (body.action === 'contribute_bridge') {
        const giveWood = Math.min(20, cleanInt(body.wood, 20));
        const giveStone = Math.min(10, cleanInt(body.stone, 10));
        if (giveWood + giveStone < 1) return json({ ok: false, error: 'nothing_to_contribute' }, 400);

        const result = await sql`
          WITH current AS (
            SELECT value FROM world_state WHERE key = 'western_crossing' FOR UPDATE
          ), calc AS (
            SELECT
              LEAST(${giveWood}::int, GREATEST(0, COALESCE((value->>'woodGoal')::int, 60) - COALESCE((value->>'wood')::int, 0))) AS accepted_wood,
              LEAST(${giveStone}::int, GREATEST(0, COALESCE((value->>'stoneGoal')::int, 30) - COALESCE((value->>'stone')::int, 0))) AS accepted_stone,
              COALESCE((value->>'wood')::int, 0) AS current_wood,
              COALESCE((value->>'stone')::int, 0) AS current_stone,
              COALESCE((value->>'woodGoal')::int, 60) AS wood_goal,
              COALESCE((value->>'stoneGoal')::int, 30) AS stone_goal,
              COALESCE((value->>'complete')::boolean, false) AS already_complete
            FROM current
          ), deduct AS (
            UPDATE player_inventory pi
            SET wood = wood - calc.accepted_wood, stone = stone - calc.accepted_stone, updated_at = now()
            FROM calc
            WHERE pi.player_id = ${playerId} AND NOT calc.already_complete
              AND pi.wood >= calc.accepted_wood AND pi.stone >= calc.accepted_stone
              AND (calc.accepted_wood + calc.accepted_stone) > 0
            RETURNING calc.*
          ), updated AS (
            UPDATE world_state ws
            SET value = jsonb_build_object(
              'wood', deduct.current_wood + deduct.accepted_wood,
              'stone', deduct.current_stone + deduct.accepted_stone,
              'woodGoal', deduct.wood_goal,
              'stoneGoal', deduct.stone_goal,
              'complete', (deduct.current_wood + deduct.accepted_wood >= deduct.wood_goal AND deduct.current_stone + deduct.accepted_stone >= deduct.stone_goal)
            ), updated_at = now()
            FROM deduct WHERE ws.key = 'western_crossing'
            RETURNING ws.value, deduct.accepted_wood, deduct.accepted_stone
          ), logged AS (
            INSERT INTO world_events (player_id, event_type, payload)
            SELECT ${playerId}, 'bridge_contribution', jsonb_build_object('wood', accepted_wood, 'stone', accepted_stone, 'complete', (value->>'complete')::boolean) FROM updated
            UNION ALL
            SELECT ${playerId}, 'western_crossing_completed', jsonb_build_object('day', 2) FROM updated WHERE (value->>'complete')::boolean = true
            RETURNING id
          ) SELECT value, accepted_wood, accepted_stone FROM updated
        `;

        if (!result.length) {
          const currentRows = await sql`SELECT value FROM world_state WHERE key = 'western_crossing' LIMIT 1`;
          const current = currentRows[0]?.value || { wood: 0, stone: 0, woodGoal: 60, stoneGoal: 30, complete: false };
          if (current.complete) return json({ ok: true, crossing: current, contributed: { wood: 0, stone: 0 } });
          return json({ ok: false, error: 'not_enough_materials' }, 409);
        }

        const row = result[0];
        return json({ ok: true, crossing: row.value, contributed: { wood: Number(row.accepted_wood || 0), stone: Number(row.accepted_stone || 0) } });
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
    console.error('GPTWorld world-v2 error', error);
    return json({ ok: false, error: 'world_api_failed' }, 500);
  }
};
