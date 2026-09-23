import { neon } from '@neondatabase/serverless';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

const DAY = 12;
const ENTITIES = [
  {
    id: 'firebreak-stone-spur',
    type: 'trail',
    points: [[-29.5, 10.5], [-30.1, 12.3], [-30.4, 14.5]],
    width: 0.9,
    color: '#756a5d',
    label: 'Firebreak stone spur'
  },
  {
    id: 'firebreak-stone-marker',
    type: 'object',
    x: -30.2,
    z: 13.0,
    width: 0.28,
    height: 1.55,
    depth: 0.28,
    color: '#6e665c',
    label: 'Stone spur marker'
  },
  {
    id: 'firebreak-scree-stone-1',
    type: 'resource',
    resource: 'stone',
    x: -31.1,
    z: 14.2,
    scale: 0.9,
    max: 5,
    regrowMinutes: 720,
    label: 'Firebreak scree'
  },
  {
    id: 'firebreak-scree-stone-2',
    type: 'resource',
    resource: 'stone',
    x: -29.4,
    z: 15.1,
    scale: 0.82,
    max: 5,
    regrowMinutes: 720,
    label: 'Firebreak scree'
  }
];

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  if (!process.env.DATABASE_URL) return json({ ok: false, error: 'database_not_configured' }, 503);

  const sql = neon(process.env.DATABASE_URL);

  try {
    const dayRows = await sql`SELECT value FROM world_state WHERE key = 'current_day' LIMIT 1`;
    const currentDay = Number(dayRows[0]?.value?.day || 0);

    if (currentDay === DAY) {
      return json({ ok: true, already_released: true, day: DAY });
    }
    if (currentDay !== DAY - 1) {
      return json({ ok: false, error: 'unexpected_world_day', current_day: currentDay, expected: DAY - 1 }, 409);
    }

    const payload = JSON.stringify(ENTITIES);
    const result = await sql`
      WITH day_gate AS (
        SELECT value
        FROM world_state
        WHERE key = 'current_day'
          AND COALESCE((value->>'day')::int, 0) = ${DAY - 1}
        FOR UPDATE
      ),
      render_locked AS (
        SELECT value
        FROM world_state
        WHERE key = 'render_entities'
        FOR UPDATE
      ),
      render_updated AS (
        UPDATE world_state ws
        SET value = CASE
          WHEN jsonb_typeof(ws.value) = 'array'
            THEN ws.value || ${payload}::jsonb
          WHEN jsonb_typeof(ws.value->'entities') = 'array'
            THEN jsonb_set(ws.value, '{entities}', (ws.value->'entities') || ${payload}::jsonb, true)
          ELSE jsonb_build_object('entities', ${payload}::jsonb)
        END,
        updated_at = now()
        FROM day_gate, render_locked
        WHERE ws.key = 'render_entities'
          AND NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(
              CASE
                WHEN jsonb_typeof(ws.value) = 'array' THEN ws.value
                WHEN jsonb_typeof(ws.value->'entities') = 'array' THEN ws.value->'entities'
                ELSE '[]'::jsonb
              END
            ) entity
            WHERE entity->>'id' = 'firebreak-stone-spur'
          )
        RETURNING ws.value
      ),
      day_updated AS (
        UPDATE world_state ws
        SET value = jsonb_build_object('day', ${DAY}, 'era', COALESCE(day_gate.value->>'era', 'Founding Era')),
            updated_at = now()
        FROM day_gate, render_updated
        WHERE ws.key = 'current_day'
        RETURNING ws.value
      ),
      logged AS (
        INSERT INTO world_events (player_id, event_type, payload)
        SELECT NULL, 'day12_firebreak_stone_spur_opened',
          jsonb_build_object(
            'day', ${DAY},
            'reason', 'critical forest pressure and an unfinished wildfire defense project',
            'stoneNodes', 2,
            'stonePerNode', 5,
            'regrowMinutes', 720
          )
        FROM day_updated
        RETURNING id
      )
      SELECT
        day_updated.value AS day,
        (SELECT value FROM render_updated LIMIT 1) AS render_entities,
        (SELECT id FROM logged LIMIT 1) AS event_id
      FROM day_updated
    `;

    if (!result.length) {
      return json({ ok: false, error: 'release_not_applied' }, 409);
    }

    return json({
      ok: true,
      released: true,
      day: result[0].day,
      event_id: result[0].event_id,
      evolution: 'firebreak_stone_spur'
    });
  } catch (error) {
    console.error('GPTWorld Day 12 release failed', error);
    return json({ ok: false, error: 'day12_release_failed' }, 500);
  }
};
