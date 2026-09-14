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

    const rows=await sql`
      WITH deduct AS (
        UPDATE player_inventory
        SET wood=wood-${dw}::int, stone=stone-${ds}::int, herbs=herbs-${dh}::int, updated_at=now()
        WHERE player_id=${playerId}::bigint
          AND wood>=${dw}::int AND stone>=${ds}::int AND herbs>=${dh}::int
        RETURNING wood,stone,herbs
      ), updated AS (
        UPDATE world_state ws
        SET value=jsonb_build_object(
          'wood',COALESCE((ws.value->>'wood')::int,0)+${dw}::int,
          'stone',COALESCE((ws.value->>'stone')::int,0)+${ds}::int,
          'herbs',COALESCE((ws.value->>'herbs')::int,0)+${dh}::int
        ), updated_at=now()
        FROM deduct
        WHERE ws.key='settlement_stockpile'
        RETURNING ws.value, deduct.wood, deduct.stone, deduct.herbs
      ), logged AS (
        INSERT INTO world_events (player_id,event_type,payload)
        SELECT ${playerId}::bigint,'stockpile_deposit',jsonb_build_object('resource',${resource}::text,'amount',${amount}::int)
        FROM updated
        RETURNING id
      )
      SELECT updated.value,updated.wood,updated.stone,updated.herbs,logged.id AS event_id
      FROM updated,logged`;

    if(!rows.length)return reply({ok:false,error:'not_enough_materials'},409);
    const r=rows[0],s=r.value||{};
    return reply({ok:true,deposited:{resource,amount},stockpile:{wood:Number(s.wood||0),stone:Number(s.stone||0),herbs:Number(s.herbs||0)},inventory:{wood:Number(r.wood||0),stone:Number(r.stone||0),herbs:Number(r.herbs||0)}});
  }catch(err){
    console.error('GPTWorld stockpile error',err);
    return reply({ok:false,error:'stockpile_failed',detail:String(err?.message||err||'unknown').slice(0,180)},500);
  }
};
