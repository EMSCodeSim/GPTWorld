import { neon } from '@neondatabase/serverless';
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const allowed=new Set(['wood','stone','herbs']);
const cleanAmount=v=>Math.max(1,Math.min(20,Math.floor(Number(v)||1)));
const cleanId=v=>String(v||'').trim().slice(0,80);

export default async req=>{
  if(!process.env.DATABASE_URL)return reply({ok:false,error:'database_not_configured'},503);
  const sql=neon(process.env.DATABASE_URL);
  try{
    await sql`INSERT INTO world_state (key,value,updated_at) VALUES ('settlement_stockpile','{"wood":0,"stone":0,"herbs":0}'::jsonb,now()) ON CONFLICT (key) DO NOTHING`;
    const url=new URL(req.url);
    const body=req.method==='POST'?await req.json():{};
    const clientId=cleanId(req.method==='POST'?body.clientId:url.searchParams.get('clientId'));
    const playerRows=clientId?await sql`SELECT id FROM players WHERE client_id=${clientId} LIMIT 1`:[];
    const playerId=playerRows[0]?.id||null;

    if(req.method==='GET'){
      const [stockRows,invRows]=await Promise.all([
        sql`SELECT value FROM world_state WHERE key='settlement_stockpile' LIMIT 1`,
        playerId?sql`SELECT wood,stone,herbs FROM player_inventory WHERE player_id=${playerId} LIMIT 1`:Promise.resolve([])
      ]);
      const s=stockRows[0]?.value||{};const i=invRows[0]||{};
      return reply({ok:true,stockpile:{wood:Number(s.wood||0),stone:Number(s.stone||0),herbs:Number(s.herbs||0)},inventory:playerId?{wood:Number(i.wood||0),stone:Number(i.stone||0),herbs:Number(i.herbs||0)}:null});
    }

    if(req.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);
    if(!clientId)return reply({ok:false,error:'client_id_required'},400);
    if(!playerId)return reply({ok:false,error:'player_not_registered'},409);
    if(body.action!=='deposit')return reply({ok:false,error:'invalid_action'},400);

    const resource=String(body.resource||'').toLowerCase().trim();
    if(!allowed.has(resource))return reply({ok:false,error:'invalid_resource'},400);
    const amount=cleanAmount(body.amount);
    const dw=resource==='wood'?amount:0,ds=resource==='stone'?amount:0,dh=resource==='herbs'?amount:0;

    const [inventoryRows,stockRows,eventRows]=await sql.transaction((txn)=>[
      txn`
        UPDATE player_inventory
        SET wood=wood-${dw},stone=stone-${ds},herbs=herbs-${dh},updated_at=now()
        WHERE player_id=${playerId} AND wood>=${dw} AND stone>=${ds} AND herbs>=${dh}
        RETURNING wood,stone,herbs,updated_at`,
      txn`
        UPDATE world_state w
        SET value=jsonb_build_object(
          'wood',COALESCE((w.value->>'wood')::int,0)+${dw},
          'stone',COALESCE((w.value->>'stone')::int,0)+${ds},
          'herbs',COALESCE((w.value->>'herbs')::int,0)+${dh}
        ),updated_at=now()
        WHERE w.key='settlement_stockpile'
          AND EXISTS (
            SELECT 1 FROM player_inventory pi
            WHERE pi.player_id=${playerId} AND pi.updated_at=now()
          )
        RETURNING w.value,w.updated_at`,
      txn`
        INSERT INTO world_events (player_id,event_type,payload)
        SELECT ${playerId},'stockpile_deposit',jsonb_build_object('resource',${resource},'amount',${amount})
        WHERE EXISTS (
          SELECT 1 FROM world_state ws
          WHERE ws.key='settlement_stockpile' AND ws.updated_at=now()
        )
        RETURNING id`
    ],{isolationLevel:'Serializable'});

    if(!inventoryRows.length||!stockRows.length||!eventRows.length)return reply({ok:false,error:'not_enough_materials'},409);
    const inv=inventoryRows[0],s=stockRows[0].value||{};
    return reply({ok:true,deposited:{resource,amount},stockpile:{wood:Number(s.wood||0),stone:Number(s.stone||0),herbs:Number(s.herbs||0)},inventory:{wood:Number(inv.wood||0),stone:Number(inv.stone||0),herbs:Number(inv.herbs||0)}});
  }catch(err){
    console.error('GPTWorld stockpile error',err);
    return reply({ok:false,error:'stockpile_failed',detail:String(err?.message||err||'unknown').slice(0,180)},500);
  }
};
