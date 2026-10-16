/**
 * Living World Encounters — optional exploration events while traveling.
 * Pure logic: templates, region matching, anti-repeat selection, choice outcomes.
 */

const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||0));

export const ENCOUNTER_REGIONS=Object.freeze({
  town:{key:'town',label:'Settlement',cx:2,cz:0,r:11},
  east_trail:{key:'east_trail',label:'East trail',cx:18,cz:8,r:12},
  east_forest:{key:'east_forest',label:'East forest',cx:27,cz:12,r:11},
  north_woods:{key:'north_woods',label:'North woods',cx:6,cz:-16,r:11},
  south_meadow:{key:'south_meadow',label:'South meadow',cx:4,cz:17,r:11},
  west_crossing:{key:'west_crossing',label:'West crossing',cx:-20,cz:0,r:11}
});

export function regionAt(x,z){
  let best=null,bestD=Infinity;
  for(const region of Object.values(ENCOUNTER_REGIONS)){
    const d=Math.hypot(Number(x)-region.cx,Number(z)-region.cz);
    if(d<=region.r&&d<bestD){best=region;bestD=d;}
  }
  return best;
}

export function playerLevelFromSkills(skills=[]){
  const values=(skills||[]).map(s=>Number(s.value||s.skill_value||0));
  if(!values.length)return 1;
  const avg=values.reduce((a,b)=>a+b,0)/values.length;
  return clamp(Math.floor(1+avg/12),1,12);
}

/** Catalog of encounter templates. All choices are fully resolved server-side. */
export const ENCOUNTER_DEFS=Object.freeze([
  {
    key:'stuck_cart',
    name:'Stuck Merchant Cart',
    region:'east_trail',
    mood:'peaceful',
    minLevel:1,
    weight:3,
    cooldownMs:40*60*1000,
    spawn:{x:21.5,z:5.5},
    clue:{x:16.5,z:7.2,label:'Deep cart ruts'},
    title:'A merchant cart is stuck in the mud.',
    body:'A trader waves from a tilted wagon. The axle is sound, but a wheel is buried. Helping costs a little wood for leverage — or you can negotiate a quieter favor.',
    choices:[
      {id:'help',label:'Help free the cart (1 wood)',cost:{wood:1},reward:{coins:10,stone:1},skills:[{key:'blacksmithing',xp:0.6}],message:'Together you lever the wheel free. The trader pays you and promises Mara will hear of it.'},
      {id:'negotiate',label:'Offer to walk them toward town',reward:{coins:5,herbs:1},message:'You guide them to firmer ground. They share a pouch of trail herbs and a few coins.'},
      {id:'leave',label:'Wish them luck and move on',reward:{},message:'You leave them to their work. The cart remains for another traveler.'}
    ],
    trace:{kind:'favor',npc:'Mara the Keeper',text:'helped free a stuck cart on the east trail'}
  },
  {
    key:'prey_in_danger',
    name:'Prey in Danger',
    region:'east_forest',
    mood:'challenge',
    minLevel:1,
    weight:3,
    cooldownMs:35*60*1000,
    spawn:{x:29,z:9},
    clue:{x:24.5,z:12.5,label:'Scattered feathers'},
    title:'A fox is cornered by a hungry wolf.',
    body:'Brush shakes ahead. A fox is pinned against a fallen pine while a wolf circles. You can drive the wolf off with a shot, scare it with noise, or slip away.',
    choices:[
      {id:'fight',label:'Drive the wolf off (bow hunt)',combat:true,reward:{coins:6,stone:2},skills:[{key:'archery',xp:1.2},{key:'hunting',xp:0.8}],message:'Your shot forces the wolf back. The fox bolts. You gather a little bounty from the scuffle.'},
      {id:'scare',label:'Shout and wave to scare them apart',reward:{herbs:2},skills:[{key:'hunting',xp:0.4}],message:'Noise splits them. You find bruised herbs where the fox fled.'},
      {id:'leave',label:'Stay quiet and move on',reward:{},message:'You slip away. The forest keeps its own counsel.'}
    ],
    trace:{kind:'wildlife',text:'wolf pressure eased near the east pines'}
  },
  {
    key:'lost_satchel',
    name:'Lost Satchel',
    region:'south_meadow',
    mood:'peaceful',
    minLevel:1,
    weight:3,
    cooldownMs:30*60*1000,
    spawn:{x:8,z:15},
    clue:{x:5.5,z:13.2,label:'Torn satchel strap'},
    title:'A traveler lost a useful satchel nearby.',
    body:'A weary traveler searches the meadow grass. “My satchel tore loose — tools and coin inside.” Searching the nearby clue pays off; returning it earns trust, keeping it earns more coin but a colder farewell.',
    choices:[
      {id:'return',label:'Find it and return it',requiresClue:true,reward:{coins:8,wood:1},skills:[{key:'carpentry',xp:0.4}],message:'You return the satchel. The traveler presses coin and a spare timber scrap into your hands.'},
      {id:'keep',label:'Find it and keep the contents',requiresClue:true,reward:{coins:14,stone:1},message:'You keep what you found. The traveler leaves disappointed — richer pack, thinner reputation.'},
      {id:'leave',label:'I don’t have time',reward:{},message:'You leave them searching.'}
    ],
    trace:{kind:'favor',npc:'Edda the Healer',text:'returned a lost satchel in the south meadow',onlyIf:'return'}
  },
  {
    key:'hidden_cache',
    name:'Hidden Cache',
    region:'north_woods',
    mood:'peaceful',
    minLevel:1,
    weight:2,
    cooldownMs:50*60*1000,
    spawn:{x:11,z:-17},
    clue:{x:7.5,z:-14.5,label:'Marked pine bark'},
    title:'A resource cache is tucked off the path.',
    body:'Someone cached supplies among the northern pines. The bark mark nearby points the way. Dig carefully — or leave it for the next traveler.',
    choices:[
      {id:'open',label:'Open the cache',requiresClue:true,reward:{wood:3,stone:2,herbs:1,coins:4},skills:[{key:'carpentry',xp:0.5}],message:'Inside: timber, stone, herbs, and a few coins. A useful find for looking around.'},
      {id:'leave',label:'Leave it untouched',reward:{},message:'You mark the spot in memory and walk on.'}
    ],
    trace:{kind:'discovery',text:'a northern cache was opened'}
  },
  {
    key:'shortcut_guardian',
    name:'Shortcut Guardian',
    region:'west_crossing',
    mood:'challenge',
    minLevel:2,
    weight:2,
    cooldownMs:55*60*1000,
    spawn:{x:-22,z:3.5},
    clue:{x:-18,z:1.5,label:'Scratched trail stone'},
    title:'A creature guards a narrow shortcut.',
    body:'A packed-dirt spur would cut the long western bend — but a territorial boar blocks it. Fight, sneak, bribe it with herbs, or take the long way.',
    choices:[
      {id:'fight',label:'Face the boar (bow hunt)',combat:true,reward:{coins:8,wood:2},skills:[{key:'archery',xp:1.0},{key:'hunting',xp:1.0}],message:'The boar breaks and flees. The shortcut opens — a clearer west spur for a while.',opensRoute:true},
      {id:'sneak',label:'Sneak past along the brush',reward:{coins:3},skills:[{key:'hunting',xp:0.5}],message:'You slip by. The spur is usable if you stay quiet.',opensRoute:true},
      {id:'bribe',label:'Toss herbs to distract it (2 herbs)',cost:{herbs:2},reward:{coins:4,stone:1},message:'The boar roots after the herbs. You jog the open spur.',opensRoute:true},
      {id:'leave',label:'Take the long way instead',reward:{},message:'You keep to the main path. The guardian stays.'}
    ],
    trace:{kind:'route',id:'west-spur-open',label:'West spur shortcut',points:[[-24,0],[-22,3.5],[-19,2]],onlyIfOpen:true}
  },
  {
    key:'rumor_wanderer',
    name:'Wandering Rumor',
    region:'town',
    mood:'peaceful',
    minLevel:1,
    weight:3,
    cooldownMs:25*60*1000,
    spawn:{x:-2.5,z:6.5},
    clue:{x:0.5,z:4.2,label:'Fresh boot prints'},
    title:'A wanderer shares a rumor worth chasing.',
    body:'Near the council road, a wanderer warms their hands. “East pines hide more than wolves — look for torn canvas if you like coin.” Listening costs nothing; a tip buys a clearer pointer.',
    choices:[
      {id:'listen',label:'Listen closely',reward:{},hint:'hidden_cache',message:'“North bark marks hide a cache. South straps hide a satchel. Don’t walk with your eyes shut.”'},
      {id:'tip',label:'Tip a coin for details (1 coin)',cost:{coins:1},reward:{herbs:1},hint:'lost_satchel',message:'They sketch a south-meadow strap in the dirt and hand you a sprig of herbs for the road.'},
      {id:'leave',label:'Nod and keep walking',reward:{},message:'Another rumor for another day.'}
    ],
    trace:{kind:'rumor',npc:'Mara the Keeper',text:'heard a wanderer’s trail rumor near the council road'}
  },
  {
    key:'wounded_doe',
    name:'Wounded Doe',
    region:'east_forest',
    mood:'peaceful',
    minLevel:1,
    weight:2,
    cooldownMs:40*60*1000,
    spawn:{x:25,z:14.5},
    clue:{x:22,z:16,label:'Blood-dark leaves'},
    title:'A wounded doe needs a careful hand.',
    body:'A doe favors one leg in the shade. Edda would want herbs used kindly. You can bind the wound, or leave nature to decide.',
    choices:[
      {id:'heal',label:'Bind the wound (1 herb)',cost:{herbs:1},reward:{coins:6,herbs:2},skills:[{key:'farming',xp:0.6}],message:'The doe steadies and limps into cover. You gather fresh herbs where she rested — Edda will approve.'},
      {id:'leave',label:'Give it space',reward:{},message:'You back away quietly.'}
    ],
    trace:{kind:'favor',npc:'Edda the Healer',text:'tended a wounded doe in the east forest',onlyIf:'heal'}
  },
  {
    key:'forager_quarrel',
    name:'Forager Quarrel',
    region:'north_woods',
    mood:'peaceful',
    minLevel:1,
    weight:2,
    cooldownMs:35*60*1000,
    spawn:{x:3,z:-15},
    clue:{x:1,z:-12.5,label:'Dropped herb basket'},
    title:'Two foragers argue over a herb patch.',
    body:'Voices carry through the northern trees. Two gatherers claim the same flowering patch. Mediate fairly, back one side, or walk on.',
    choices:[
      {id:'mediate',label:'Help them split the patch',reward:{herbs:3,coins:3},skills:[{key:'farming',xp:0.5}],message:'You mark fair rows. Both leave calmer — and share a cut of herbs and coin.'},
      {id:'side_a',label:'Side with the older forager',reward:{herbs:4},message:'The older forager keeps the patch and presses herbs into your pack.'},
      {id:'leave',label:'Not your quarrel',reward:{},message:'You leave the argument behind.'}
    ],
    trace:{kind:'favor',npc:'Edda the Healer',text:'settled a forager quarrel up north',onlyIf:'mediate'}
  },
  {
    key:'glow_caps',
    name:'Glow Caps',
    region:'east_trail',
    mood:'peaceful',
    minLevel:1,
    weight:2,
    cooldownMs:45*60*1000,
    spawn:{x:19,z:17},
    clue:{x:15.5,z:14.8,label:'Pale spore dust'},
    title:'Strange caps glow at the trail edge.',
    body:'Pale mushrooms cluster off the east path. They look useful — and a little risky. Harvest carefully, or leave the patch be.',
    choices:[
      {id:'harvest',label:'Harvest carefully',requiresClue:true,reward:{herbs:4,coins:2},skills:[{key:'farming',xp:0.7}],message:'You take what the patch can spare. The spores will recover.'},
      {id:'leave',label:'Leave the glow alone',reward:{},message:'The caps keep their quiet light.'}
    ],
    trace:{kind:'discovery',text:'glow caps were harvested along the east trail'}
  },
  {
    key:'river_planks',
    name:'Loose River Planks',
    region:'west_crossing',
    mood:'peaceful',
    minLevel:1,
    weight:2,
    cooldownMs:50*60*1000,
    spawn:{x:-17,z:-4},
    clue:{x:-14,z:-2,label:'Warped plank ends'},
    title:'Loose planks threaten a muddy cut.',
    body:'A short boardwalk over a wet cut has slipped. Two wood and a little care would firm it for everyone using the western approach.',
    choices:[
      {id:'repair',label:'Repair the boards (2 wood)',cost:{wood:2},reward:{coins:7,stone:1},skills:[{key:'carpentry',xp:1.0}],message:'The cut holds again. Travelers will notice — and Tovan likes steady roads.',opensRoute:true},
      {id:'leave',label:'Step around carefully',reward:{},message:'You pick your footing and move on.'}
    ],
    trace:{kind:'route',id:'west-plank-fix',label:'Repaired west cut',points:[[-18,-3],[-16,-4],[-14,-2]],onlyIfOpen:true,npc:'Tovan the Smith',text:'repaired loose planks on the western approach'}
  }
]);

export function encounterByKey(key){
  return ENCOUNTER_DEFS.find(def=>def.key===String(key))||null;
}

export function choiceById(def,choiceId){
  return (def?.choices||[]).find(choice=>choice.id===String(choiceId))||null;
}

export function canAfford(choice,inventory={}){
  const cost=choice?.cost||{};
  for(const [resource,amount] of Object.entries(cost)){
    if(Number(inventory[resource]||0)<Number(amount||0))return false;
  }
  return true;
}

export function applyCost(inventory,choice){
  const next={...inventory};
  for(const [resource,amount] of Object.entries(choice?.cost||{})){
    next[resource]=Math.max(0,Number(next[resource]||0)-Number(amount||0));
  }
  return next;
}

export function applyReward(inventory,choice){
  const next={...inventory};
  for(const [resource,amount] of Object.entries(choice?.reward||{})){
    if(!amount)continue;
    next[resource]=Number(next[resource]||0)+Number(amount||0);
  }
  return next;
}

export function rewardSummary(choice){
  const parts=[];
  for(const [resource,amount] of Object.entries(choice?.reward||{})){
    if(Number(amount)>0)parts.push(`+${amount} ${resource}`);
  }
  for(const skill of choice?.skills||[]){
    if(Number(skill.xp)>0)parts.push(`+${skill.xp} ${skill.key}`);
  }
  return parts.join(', ');
}

/**
 * Pick an encounter for the player's region, skipping recent keys and respecting level.
 * Deterministic when seed is provided (for tests / stable spawns).
 */
export function pickEncounter({regionKey=null,level=1,recentKeys=[],seed=0,now=Date.now(),cooldowns={}}={}){
  const region=regionKey||null;
  const recent=new Set((recentKeys||[]).map(String));
  const candidates=ENCOUNTER_DEFS.filter(def=>{
    if(region&&def.region!==region)return false;
    if(Number(def.minLevel||1)>Number(level||1))return false;
    if(recent.has(def.key))return false;
    const readyAt=Number(cooldowns?.[def.key]||0);
    if(readyAt&&readyAt>now)return false;
    return true;
  });
  if(!candidates.length){
    // Soft fallback: allow other nearby-ish templates of matching or lower level if region exhausted.
    const soft=ENCOUNTER_DEFS.filter(def=>Number(def.minLevel||1)<=Number(level||1)&&!recent.has(def.key));
    if(!soft.length)return null;
    const index=Math.abs(Number(seed)||0)%soft.length;
    return soft[index];
  }
  const weighted=[];
  for(const def of candidates){
    const w=Math.max(1,Number(def.weight||1));
    for(let i=0;i<w;i++)weighted.push(def);
  }
  const index=Math.abs(Number(seed)||0)%weighted.length;
  return weighted[index];
}

export function normalizeHistory(history=[]){
  return (Array.isArray(history)?history:[]).slice(-12).map(entry=>({
    key:String(entry.key||''),
    choice:entry.choice?String(entry.choice):null,
    at:entry.at||null,
    region:entry.region||null
  })).filter(entry=>entry.key);
}

export function recentKeysFromHistory(history=[],limit=5){
  return normalizeHistory(history).slice(-limit).map(entry=>entry.key);
}

export function cooldownsFromHistory(history=[],defs=ENCOUNTER_DEFS,now=Date.now()){
  const map={};
  const byKey=Object.fromEntries(defs.map(def=>[def.key,def]));
  for(const entry of normalizeHistory(history)){
    const def=byKey[entry.key];
    if(!def||!entry.at)continue;
    const ready=new Date(entry.at).getTime()+Number(def.cooldownMs||30*60*1000);
    if(ready>now)map[entry.key]=ready;
  }
  return map;
}

export function buildEncounterInstance(def,{seed=0,discoveredClue=false}={}){
  if(!def)return null;
  return{
    id:`${def.key}-${seed}`,
    key:def.key,
    name:def.name,
    region:def.region,
    mood:def.mood,
    title:def.title,
    body:def.body,
    spawn:{...def.spawn},
    clue:def.clue?{...def.clue,found:Boolean(discoveredClue)}:null,
    status:'available', // available | engaged | resolved | deferred
    choice:null,
    seed:Number(seed)||0,
    openedAt:null,
    resolvedAt:null,
    message:null,
    hint:null,
    opensRoute:false
  };
}

export function publicEncounterView(instance,def=null){
  const template=def||encounterByKey(instance?.key);
  if(!instance||!template)return null;
  const clueFound=Boolean(instance.clue?.found);
  return{
    id:instance.id,
    key:instance.key,
    name:instance.name||template.name,
    region:instance.region||template.region,
    mood:instance.mood||template.mood,
    title:instance.title||template.title,
    body:instance.body||template.body,
    status:instance.status,
    spawn:instance.spawn||template.spawn,
    clue:template.clue?{...template.clue,found:clueFound}:null,
    choice:instance.choice||null,
    message:instance.message||null,
    hint:instance.hint||null,
    opensRoute:Boolean(instance.opensRoute),
    choices:(template.choices||[]).map(choice=>({
      id:choice.id,
      label:choice.label,
      cost:choice.cost||null,
      requiresClue:Boolean(choice.requiresClue),
      combat:Boolean(choice.combat),
      locked:Boolean(choice.requiresClue)&&!clueFound
    }))
  };
}

export function shouldTrace(def,choiceId,opensRoute=false){
  const trace=def?.trace;
  if(!trace)return null;
  if(trace.onlyIf&&trace.onlyIf!==choiceId)return null;
  if(trace.onlyIfOpen&&!opensRoute)return null;
  if(choiceId==='leave')return null;
  return trace;
}

export const ENCOUNTER_APPROACH_RADIUS=5.8;
export const ENCOUNTER_CLUE_RADIUS=4.8;
export const ENCOUNTER_SCAN_MS=12000;
export const ENCOUNTER_SPAWN_CHANCE=0.55;
