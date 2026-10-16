import {neon} from '@neondatabase/serverless';
import {resolveHunt} from '../lib/survival-core.mjs';
import {
  ENCOUNTER_DEFS,encounterByKey,choiceById,canAfford,applyCost,applyReward,rewardSummary,
  regionAt,playerLevelFromSkills,pickEncounter,normalizeHistory,recentKeysFromHistory,
  cooldownsFromHistory,buildEncounterInstance,publicEncounterView,shouldTrace,
  ENCOUNTER_APPROACH_RADIUS,ENCOUNTER_CLUE_RADIUS,ENCOUNTER_SPAWN_CHANCE
} from '../../lib/world-encounters-core.mjs';

const respond=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const clean=(s,n=120)=>String(s||'').trim().slice(0,n);

async function ensure(sql){
  await sql`CREATE TABLE IF NOT EXISTS player_world_encounters (
    player_id bigint PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
    active jsonb,
    history jsonb NOT NULL DEFAULT '[]'::jsonb,
    traces jsonb NOT NULL DEFAULT '[]'::jsonb,
    favors jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS world_encounter_receipts (
    player_id bigint NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    idempotency_key text NOT NULL,
    action text NOT NULL,
    response jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(player_id, idempotency_key)
  )`;
}

async function actorFor(sql,clientId){
  const rows=await sql`SELECT p.id,p.display_name,p.x,p.z,
    COALESCE(i.coins,0) coins,COALESCE(i.stone,0) stone,COALESCE(i.wood,0) wood,COALESCE(i.herbs,0) herbs
    FROM players p LEFT JOIN player_inventory i ON i.player_id=p.id
    WHERE p.client_id=${clientId} LIMIT 1`;
  return rows[0]||null;
}

async function skillsFor(sql,playerId){
  const rows=await sql`SELECT skill_key,skill_value FROM player_crafting_skills WHERE player_id=${playerId}`;
  return rows.map(row=>({key:row.skill_key,value:Number(row.skill_value)}));
}

async function loadState(sql,playerId){
  const rows=await sql`SELECT active,history,traces,favors FROM player_world_encounters WHERE player_id=${playerId}`;
  if(!rows[0])return{active:null,history:[],traces:[],favors:{}};
  return{
    active:rows[0].active||null,
    history:normalizeHistory(rows[0].history||[]),
    traces:Array.isArray(rows[0].traces)?rows[0].traces:[],
    favors:rows[0].favors&&typeof rows[0].favors==='object'?rows[0].favors:{}
  };
}

async function saveState(sql,playerId,state){
  await sql`INSERT INTO player_world_encounters(player_id,active,history,traces,favors,updated_at)
    VALUES(${playerId},${state.active?JSON.stringify(state.active):null}::jsonb,
      ${JSON.stringify(normalizeHistory(state.history||[]))}::jsonb,
      ${JSON.stringify(state.traces||[])}::jsonb,
      ${JSON.stringify(state.favors||{})}::jsonb,now())
    ON CONFLICT(player_id) DO UPDATE SET
      active=EXCLUDED.active,history=EXCLUDED.history,traces=EXCLUDED.traces,favors=EXCLUDED.favors,updated_at=now()`;
}

function inventoryOf(actor){
  return{coins:Number(actor.coins||0),stone:Number(actor.stone||0),wood:Number(actor.wood||0),herbs:Number(actor.herbs||0)};
}

function near(actor,point,radius){
  if(!point)return false;
  return Math.hypot(Number(actor.x)-Number(point.x),Number(actor.z)-Number(point.z))<=radius;
}

function pack(actor,state,skills,extra={}){
  const def=encounterByKey(state.active?.key);
  return{
    ok:true,
    encounter:publicEncounterView(state.active,def),
    traces:state.traces||[],
    favors:state.favors||{},
    history:normalizeHistory(state.history).slice(-6),
    region:regionAt(actor.x,actor.z),
    level:playerLevelFromSkills(skills),
    player:inventoryOf(actor),
    ...extra
  };
}

async function saveReceipt(sql,playerId,key,action,response){
  await sql`INSERT INTO world_encounter_receipts(player_id,idempotency_key,action,response)
    VALUES(${playerId},${key},${action},${JSON.stringify(response)}::jsonb)
    ON CONFLICT DO NOTHING`;
}

async function readReceipt(sql,playerId,key){
  const rows=await sql`SELECT response FROM world_encounter_receipts WHERE player_id=${playerId} AND idempotency_key=${key} LIMIT 1`;
  return rows[0]?.response||null;
}

async function writeInventory(sql,playerId,inv){
  await sql`INSERT INTO player_inventory(player_id,wood,stone,herbs,coins,updated_at)
    VALUES(${playerId},${inv.wood||0},${inv.stone||0},${inv.herbs||0},${inv.coins||0},now())
    ON CONFLICT(player_id) DO UPDATE SET wood=${inv.wood||0},stone=${inv.stone||0},herbs=${inv.herbs||0},coins=${inv.coins||0},updated_at=now()`;
}

async function grantSkills(sql,playerId,skills){
  for(const entry of skills||[]){
    if(!entry?.key||!(Number(entry.xp)>0))continue;
    await sql`INSERT INTO player_crafting_skills(player_id,skill_key) VALUES(${playerId},${entry.key}) ON CONFLICT DO NOTHING`;
    await sql`UPDATE player_crafting_skills SET skill_value=LEAST(100,skill_value+${Number(entry.xp)}),attempts=attempts+1,updated_at=now()
      WHERE player_id=${playerId} AND skill_key=${entry.key}`;
  }
}

function pushTrace(state,trace,choiceId,opensRoute){
  if(!trace)return state;
  const traces=[...(state.traces||[])];
  if(trace.kind==='route'&&trace.id){
    if(!traces.some(t=>t.id===trace.id)){
      traces.push({id:trace.id,kind:'route',label:trace.label,points:trace.points||[],at:new Date().toISOString()});
    }
  }else if(trace.kind==='discovery'||trace.kind==='wildlife'){
    traces.push({id:`${trace.kind}-${Date.now()}`,kind:trace.kind,text:trace.text,at:new Date().toISOString()});
  }
  const favors={...(state.favors||{})};
  if(trace.npc&&trace.text){
    const list=Array.isArray(favors[trace.npc])?favors[trace.npc]:[];
    list.push({text:trace.text,choice:choiceId,at:new Date().toISOString()});
    favors[trace.npc]=list.slice(-6);
  }
  return{...state,traces:traces.slice(-20),favors};
}

export default async req=>{
  if(!process.env.DATABASE_URL)return respond({ok:false,error:'database_not_configured'},503);
  if(!['GET','POST'].includes(req.method))return respond({ok:false,error:'method_not_allowed'},405);
  const sql=neon(process.env.DATABASE_URL);
  try{
    await ensure(sql);
    const url=new URL(req.url);
    const body=req.method==='POST'?await req.json().catch(()=>({})):{};
    const clientId=clean(req.method==='GET'?url.searchParams.get('clientId'):body.clientId,80);
    if(!clientId)return respond({ok:false,error:'client_id_required'},400);
    let actor=await actorFor(sql,clientId);
    if(!actor)return respond({ok:false,error:'player_not_registered'},404);

    const session=await sql`SELECT current_world_type FROM player_world_sessions WHERE player_id=${actor.id} LIMIT 1`;
    if(session[0]?.current_world_type==='private')return respond({ok:false,error:'return_to_public_world'},409);

    let state=await loadState(sql,actor.id);
    const skills=await skillsFor(sql,actor.id);

    if(req.method==='GET'){
      // Optional heartbeat spawn when idle and standing in a region.
      const force=url.searchParams.get('scan')==='1';
      if(force&&(!state.active||state.active.status==='resolved')){
        const region=regionAt(actor.x,actor.z);
        const level=playerLevelFromSkills(skills);
        const recent=recentKeysFromHistory(state.history,5);
        const cool=cooldownsFromHistory(state.history);
        const seed=Math.floor(Date.now()/60000)+Number(actor.id||0)+Math.round(Number(actor.x||0)*3);
        const roll=((seed*9301+49297)%233280)/233280;
        if(region&&roll<ENCOUNTER_SPAWN_CHANCE){
          const def=pickEncounter({regionKey:region.key,level,recentKeys:recent,seed,cooldowns:cool});
          if(def){
            state={...state,active:buildEncounterInstance(def,{seed})};
            await saveState(sql,actor.id,state);
          }
        }else if(state.active?.status==='resolved'){
          state={...state,active:null};
          await saveState(sql,actor.id,state);
        }
      }
      return respond(pack(actor,state,skills));
    }

    const action=clean(body.action,40);
    const key=clean(body.idempotencyKey,90);
    if(!key)return respond({ok:false,error:'idempotency_key_required'},400);
    const prior=await readReceipt(sql,actor.id,key);
    if(prior)return respond(prior);

    // Presence refresh uses authoritative player coords from world sync.
    actor=await actorFor(sql,clientId);

    if(action==='scan'){
      if(state.active&&['available','engaged','deferred'].includes(state.active.status)){
        const result=pack(actor,state,skills,{message:'An encounter is already nearby.'});
        await saveReceipt(sql,actor.id,key,action,result);
        return respond(result);
      }
      const region=regionAt(actor.x,actor.z);
      if(!region){
        const result=pack(actor,{...state,active:null},skills,{message:'Keep exploring — events appear around the settlement and trails.'});
        await saveReceipt(sql,actor.id,key,action,result);
        return respond(result);
      }
      const level=playerLevelFromSkills(skills);
      const recent=recentKeysFromHistory(state.history,5);
      const cool=cooldownsFromHistory(state.history);
      const seed=Math.floor(Date.now()/1000)+Number(actor.id||0);
      const def=pickEncounter({regionKey:region.key,level,recentKeys:recent,seed,cooldowns:cool});
      if(!def){
        const result=pack(actor,state,skills,{message:'The area is quiet for now. Try another region later.'});
        await saveReceipt(sql,actor.id,key,action,result);
        return respond(result);
      }
      state={...state,active:buildEncounterInstance(def,{seed})};
      await saveState(sql,actor.id,state);
      const result=pack(actor,state,skills,{message:`Something stirs near the ${region.label.toLowerCase()}.`});
      await saveReceipt(sql,actor.id,key,action,result);
      return respond(result);
    }

    if(action==='find_clue'){
      if(!state.active||!['available','engaged','deferred'].includes(state.active.status)){
        return respond({ok:false,error:'no_active_encounter'},409);
      }
      const def=encounterByKey(state.active.key);
      if(!def?.clue)return respond({ok:false,error:'no_clue'},409);
      if(!near(actor,def.clue,ENCOUNTER_CLUE_RADIUS+0.8))return respond({ok:false,error:'approach_clue'},409);
      if(state.active.clue?.found){
        const result=pack(actor,state,skills,{message:'You already found that clue.',alreadyHad:true});
        await saveReceipt(sql,actor.id,key,action,result);
        return respond(result);
      }
      state={...state,active:{...state.active,clue:{...(state.active.clue||def.clue),found:true}}};
      await saveState(sql,actor.id,state);
      const result=pack(actor,state,skills,{message:`Clue found: ${def.clue.label}.`});
      await saveReceipt(sql,actor.id,key,action,result);
      return respond(result);
    }

    if(action==='engage'){
      if(!state.active||!['available','deferred','engaged'].includes(state.active.status)){
        return respond({ok:false,error:'no_active_encounter'},409);
      }
      const def=encounterByKey(state.active.key);
      if(!near(actor,state.active.spawn||def?.spawn,ENCOUNTER_APPROACH_RADIUS+0.8)){
        return respond({ok:false,error:'approach_encounter'},409);
      }
      state={...state,active:{...state.active,status:'engaged',openedAt:state.active.openedAt||new Date().toISOString()}};
      await saveState(sql,actor.id,state);
      const result=pack(actor,state,skills,{message:def?.title||'You look closer.'});
      await saveReceipt(sql,actor.id,key,action,result);
      return respond(result);
    }

    if(action==='defer'||action==='leave_open'){
      if(!state.active||state.active.status==='resolved'){
        return respond({ok:false,error:'no_active_encounter'},409);
      }
      state={...state,active:{...state.active,status:'deferred'}};
      await saveState(sql,actor.id,state);
      const result=pack(actor,state,skills,{message:'You step away. The situation remains if you return.'});
      await saveReceipt(sql,actor.id,key,action,result);
      return respond(result);
    }

    if(action==='choose'){
      if(!state.active||!['engaged','available','deferred'].includes(state.active.status)){
        return respond({ok:false,error:'no_active_encounter'},409);
      }
      const def=encounterByKey(state.active.key);
      const choice=choiceById(def,body.choiceId);
      if(!def||!choice)return respond({ok:false,error:'invalid_choice'},400);
      if(!near(actor,state.active.spawn||def.spawn,ENCOUNTER_APPROACH_RADIUS+0.8)){
        return respond({ok:false,error:'approach_encounter'},409);
      }
      if(choice.requiresClue&&!state.active.clue?.found){
        return respond({ok:false,error:'clue_required',quest:publicEncounterView(state.active,def)},409);
      }
      let inv=inventoryOf(actor);
      if(!canAfford(choice,inv))return respond({ok:false,error:'insufficient_resources',need:choice.cost||{}},409);

      let combat=null;
      if(choice.combat){
        const equipped=await sql`
          SELECT i.item_key FROM player_equipped_items e
          JOIN player_crafted_items i ON i.id=e.item_id
          WHERE e.player_id=${actor.id} AND e.slot='mainHand' AND i.placed_at IS NULL
          AND i.item_key IN ('basic-bow','reinforced-bow','composite-bow') LIMIT 1`;
        if(!equipped.length)return respond({ok:false,error:'equip_bow_first'},409);
        const skillRows=await skillsFor(sql,actor.id);
        const values=Object.fromEntries(skillRows.map(row=>[row.key,row.value]));
        combat=resolveHunt({
          key:`encounter:${actor.id}:${key}`,
          species:def.key==='shortcut_guardian'?'boar':'wolf',
          kind:'predator',
          skill:(values.hunting||0)*.55+(values.archery||0)*.45,
          equipment:equipped[0].item_key,
          distance:3.2,noise:.35,tracked:true,stalked:true
        });
        if(!combat.success){
          await grantSkills(sql,actor.id,[{key:'archery',xp:Math.max(.2,combat.xp||.3)}]);
          const result=pack(actor,state,await skillsFor(sql,actor.id),{
            combat:{success:false,chance:combat.chance,xp:combat.xp},
            message:'Your attempt fails — the creature holds its ground. Try another approach or return later.'
          });
          await saveReceipt(sql,actor.id,key,action,result);
          return respond(result);
        }
      }

      inv=applyReward(applyCost(inv,choice),choice);
      await writeInventory(sql,actor.id,inv);
      await grantSkills(sql,actor.id,choice.skills||[]);
      if(combat?.success)await grantSkills(sql,actor.id,[{key:'archery',xp:combat.xp||0.8}]);

      const opensRoute=Boolean(choice.opensRoute);
      const trace=shouldTrace(def,choice.id,opensRoute);
      const resolved={
        ...state.active,
        status:'resolved',
        choice:choice.id,
        resolvedAt:new Date().toISOString(),
        message:choice.message,
        hint:choice.hint||null,
        opensRoute
      };
      let nextState={
        ...state,
        active:resolved,
        history:[...normalizeHistory(state.history),{key:def.key,choice:choice.id,at:new Date().toISOString(),region:def.region}]
      };
      nextState=pushTrace(nextState,trace,choice.id,opensRoute);
      await saveState(sql,actor.id,nextState);

      actor=await actorFor(sql,clientId);
      const summary=rewardSummary(choice);
      const result=pack(actor,nextState,await skillsFor(sql,actor.id),{
        action:'choose',
        choiceId:choice.id,
        combat:combat?{success:true,chance:combat.chance,xp:combat.xp}:null,
        reward:choice.reward||{},
        message:choice.message+(summary?` (${summary})`:''),
        hint:choice.hint||null
      });
      await saveReceipt(sql,actor.id,key,action,result);
      return respond(result);
    }

    if(action==='clear_resolved'){
      if(state.active?.status==='resolved'){
        state={...state,active:null};
        await saveState(sql,actor.id,state);
      }
      const result=pack(actor,state,skills);
      await saveReceipt(sql,actor.id,key,action,result);
      return respond(result);
    }

    return respond({ok:false,error:'unknown_action'},400);
  }catch(error){
    console.error('World encounters failed',error);
    return respond({ok:false,error:'encounter_request_failed'},500);
  }
};
