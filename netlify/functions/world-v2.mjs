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

function decayTrailMarker(entity, nowMs){
  if(!String(entity?.id||'').startsWith('trail-marker-')) return entity;
  const createdAt=Date.parse(String(entity.createdAt||''));
  if(!Number.isFinite(createdAt)) return entity;
  const lifespanDays=Math.max(1,Number(entity.decayDays||14));
  const ageDays=Math.max(0,(nowMs-createdAt)/86400000);
  if(ageDays>=lifespanDays) return null;
  const progress=Math.max(0,Math.min(1,ageDays/lifespanDays));
  let stage='fresh',color='#765236',height=2.1,width=.22,depth=.22;
  if(progress>=.8){stage='crumbling';color='#4f463a';height=1.12;width=.18;depth=.18}
  else if(progress>=.55){stage='worn';color='#625342';height=1.55;width=.2;depth=.2}
  else if(progress>=.3){stage='weathered';color='#6b5944';height=1.85;width=.21;depth=.21}
  return {...entity,color,height,width,depth,decayStage:stage,decayProgress:Number(progress.toFixed(3))};
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
      const nowMs=Date.now();
      const persistent=baseRenderEntities(world.render_entities)
        .filter(e=>!String(e?.id||'').startsWith('eco-'))
        .map(e=>decayTrailMarker(e,nowMs))
        .filter(Boolean);
      world.render_entities=[...persistent,...ecologyRenderEntities(world.ecosystem,nowMs,world.weather_sim,meRows[0]||null)];
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

      if (body.action === 'place_trail_marker') {
        const result = await sql`
          WITH current AS (
            SELECT value FROM world_state WHERE key = 'render_entities' FOR UPDATE
          ), deduct AS (
            UPDATE player_inventory
            SET wood = wood - 2, stone = stone - 1, updated_at = now()
            WHERE player_id = ${playerId} AND wood >= 2 AND stone >= 1
            RETURNING wood, stone, herbs
          ), updated AS (
            UPDATE world_state ws
            SET value = jsonb_set(
              COALESCE(ws.value, '{"entities":[]}'::jsonb),
              '{entities}',
              COALESCE(ws.value->'entities','[]'::jsonb) || jsonb_build_array(jsonb_build_object(
                'id', 'trail-marker-' || ${playerId}::text || '-' || floor(extract(epoch from clock_timestamp())*1000)::bigint::text,
                'type','object','x',${x},'z',${z},'width',0.22,'height',2.1,'depth',0.22,'color','#765236',
                'label','Traveler trail marker','createdDay',5,'createdBy',${name},'createdAt',to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'decayDays',14
              )), updated_at = now()
            FROM current, deduct WHERE ws.key = 'render_entities'
            RETURNING ws.value, deduct.wood, deduct.stone, deduct.herbs
          ), logged AS (
            INSERT INTO world_events(player_id,event_type,payload)
            SELECT ${playerId}, 'trail_marker_placed', jsonb_build_object('x',${x},'z',${z},'day',5,'cost',jsonb_build_object('wood',2,'stone',1),'decayDays',14) FROM updated
            RETURNING id
          ) SELECT value,wood,stone,herbs FROM updated
        `;
        if (!result.length) return json({ ok:false, error:'not_enough_materials' },409);
        return json({ ok:true, inventory:{wood:Number(result[0].wood||0),stone:Number(result[0].stone||0),herbs:Number(result[0].herbs||0)}, render_entities:result[0].value });
      }

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
