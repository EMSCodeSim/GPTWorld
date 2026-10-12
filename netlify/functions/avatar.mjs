import {neon} from '@neondatabase/serverless';

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const clean=(value,n=90)=>String(value??'').trim().slice(0,n);
const SLOTS=['head','chest','legs','feet','back','mainHand','offHand'];
const slotFor=key=>{
  const name=String(key||'').toLowerCase();
  if(/bow|sword|knife|dagger|axe|spear|staff|club|hammer|pickaxe|mace|wand|crossbow/.test(name))return ['mainHand'];
  if(/shield|buckler|torch|lantern/.test(name))return ['offHand'];
  if(/helmet|helm|hood|hat|cap/.test(name))return ['head'];
  if(/tunic|shirt|robe|armor|armour|vest|coat|chestplate/.test(name))return ['chest'];
  if(/pants|trousers|leggings|greaves|skirt/.test(name))return ['legs'];
  if(/boots|shoes|sandals/.test(name))return ['feet'];
  if(/cloak|cape|backpack|satchel|quiver/.test(name))return ['back'];
  return [];
};
async function schema(sql){
  await sql`CREATE TABLE IF NOT EXISTS player_equipped_items(
    player_id bigint NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    slot text NOT NULL CHECK(slot IN ('head','chest','legs','feet','back','mainHand','offHand')),
    item_id bigint NOT NULL REFERENCES player_crafted_items(id) ON DELETE CASCADE,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(player_id,slot),
    UNIQUE(player_id,item_id)
  )`;
}
async function player(sql,clientId){
  const rows=await sql`SELECT id,display_name FROM players WHERE client_id=${clientId} LIMIT 1`;
  return rows[0]||null;
}
async function snapshot(sql,actor){
  const [items,equipped,resources]=await Promise.all([
    sql`SELECT id,item_key,display_name,quality,durability,max_durability,quantity,placed_at
       FROM player_crafted_items WHERE player_id=${actor.id} ORDER BY crafted_at DESC LIMIT 160`,
    sql`SELECT e.slot,e.item_id FROM player_equipped_items e JOIN player_crafted_items i ON i.id=e.item_id
       WHERE e.player_id=${actor.id} AND i.player_id=${actor.id} AND i.placed_at IS NULL`,
    sql`SELECT wood,stone,herbs,coins FROM player_inventory WHERE player_id=${actor.id} LIMIT 1`
  ]);
  const slots=Object.fromEntries(SLOTS.map(slot=>[slot,null]));
  for(const row of equipped)slots[row.slot]=String(row.item_id);
  return {ok:true,name:actor.display_name,slots,items:items.map(row=>({
    id:String(row.id),key:row.item_key,name:row.display_name,quality:row.quality,
    durability:Number(row.durability||0),maxDurability:Number(row.max_durability||0),
    quantity:Number(row.quantity||1),placed:Boolean(row.placed_at),eligibleSlots:slotFor(row.item_key)
  })),resources:resources[0]||{wood:0,stone:0,herbs:0,coins:0}};
}
export default async req=>{
  if(!process.env.DATABASE_URL)return json({ok:false,error:'database_not_configured'},503);
  if(!['GET','POST'].includes(req.method))return json({ok:false,error:'method_not_allowed'},405);
  try{
    const sql=neon(process.env.DATABASE_URL),url=new URL(req.url);
    const body=req.method==='POST'?await req.json().catch(()=>({})):{};
    const clientId=clean(req.method==='GET'?url.searchParams.get('clientId'):body.clientId);
    if(!clientId)return json({ok:false,error:'client_id_required'},400);
    const actor=await player(sql,clientId);
    if(!actor)return json({ok:false,error:'player_not_registered'},404);
    await schema(sql);
    if(req.method==='POST'){
      const action=clean(body.action,25),slot=clean(body.slot,20),itemId=clean(body.itemId,30);
      if(!SLOTS.includes(slot))return json({ok:false,error:'invalid_equipment_slot'},400);
      if(action==='unequip'){
        await sql`DELETE FROM player_equipped_items WHERE player_id=${actor.id} AND slot=${slot}`;
      }else if(action==='equip'){
        if(!/^\d+$/.test(itemId))return json({ok:false,error:'invalid_item'},400);
        const rows=await sql`SELECT id,item_key FROM player_crafted_items
           WHERE id=${itemId} AND player_id=${actor.id} AND placed_at IS NULL AND quantity>0 LIMIT 1`;
        if(!rows.length)return json({ok:false,error:'item_not_in_backpack'},409);
        if(!slotFor(rows[0].item_key).includes(slot))return json({ok:false,error:'wrong_equipment_slot'},409);
        // An item cannot occupy two slots. Save ownership checks and replacement on the server.
        await sql`DELETE FROM player_equipped_items WHERE player_id=${actor.id} AND item_id=${itemId}`;
        await sql`INSERT INTO player_equipped_items(player_id,slot,item_id)
          VALUES(${actor.id},${slot},${itemId})
          ON CONFLICT(player_id,slot) DO UPDATE SET item_id=EXCLUDED.item_id,updated_at=now()`;
      }else return json({ok:false,error:'invalid_action'},400);
    }
    return json(await snapshot(sql,actor));
  }catch(error){
    console.error('GPTWorld avatar equipment',error);
    return json({ok:false,error:'avatar_request_failed'},500);
  }
};
