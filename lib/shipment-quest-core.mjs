// The Missing Blacksmith Shipment: durable quest state, exploration clues, choice outcomes, and replay.
export const SHIPMENT_QUEST_ID='missing-blacksmith-shipment';
export const SHIPMENT_STAGES=Object.freeze(['not_started','tracking','wagon_found','wolf_resolved','shipment_recovered','completed']);
export const SHIPMENT_POINTS=Object.freeze({
 tracks:{x:18,z:15},
 wagon:{x:27,z:16},
 wolf:{x:28,z:8},
 cache:{x:25,z:11},
 tovan:{x:9,z:2},
 mara:{x:2,z:-4},
 axle:{x:14,z:11},
 scrap:{x:22,z:19}
});
export const SHIPMENT_CLUES=Object.freeze(['axle','scrap','rumor']);
export const SHIPMENT_REWARD=Object.freeze({coins:35,stone:8,blacksmithingXp:2,archeryXp:1});
export const SHIPMENT_CHOICE_BONUS=Object.freeze({
 bow:{coins:12,stone:2,herbs:0,wood:0,archeryXp:1,label:'wolf pelt bounty'},
 stealth:{coins:6,stone:0,herbs:4,wood:2,archeryXp:0,label:'quiet recovery bonus'}
});

const RUN_VARIANTS=Object.freeze([
 {wolfMood:'hungry',bonusResource:'herbs',bonusAmount:3,clueHint:'Torn canvas and iron nails may litter the east pines.',hookExtra:'Mara heard wheels after dusk — then a long silence.'},
 {wolfMood:'territorial',bonusResource:'wood',bonusAmount:3,clueHint:'Muddy forks east of the smithy sometimes hide axle iron.',hookExtra:'Edda swears a wolf claimed the wagon clearing.'},
 {wolfMood:'wounded',bonusResource:'stone',bonusAmount:4,clueHint:'Ask Mara what the caravan boys whispered at the inn.',hookExtra:'Someone left a broken axle spur near the eastern trail.'}
]);

export function shipmentRunConfig(seed=0){
 const index=Math.abs(Number(seed)||0)%RUN_VARIANTS.length;
 return{...RUN_VARIANTS[index],seed:Number(seed)||0,index};
}

export function shipmentNext(stage,action,{hasBow=false}={}){
 const transitions={
  not_started:{accept:'tracking'},
  tracking:{inspect_tracks:'wagon_found'},
  wagon_found:{fight_wolf:hasBow?'wolf_resolved':null,avoid_wolf:'wolf_resolved'},
  wolf_resolved:{recover:'shipment_recovered'},
  shipment_recovered:{turn_in:'completed'},
  completed:{replay:'tracking'}
 };
 return transitions[stage]?.[action]||null;
}

export function isShipmentClueAction(action){
 return action==='find_clue_axle'||action==='find_clue_scrap'||action==='hear_rumor';
}

export function shipmentClueKey(action){
 return({find_clue_axle:'axle',find_clue_scrap:'scrap',hear_rumor:'rumor'})[action]||null;
}

export function shipmentCluePoint(action){
 const key=shipmentClueKey(action);
 if(key==='rumor')return SHIPMENT_POINTS.mara;
 if(key==='axle')return SHIPMENT_POINTS.axle;
 if(key==='scrap')return SHIPMENT_POINTS.scrap;
 return null;
}

export function shipmentClueAllowed(stage){
 return stage==='tracking'||stage==='wagon_found'||stage==='wolf_resolved';
}

export function shipmentNormalizeMeta(meta={},stage='not_started'){
 const source=meta&&typeof meta==='object'?meta:{};
 const clues=Array.isArray(source.clues)?source.clues.filter(c=>SHIPMENT_CLUES.includes(c)):[];
 const seed=Number.isFinite(Number(source.seed))?Number(source.seed):0;
 const run=Math.max(1,Number(source.run)||1);
 const completions=Math.max(0,Number(source.completions)||0);
 const choice=source.choice==='bow'||source.choice==='stealth'?source.choice:null;
 return{
  run,
  seed,
  clues:[...new Set(clues)],
  choice,
  completions:stage==='completed'&&completions<1?Math.max(1,completions):completions,
  variant:shipmentRunConfig(seed)
 };
}

export function shipmentRewardFor(questLike={}){
 const meta=shipmentNormalizeMeta(questLike.meta||questLike,questLike.stage);
 const choice=questLike.choice||meta.choice;
 const bonus=SHIPMENT_CHOICE_BONUS[choice]||{coins:0,stone:0,herbs:0,wood:0,archeryXp:0,label:'standard recovery'};
 const clueCount=meta.clues.length;
 const variant=meta.variant||shipmentRunConfig(meta.seed);
 const reward={
  coins:SHIPMENT_REWARD.coins+bonus.coins+clueCount*4,
  stone:SHIPMENT_REWARD.stone+bonus.stone+(variant.bonusResource==='stone'?variant.bonusAmount:0),
  wood:(bonus.wood||0)+(variant.bonusResource==='wood'?variant.bonusAmount:0)+(meta.clues.includes('scrap')?1:0),
  herbs:(bonus.herbs||0)+(variant.bonusResource==='herbs'?variant.bonusAmount:0)+(meta.clues.includes('rumor')?1:0),
  blacksmithingXp:SHIPMENT_REWARD.blacksmithingXp+(clueCount>=2?1:0),
  archeryXp:(choice==='bow'?SHIPMENT_REWARD.archeryXp+(bonus.archeryXp||0):0),
  choiceLabel:bonus.label,
  cluesFound:clueCount,
  variantBonus:variant.bonusResource
 };
 return reward;
}

export function shipmentObjective(stage,meta={}){
 const normalized=shipmentNormalizeMeta(meta,stage);
 const hint=normalized.variant.clueHint;
 return({
  not_started:'Talk to Tovan at the smithy — or open Adventure to accept his request.',
  tracking:`Search east for wagon tracks. Optional: ${hint}`,
  wagon_found:`A ${normalized.variant.wolfMood} wolf blocks the supplies. Fight with a bow, or sneak past.`,
  wolf_resolved:'Recover the supply crate near the damaged wagon.',
  shipment_recovered:'Return the shipment to Tovan at the smithy.',
  completed:'Shipment delivered. Craft Trail Repair Fittings, help the forge, or replay for a new trail.'
 })[stage]||'Speak to Tovan in town.';
}

export function shipmentNarrative(stage,meta={}){
 const normalized=shipmentNormalizeMeta(meta,stage);
 const clueLine=normalized.clues.length?` Clues found: ${normalized.clues.join(', ')}.`:'';
 const choiceLine=normalized.choice==='bow'?' You cleared the wolf with a bow.'
  :normalized.choice==='stealth'?' You slipped past without a fight.':'';
 return({
  not_started:`Tovan: “A wagon carrying my metalwork vanished on the east forest trail. Bring back those supplies and I’ll teach you a useful smithing recipe.” ${normalized.variant.hookExtra}`,
  tracking:`Follow wagon tracks northeast into the forest, near the tall pines.${clueLine} Looking around may reveal scraps Mara and the caravan left behind.`,
  wagon_found:`The wagon is damaged. A ${normalized.variant.wolfMood} wolf guards the route to the lost supplies. Fight with an equipped bow for a bounty, or carefully sneak past for a quieter haul.${clueLine}`,
  wolf_resolved:`The route is clear.${choiceLine} Search the scattered supply crate beside the damaged wagon.${clueLine}`,
  shipment_recovered:`You have the recovered shipment.${choiceLine} Return to Tovan in town for your reward.${clueLine}`,
  completed:`Tovan: “You found it! You’ve earned supplies, coin, and Trail Repair Fittings.”${choiceLine}${clueLine} Replay the trail when you want another run — each outing shifts the clues and bonuses.`
 })[stage]||'Speak to Tovan in town.';
}

export function shipmentFeedback(action,questLike={}){
  const reward=shipmentRewardFor(questLike);
  if(action==='accept')return 'Quest accepted. Search east of town for wagon tracks — and keep an eye out for scraps.';
  if(action==='inspect_tracks')return 'Tracks confirmed. The damaged wagon lies farther east — a wolf is nearby.';
  if(action==='fight_wolf')return 'The wolf falls back. Archery practice paid off — recover the crate.';
  if(action==='avoid_wolf')return 'You slip past the wolf. Quiet work — recover the crate before it returns.';
  if(action==='recover')return 'Shipment secured. Deliver it to Tovan at the smithy.';
  if(action==='turn_in')return `Delivered! +${reward.coins} coins, +${reward.stone} stone${reward.wood?`, +${reward.wood} wood`:''}${reward.herbs?`, +${reward.herbs} herbs`:''}, +${reward.blacksmithingXp} Blacksmithing. ${reward.choiceLabel}. Trail Repair Fittings unlocked.`;
  if(action==='replay')return 'A new trail rumor spreads. Search east again — clues and bonuses may shift.';
  if(action==='find_clue_axle')return 'Broken axle iron recovered. This will help prove the wagon’s route.';
  if(action==='find_clue_scrap')return 'Torn crate lid found. The shipment spilled northeast of here.';
  if(action==='hear_rumor')return 'Mara: “Wheels after dusk, then silence. Check the muddy fork east of the forge.”';
  return 'Quest progress saved.';
}

export function shipmentWaypoint(stage){
 return({
  not_started:['Tovan',SHIPMENT_POINTS.tovan],
  tracking:['Wagon tracks',SHIPMENT_POINTS.tracks],
  wagon_found:['Forest wolf',SHIPMENT_POINTS.wolf],
  wolf_resolved:['Supply crate',SHIPMENT_POINTS.cache],
  shipment_recovered:['Tovan',SHIPMENT_POINTS.tovan]
 })[stage]||null;
}
