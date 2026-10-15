import {neon} from '@neondatabase/serverless';
import {resolveHunt} from '../lib/survival-core.mjs';
import {
  SHIPMENT_QUEST_ID,SHIPMENT_POINTS,SHIPMENT_REWARD,
  shipmentNext,shipmentNarrative,shipmentObjective,shipmentFeedback,
  shipmentNormalizeMeta,shipmentRewardFor,
  isShipmentClueAction,shipmentClueKey,shipmentCluePoint,shipmentClueAllowed
} from '../../lib/shipment-quest-core.mjs';

const respond=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const clean=(s,n=100)=>String(s||'').trim().slice(0,n);

async function ensure(sql){
 await sql`CREATE TABLE IF NOT EXISTS player_story_quests (
  player_id bigint NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  quest_key text NOT NULL,
  stage text NOT NULL DEFAULT 'not_started',
  choice text,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(player_id,quest_key)
 )`;
 await sql`ALTER TABLE player_story_quests ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb`;
}

async function actorFor(sql,clientId){
 const rows=await sql`SELECT p.id,p.display_name,p.x,p.z,COALESCE(i.coins,0) coins,COALESCE(i.stone,0) stone,COALESCE(i.wood,0) wood,COALESCE(i.herbs,0) herbs
 FROM players p LEFT JOIN player_inventory i ON i.player_id=p.id WHERE p.client_id=${clientId} LIMIT 1`;
 return rows[0];
}

function packQuest(row){
 const stage=row?.stage||'not_started';
 const meta=shipmentNormalizeMeta(row?.meta||{},stage);
 if(row?.choice==='bow'||row?.choice==='stealth')meta.choice=row.choice;
 return{
  key:SHIPMENT_QUEST_ID,
  stage,
  choice:row?.choice||meta.choice||null,
  started_at:row?.started_at||null,
  completed_at:row?.completed_at||null,
  meta,
  description:shipmentNarrative(stage,meta),
  objective:shipmentObjective(stage,meta)
 };
}

async function read(sql,actor){
 const rows=await sql`SELECT stage,choice,started_at,completed_at,meta FROM player_story_quests
 WHERE player_id=${actor.id} AND quest_key=${SHIPMENT_QUEST_ID}`;
 const quest=packQuest(rows[0]);
 return{ok:true,quest,
  player:{coins:Number(actor.coins||0),stone:Number(actor.stone||0),wood:Number(actor.wood||0),herbs:Number(actor.herbs||0)}};
}

function atPoint(actor,point){return Math.hypot(Number(actor.x)-point.x,Number(actor.z)-point.z)<=6.5;}

export default async req=>{
 if(!process.env.DATABASE_URL)return respond({ok:false,error:'database_not_configured'},503);
 if(!['GET','POST'].includes(req.method))return respond({ok:false,error:'method_not_allowed'},405);
 const sql=neon(process.env.DATABASE_URL);
 try{
  const url=new URL(req.url),body=req.method==='POST'?await req.json().catch(()=>({})):{};
  const clientId=clean(req.method==='GET'?url.searchParams.get('clientId'):body.clientId,80);
  if(!clientId)return respond({ok:false,error:'client_id_required'},400);
  await ensure(sql);
  let actor=await actorFor(sql,clientId);
  if(!actor)return respond({ok:false,error:'player_not_registered'},404);
  if(req.method==='GET')return respond(await read(sql,actor));

  const action=clean(body.action,35),key=clean(body.idempotencyKey,90);
  if(!key)return respond({ok:false,error:'idempotency_key_required'},400);

  const session=await sql`SELECT current_world_type FROM player_world_sessions WHERE player_id=${actor.id} LIMIT 1`;
  if(session[0]?.current_world_type==='private')return respond({ok:false,error:'return_to_public_world'},409);

  const record=await read(sql,actor);
  let stage=record.quest.stage;
  let meta=shipmentNormalizeMeta(record.quest.meta,stage);

  // Optional exploration clues — do not advance the main stage.
  if(isShipmentClueAction(action)){
   if(!shipmentClueAllowed(stage))return respond({ok:false,error:'quest_action_unavailable',quest:record.quest},409);
   const clue=shipmentClueKey(action);
   const point=shipmentCluePoint(action);
   if(!point||!atPoint(actor,point))return respond({ok:false,error:'approach_quest_location',target:point},409);
   if(meta.clues.includes(clue)){
    return respond({...record,action,message:shipmentFeedback(action,record.quest),alreadyHad:true});
   }
   meta={...meta,clues:[...meta.clues,clue]};
   const rows=await sql`UPDATE player_story_quests SET meta=${JSON.stringify(meta)}::jsonb,updated_at=now()
    WHERE player_id=${actor.id} AND quest_key=${SHIPMENT_QUEST_ID} AND stage=${stage}
    RETURNING stage`;
   if(!rows.length){
    // Quest accepted mid-flight — create row if player somehow has no row yet.
    if(stage==='not_started')return respond({ok:false,error:'quest_action_unavailable',quest:record.quest},409);
    return respond({ok:false,error:'quest_state_changed'},409);
   }
   // Small material find for looking around (idempotent via clue membership).
   if(clue==='axle')await sql`UPDATE player_inventory SET stone=stone+1,updated_at=now() WHERE player_id=${actor.id}`;
   if(clue==='scrap')await sql`UPDATE player_inventory SET wood=wood+1,updated_at=now() WHERE player_id=${actor.id}`;
   if(clue==='rumor')await sql`UPDATE player_inventory SET herbs=herbs+1,updated_at=now() WHERE player_id=${actor.id}`;
   actor=await actorFor(sql,clientId);
   const result=await read(sql,actor);
   return respond({...result,action,message:shipmentFeedback(action,result.quest),clue});
  }

  const position=SHIPMENT_POINTS[({
   turn_in:'tovan',inspect_tracks:'tracks',recover:'cache',fight_wolf:'wolf',avoid_wolf:'wolf'
  })[action]];

  const equipped=action==='fight_wolf'?await sql`
   SELECT 1 FROM player_equipped_items e
   JOIN player_crafted_items item ON item.id=e.item_id
   WHERE e.player_id=${actor.id} AND e.slot='mainHand' AND item.player_id=${actor.id}
   AND item.placed_at IS NULL AND item.item_key IN ('basic-bow','reinforced-bow','composite-bow') LIMIT 1
  `:null;
  const hasBow=Boolean(equipped?.length);
  const next=shipmentNext(stage,action,{hasBow});
  if(!next)return respond({ok:false,error:action==='fight_wolf'&&!hasBow?'equip_bow_first':'quest_action_unavailable',quest:record.quest},409);
  if(position&&!atPoint(actor,position))return respond({ok:false,error:'approach_quest_location',target:position},409);

  let combat=null;
  if(action==='fight_wolf'){
    const [weapon,skills]=await Promise.all([
      sql`SELECT i.item_key FROM player_equipped_items e JOIN player_crafted_items i ON i.id=e.item_id WHERE e.player_id=${actor.id} AND e.slot='mainHand' AND i.placed_at IS NULL LIMIT 1`,
      sql`SELECT skill_key,skill_value FROM player_crafting_skills WHERE player_id=${actor.id} AND skill_key IN ('hunting','archery')`
    ]);
    const values=Object.fromEntries(skills.map(row=>[row.skill_key,Number(row.skill_value)]));
    const moodBias=meta.variant?.wolfMood==='territorial'?0.08:meta.variant?.wolfMood==='wounded'?-0.05:0;
    combat=resolveHunt({key:`shipment:${actor.id}:${key}`,species:'wolf',kind:'predator',skill:(values.hunting||0)*.65+(values.archery||0)*.35,
      equipment:weapon[0]?.item_key||'basic-bow',distance:2.8,noise:.3+moodBias,tracked:true,stalked:true});
    if(!combat.success){
      await sql`INSERT INTO player_crafting_skills(player_id,skill_key) VALUES(${actor.id},'archery') ON CONFLICT DO NOTHING`;
      await sql`UPDATE player_crafting_skills SET skill_value=LEAST(100,skill_value+${Math.max(.2,combat.xp)}),attempts=attempts+1,updated_at=now()
        WHERE player_id=${actor.id} AND skill_key='archery'`;
      return respond({...record,combat:{success:false,chance:combat.chance,xp:combat.xp},message:'Your arrow misses or glances off. The wolf stays near the wagon. Try again or sneak past.'});
    }
  }

  if(action==='accept'){
   const seed=Math.floor(Math.random()*100000);
   meta=shipmentNormalizeMeta({run:1,seed,clues:[],choice:null,completions:meta.completions||0},'tracking');
   await sql`INSERT INTO player_story_quests(player_id,quest_key,stage,started_at,meta)
    VALUES(${actor.id},${SHIPMENT_QUEST_ID},'tracking',now(),${JSON.stringify(meta)}::jsonb)
    ON CONFLICT(player_id,quest_key) DO NOTHING`;
   // If a prior row existed at not_started (shouldn't), still advance once.
   await sql`UPDATE player_story_quests SET stage='tracking',started_at=COALESCE(started_at,now()),
    meta=${JSON.stringify(meta)}::jsonb,updated_at=now()
    WHERE player_id=${actor.id} AND quest_key=${SHIPMENT_QUEST_ID} AND stage='not_started'`;
  }else if(action==='replay'){
   const seed=Math.floor(Math.random()*100000);
   const nextMeta=shipmentNormalizeMeta({
    run:(meta.run||1)+1,
    seed,
    clues:[],
    choice:null,
    completions:Math.max(1,meta.completions||1)
   },'tracking');
   const rows=await sql`UPDATE player_story_quests SET stage='tracking',choice=NULL,started_at=now(),
    meta=${JSON.stringify(nextMeta)}::jsonb,updated_at=now()
    WHERE player_id=${actor.id} AND quest_key=${SHIPMENT_QUEST_ID} AND stage='completed'
    RETURNING stage`;
   if(!rows.length)return respond({ok:false,error:'quest_state_changed'},409);
  }else if(action==='turn_in'){
   await sql`INSERT INTO player_crafting_skills(player_id,skill_key) VALUES(${actor.id},'blacksmithing') ON CONFLICT DO NOTHING`;
   const provisional={...record.quest,stage:'completed',meta:{...meta,choice:record.quest.choice||meta.choice}};
   const reward=shipmentRewardFor(provisional);
   const nextMeta=shipmentNormalizeMeta({
    ...meta,
    choice:record.quest.choice||meta.choice,
    completions:(meta.completions||0)+1
   },'completed');
   const done=await sql`
    WITH advanced AS (
     UPDATE player_story_quests SET stage='completed',completed_at=now(),updated_at=now(),
      meta=${JSON.stringify(nextMeta)}::jsonb
     WHERE player_id=${actor.id} AND quest_key=${SHIPMENT_QUEST_ID} AND stage='shipment_recovered'
     RETURNING player_id
    ), payout AS (
     UPDATE player_inventory SET
      coins=coins+${reward.coins},
      stone=stone+${reward.stone},
      wood=wood+${reward.wood||0},
      herbs=herbs+${reward.herbs||0},
      updated_at=now()
     WHERE player_id=${actor.id} AND EXISTS(SELECT 1 FROM advanced) RETURNING coins,stone,wood,herbs
    ), smith AS (
     UPDATE player_crafting_skills SET skill_value=LEAST(100,skill_value+${reward.blacksmithingXp}),updated_at=now()
     WHERE player_id=${actor.id} AND skill_key='blacksmithing' AND EXISTS(SELECT 1 FROM payout)
     RETURNING skill_value
    )
    SELECT payout.coins,payout.stone,payout.wood,payout.herbs FROM payout
   `;
   if(!done.length)return respond({ok:false,error:'reward_unavailable_retry'},409);
   if(reward.archeryXp>0){
    await sql`INSERT INTO player_crafting_skills(player_id,skill_key) VALUES(${actor.id},'archery') ON CONFLICT DO NOTHING`;
    await sql`UPDATE player_crafting_skills SET skill_value=LEAST(100,skill_value+${reward.archeryXp}),updated_at=now()
     WHERE player_id=${actor.id} AND skill_key='archery'`;
   }
  }else{
   const chosen=action==='fight_wolf'?'bow':action==='avoid_wolf'?'stealth':null;
   if(chosen)meta={...meta,choice:chosen};
   const rows=await sql`UPDATE player_story_quests SET stage=${next},choice=COALESCE(${chosen},choice),
    meta=${JSON.stringify(meta)}::jsonb,updated_at=now()
    WHERE player_id=${actor.id} AND quest_key=${SHIPMENT_QUEST_ID} AND stage=${stage}
    RETURNING stage`;
   if(!rows.length)return respond({ok:false,error:'quest_state_changed'},409);
   if(action==='fight_wolf'){
    await sql`INSERT INTO player_crafting_skills(player_id,skill_key) VALUES(${actor.id},'archery') ON CONFLICT DO NOTHING`;
    await sql`UPDATE player_crafting_skills SET skill_value=LEAST(100,skill_value+${combat?.xp||SHIPMENT_REWARD.archeryXp}),attempts=attempts+1,updated_at=now()
      WHERE player_id=${actor.id} AND skill_key='archery'`;
   }
  }

  actor=await actorFor(sql,clientId);
  const result=await read(sql,actor);
  const reward=next==='completed'?shipmentRewardFor(result.quest):null;
  return respond({
   ...result,
   action,
   combat:combat?{success:true,chance:combat.chance,xp:combat.xp}:null,
   reward,
   message:shipmentFeedback(action,result.quest)
  });
 }catch(error){
  console.error('Shipment quest failed',error);
  return respond({ok:false,error:'quest_request_failed'},500);
 }
};
