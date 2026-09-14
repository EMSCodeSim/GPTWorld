import { neon } from '@neondatabase/serverless';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

const ALLOWED_RESOURCES = new Set(['wood', 'stone', 'herbs']);
const cleanAmount = (value) => Math.max(1, Math.min(5, Math.floor(Number.isFinite(Number(value)) ? Number(value) : 1)));

async function getInventory(sql, playerId) {
  const rows = await sql`
    SELECT wood, stone, herbs, updated_at
    FROM player_inventory
    WHERE player_id = ${playerId}
    LIMIT 1
  `;
  const row = rows[0] || {};
  return {
    wood: Number(row.wood || 0),
    stone: Number(row.stone || 0),
    herbs: Number(row.herbs || 0),
    updated_at: row.updated_at || null
  };
}

export default async (req) => {
  if (!process.env.DATABASE_URL) return json({ ok: false, error: 'database_not_configured' }, 503);
  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const clientId = String(url.searchParams.get('clientId') || '').trim().slice(0, 80);
      if (!clientId) return json({ ok: false, error: 'client_id_required' }, 400);

      const players = await sql`SELECT id FROM players WHERE client_id = ${clientId} LIMIT 1`;
      if (!players.length) return json({ ok: true, inventory: null });
      const inventory = await getInventory(sql, players[0].id);
      return json({ ok: true, inventory });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const clientId = String(body.clientId || '').trim().slice(0, 80);
      if (!clientId) return json({ ok: false, error: 'client_id_required' }, 400);

      const players = await sql`SELECT id FROM players WHERE client_id = ${clientId} LIMIT 1`;
      if (!players.length) return json({ ok: false, error: 'player_not_registered' }, 409);
      const playerId = players[0].id;

      if (body.action !== 'gather') {
        return json({ ok: false, error: 'server_authoritative_inventory' }, 409);
      }

      const resource = String(body.resource || '').trim().toLowerCase();
      if (!ALLOWED_RESOURCES.has(resource)) return json({ ok: false, error: 'invalid_resource' }, 400);
      const amount = cleanAmount(body.amount);

      await sql`
        INSERT INTO player_inventory (player_id, wood, stone, herbs, updated_at)
        VALUES (
          ${playerId},
          ${resource === 'wood' ? amount : 0},
          ${resource === 'stone' ? amount : 0},
          ${resource === 'herbs' ? amount : 0},
          now()
        )
        ON CONFLICT (player_id) DO UPDATE SET
          wood = player_inventory.wood + ${resource === 'wood' ? amount : 0},
          stone = player_inventory.stone + ${resource === 'stone' ? amount : 0},
          herbs = player_inventory.herbs + ${resource === 'herbs' ? amount : 0},
          updated_at = now()
      `;

      await sql`
        INSERT INTO world_events (player_id, event_type, payload)
        VALUES (${playerId}, 'resource_gathered', ${JSON.stringify({ resource, amount })}::jsonb)
      `;

      const inventory = await getInventory(sql, playerId);
      return json({ ok: true, gathered: { resource, amount }, inventory });
    }

    return json({ ok: false, error: 'method_not_allowed' }, 405);
  } catch (error) {
    console.error('GPTWorld resource-state error', error);
    return json({ ok: false, error: 'resource_state_failed' }, 500);
  }
};
