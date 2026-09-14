import { neon } from '@neondatabase/serverless';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

const cleanInt = (value) => Math.max(0, Math.min(100000, Math.floor(Number.isFinite(Number(value)) ? Number(value) : 0)));

export default async (req) => {
  if (!process.env.DATABASE_URL) return json({ ok: false, error: 'database_not_configured' }, 503);
  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const clientId = String(url.searchParams.get('clientId') || '').trim().slice(0, 80);
      if (!clientId) return json({ ok: false, error: 'client_id_required' }, 400);

      const rows = await sql`
        SELECT p.client_id, i.wood, i.stone, i.herbs, i.updated_at
        FROM players p
        LEFT JOIN player_inventory i ON i.player_id = p.id
        WHERE p.client_id = ${clientId}
        LIMIT 1
      `;

      if (!rows.length) return json({ ok: true, inventory: null });
      const row = rows[0];
      return json({
        ok: true,
        inventory: {
          wood: Number(row.wood || 0),
          stone: Number(row.stone || 0),
          herbs: Number(row.herbs || 0),
          updated_at: row.updated_at || null
        }
      });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const clientId = String(body.clientId || '').trim().slice(0, 80);
      if (!clientId) return json({ ok: false, error: 'client_id_required' }, 400);

      const players = await sql`SELECT id FROM players WHERE client_id = ${clientId} LIMIT 1`;
      if (!players.length) return json({ ok: false, error: 'player_not_registered' }, 409);

      const playerId = players[0].id;
      const inventory = body.inventory || {};
      const wood = cleanInt(inventory.wood);
      const stone = cleanInt(inventory.stone);
      const herbs = cleanInt(inventory.herbs);

      await sql`
        INSERT INTO player_inventory (player_id, wood, stone, herbs, updated_at)
        VALUES (${playerId}, ${wood}, ${stone}, ${herbs}, now())
        ON CONFLICT (player_id) DO UPDATE SET
          wood = EXCLUDED.wood,
          stone = EXCLUDED.stone,
          herbs = EXCLUDED.herbs,
          updated_at = now()
      `;

      return json({ ok: true, inventory: { wood, stone, herbs } });
    }

    return json({ ok: false, error: 'method_not_allowed' }, 405);
  } catch (error) {
    console.error('GPTWorld resource-state error', error);
    return json({ ok: false, error: 'resource_state_failed' }, 500);
  }
};
