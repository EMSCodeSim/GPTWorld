import { neon } from '@neondatabase/serverless';
import { advancePlantIndividuals, harvestIndividualPlant } from '../../lib/individual-plants.mjs';
// harvestIndividualPlant remains wired for plant-identity parity with resource-state gathers.
void harvestIndividualPlant;
import {
  initialEcosystem,
  evolveOneYear,
  applyPlantHabitats,
  applyFoodChainNeeds,
  applyPlantSeeds,
  applyPlantColonizationAndSuccession,
  applyMigrationAndTerritories,
  applyAnimalSocialAndBreeding
} from '../../lib/ecology-sim.mjs';
import { attachHallOfHistory } from '../../lib/hall-of-history.mjs';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

const cleanName = (value) => String(value || 'Traveler').replace(/[<>]/g, '').trim().slice(0, 20) || 'Traveler';
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const nonNegativeInt = (value) => Math.max(0, Math.min(100000, Math.floor(finite(value, 0))));

async function ensureAndAdvanceEcosystem(sql) {
  const seed = initialEcosystem();
  await sql`INSERT INTO world_state (key, value, updated_at) VALUES ('ecosystem', ${JSON.stringify(seed)}::jsonb, now()) ON CONFLICT (key) DO NOTHING`;
  const rows = await sql`SELECT value FROM world_state WHERE key = 'ecosystem' LIMIT 1`;
  let state = rows[0]?.value || seed;
  applyPlantHabitats(state);
  applyFoodChainNeeds(state);
  applyPlantSeeds(state);
  applyPlantColonizationAndSuccession(state);
  applyMigrationAndTerritories(state);
  applyAnimalSocialAndBreeding(state);
  state.wildlifeJournal ||= [];
  if (!Array.isArray(state.plantIndividuals)) { advancePlantIndividuals(state, Number(state.simulatedYear||0)); await sql`UPDATE world_state SET value = ${JSON.stringify(state)}::jsonb, updated_at=now() WHERE key='ecosystem'`; }
  const today = new Date().toISOString().slice(0, 10);
  if (state.lastRealDate !== today) {
    state = evolveOneYear(state);
    state.lastRealDate = today;
    attachHallOfHistory(state);
    await sql`UPDATE world_state SET value = ${JSON.stringify(state)}::jsonb, updated_at = now() WHERE key = 'ecosystem'`;
    await sql`INSERT INTO world_events (player_id, event_type, payload) VALUES (NULL, 'ecosystem_year_advanced', ${JSON.stringify({ simulatedYear: state.simulatedYear, species: state.species.length, extinct: state.extinct.length, hallEvents: state.hallOfHistory?.events?.length || 0 })}::jsonb)`;
  } else if (!state.hallOfHistory || Number(state.hallOfHistory?.rolling?.lastProcessedYear) !== Number(state.simulatedYear || 0)) {
    // Catch up observational history for existing worlds without replaying evolution.
    attachHallOfHistory(state);
    await sql`UPDATE world_state SET value = ${JSON.stringify(state)}::jsonb, updated_at = now() WHERE key = 'ecosystem'`;
  }
  return state;
}

export default async (req) => {
  if (!process.env.DATABASE_URL) return json({ ok: false, error: 'database_not_configured' }, 503);
  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const clientId = (url.searchParams.get('clientId') || '').slice(0, 80);
      const ecosystem = await ensureAndAdvanceEcosystem(sql);
      const [worldRows, onlineRows, meRows, entityRows] = await Promise.all([
        sql`SELECT key, value, updated_at FROM world_state ORDER BY key`,
        sql`SELECT CASE WHEN client_id=${clientId} THEN client_id ELSE 'public-'||id::text END AS client_id,display_name,x,z,last_seen_at FROM players WHERE last_seen_at > now() - interval '90 seconds' ORDER BY last_seen_at DESC LIMIT 50`,
        clientId ? sql`SELECT p.client_id, p.display_name, p.x, p.z, i.wood, i.stone, i.herbs FROM players p LEFT JOIN player_inventory i ON i.player_id = p.id WHERE p.client_id = ${clientId} LIMIT 1` : Promise.resolve([]),
        sql`SELECT entity_id, value, updated_at FROM world_entities ORDER BY entity_id`
      ]);
      return json({
        ok: true,
        world: Object.fromEntries(worldRows.map(r => [r.key, r.value])),
        ecosystem,
        entities: entityRows.map(r => ({ entity_id: r.entity_id, ...r.value, updated_at: r.updated_at })),
        online: onlineRows,
        me: meRows[0] || null
      });
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
        UPDATE players SET display_name=${name},x=${x},z=${z},last_seen_at=now()
        WHERE client_id=${clientId} RETURNING id
      `;
      if(!players.length)return json({ok:false,error:'player_not_registered'},409);
      const playerId = players[0].id;

      await sql`
        INSERT INTO player_inventory (player_id, wood, stone, herbs, updated_at)
        VALUES (${playerId}, ${wood}, ${stone}, ${herbs}, now())
        ON CONFLICT (player_id) DO UPDATE SET
          wood = GREATEST(player_inventory.wood, EXCLUDED.wood),
          stone = GREATEST(player_inventory.stone, EXCLUDED.stone),
          herbs = GREATEST(player_inventory.herbs, EXCLUDED.herbs),
          updated_at = now()
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
