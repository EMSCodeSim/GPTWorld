import { neon } from '@neondatabase/serverless';
const buildings={inn:{name:'Wayfarer Inn',benefits:['Shelter for travelers','More guest rooms','Expanded gathering hall'],costs:[{wood:12,stone:5,herbs:0},{wood:28,stone:12,herbs:3}]},smithy:{name:'Smithy',benefits:['Basic smithy','Improved tool benches','Expanded forge'],costs:[{wood:10,stone:12,herbs:0},{wood:22,stone:26,herbs:0}]},storehouse:{name:'Storehouse',benefits:['Shared supplies','Reinforced storage','Expanded storage'],costs:[{wood:18,stone:8,herbs:0},{wood:35,stone:20,herbs:0}]},healer:{name:'Healer’s Cottage',benefits:['Basic treatment','Herbal workroom','Expanded clinic'],costs:[{wood:14,stone:6,herbs:8},{wood:30,stone:14,herbs:18}]},council:{name:'Council Hall',benefits:['Founding council','Community planning','Expanded council chamber'],costs:[{wood:20,stone:12,herbs:0},{wood:42,stone:25,herbs:4}]}};
const initial=Object.fromEntries(Object.keys(buildings).map(id=>[id,1]));
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const resources=value=>Object.fromEntries(['wood','stone','herbs'].map(key=>[key,Math.max(0,Number(value?.[key]||0))]));
export default async req=>{
 if(!process.env.DATABASE_URL)return reply({ok:false,error:'database_not_configured'},503);
 const sql=neon(process.env.DATABASE_URL);
 try{
  await sql`INSERT INTO world_state(key,value,updated_at) VALUES ('town_building_levels',${JSON.stringify(initial)}::jsonb,now()) ON CONFLICT(key) DO NOTHING`;
  await sql`INSERT INTO world_state(key,value,updated_at) VALUES ('settlement_stockpile','{"wood":0,"stone":0,"herbs":0}'::jsonb,now()) ON CONFLICT(key) DO NOTHING`;
  if(req.method==='GET'){
   const rows=await sql`SELECT key,value FROM world_state WHERE key IN ('town_building_levels','settlement_stockpile')`;
   const values=Object.fromEntries(rows.map(r=>[r.key,r.value]));
   return reply({ok:true,buildings,levels:{...initial,...values.town_building_levels},stockpile:resources(values.settlement_stockpile)});
  }
  if(req.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);
  const body=await req.json(),clientId=String(body.clientId||'').trim().slice(0,80),buildingId=String(body.buildingId||'');
  if(!clientId||!Object.hasOwn(buildings,buildingId))return reply({ok:false,error:'invalid_request'},400);
  const player=await sql`SELECT id FROM players WHERE client_id=${clientId} LIMIT 1`;
  if(!player.length)return reply({ok:false,error:'player_not_registered'},409);
  const first=buildings[buildingId].costs[0],second=buildings[buildingId].costs[1];
  // Lock the shared rows and debit ONLY settlement_stockpile, never player_inventory.
  const rows=await sql`
   WITH locked AS MATERIALIZED (
    SELECT key,value FROM world_state WHERE key IN ('settlement_stockpile','town_building_levels') ORDER BY key FOR UPDATE
   ), current AS (
    SELECT (SELECT value FROM locked WHERE key='town_building_levels') AS levels,
           (SELECT value FROM locked WHERE key='settlement_stockpile') AS stock
   ), cost AS (
    SELECT levels,stock,COALESCE((levels->>${buildingId})::int,1) AS level,
     CASE WHEN COALESCE((levels->>${buildingId})::int,1)=1 THEN ${first.wood}::int ELSE ${second.wood}::int END AS wood_cost,
     CASE WHEN COALESCE((levels->>${buildingId})::int,1)=1 THEN ${first.stone}::int ELSE ${second.stone}::int END AS stone_cost,
     CASE WHEN COALESCE((levels->>${buildingId})::int,1)=1 THEN ${first.herbs}::int ELSE ${second.herbs}::int END AS herbs_cost
    FROM current
   ), spent AS (
    UPDATE world_state ws SET value=jsonb_build_object(
     'wood',COALESCE((cost.stock->>'wood')::int,0)-cost.wood_cost,
     'stone',COALESCE((cost.stock->>'stone')::int,0)-cost.stone_cost,
     'herbs',COALESCE((cost.stock->>'herbs')::int,0)-cost.herbs_cost
    ),updated_at=now()
    FROM cost WHERE ws.key='settlement_stockpile' AND cost.level BETWEEN 1 AND 2
     AND COALESCE((cost.stock->>'wood')::int,0)>=cost.wood_cost
     AND COALESCE((cost.stock->>'stone')::int,0)>=cost.stone_cost
     AND COALESCE((cost.stock->>'herbs')::int,0)>=cost.herbs_cost
    RETURNING ws.value,cost.level,cost.wood_cost,cost.stone_cost,cost.herbs_cost
   ), upgraded AS (
    UPDATE world_state ws SET value=jsonb_set(ws.value,ARRAY[${buildingId}]::text[],to_jsonb(spent.level+1),true),updated_at=now()
    FROM spent WHERE ws.key='town_building_levels'
    RETURNING ws.value,spent.level,spent.wood_cost,spent.stone_cost,spent.herbs_cost
   ), logged AS (
    INSERT INTO world_events(player_id,event_type,payload)
    SELECT ${player[0].id}::bigint,'town_building_upgraded',jsonb_build_object('building',${buildingId}::text,'level',level+1,'wood',wood_cost,'stone',stone_cost,'herbs',herbs_cost)
    FROM upgraded RETURNING id
   ) SELECT upgraded.value AS levels,spent.value AS stockpile,upgraded.level+1 AS new_level FROM upgraded,spent,logged
  `;
  if(!rows.length)return reply({ok:false,error:'insufficient_storehouse_or_max_level'},409);
  return reply({ok:true,levels:rows[0].levels,stockpile:resources(rows[0].stockpile),buildingId,level:Number(rows[0].new_level)});
 }catch(error){console.error('town-upgrades',error);return reply({ok:false,error:'upgrade_failed'},500)}
};
