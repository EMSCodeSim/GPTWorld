import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  HOMESTEAD_MILESTONES,
  evaluateMilestones,
  newlyEarnedMilestones,
  propertyDevelopmentLevel,
  propertyChecklist,
  STRUCTURE_UPGRADES,
  canUpgradeStructure,
  nextStructureUpgrade,
  farmTierModifiers,
  ADVANCED_UNLOCKS,
  advancedUnlocksForSkills,
  recentlyUnlockedAdvanced,
  generateDiscoveries,
  resolveDiscoveryFind,
  normalizeFieldJournal,
  recordAnimalObservation,
  recordPlantObservation,
  recordWeatherEvent,
  ANIMAL_PROFILES,
  animalProfile,
  timeOfDayEffects,
  animalBehaviorState,
  weatherStrategy,
  seasonStrategy,
  transportForPlayer,
  cartLoadSpeed,
  playerSpecialization,
  resolveItemQuality,
  foodQualityPriceMod,
  familiarityTier,
  npcFamiliarityLine,
  townIdentityFromProjects,
  pendingTownArrivals,
  regionalHooksView,
  pickEmergentMoment,
  legacyCandidates,
  whileYouWereAwaySummary,
  profileCard
} from '../netlify/lib/progression-core.mjs';
import {craftingRecipe,resolveCraftAttempt,CRAFTING_RECIPES} from '../netlify/lib/crafting-core.mjs';
import {advanceCrop} from '../netlify/lib/survival-core.mjs';
import {buildTrackSign,animalDetectionRange} from '../netlify/lib/hunting-core.mjs';

test('homestead milestones cover meaningful accomplishments without grind loops',()=>{
  assert.ok(HOMESTEAD_MILESTONES.length>=8);
  assert.ok(HOMESTEAD_MILESTONES.some(m=>m.key==='first_shelter'));
  assert.ok(HOMESTEAD_MILESTONES.some(m=>m.key==='town_contributor'));
  const context={
    buildings:[{key:'homestead',type:'house',level:1}],
    placed:new Set(['campfire-kit','stone-hammer','wooden-crate','workbench']),
    plots:[{cropKey:'wheat',stage:'young'},{cropKey:'carrot',stage:'ready'}],
    skills:[{key:'hunting',value:28},{key:'carpentry',value:35},{key:'farming',value:20}],
    journal:{animals:[{key:'reed-runner',successfullyHunted:true},{key:'meadow-grazer',successfullyHunted:true}]},
    craftedKeys:new Set(['fence-panel']),
    inventory:{wood:10,herbs:4},
    townContributions:3,
    earned:[]
  };
  const results=evaluateMilestones(context);
  assert.equal(results.find(m=>m.key==='first_shelter').complete,true);
  assert.equal(results.find(m=>m.key==='working_farm').complete,true);
  assert.equal(results.find(m=>m.key==='skilled_hunter').complete,true);
  assert.equal(results.find(m=>m.key==='craftsman').complete,true);
  assert.equal(results.find(m=>m.key==='established_homestead').complete,true);
  assert.equal(results.find(m=>m.key==='town_contributor').complete,true);
  const fresh=newlyEarnedMilestones(['first_shelter'],context);
  assert.ok(!fresh.some(m=>m.key==='first_shelter'));
  assert.ok(fresh.some(m=>m.key==='working_farm'));
});

test('property development level derives from what exists on the land',()=>{
  const empty=propertyDevelopmentLevel({});
  assert.equal(empty.key,'wilderness_camp');
  const checklist=propertyChecklist({
    buildings:[{key:'homestead',type:'house',level:2}],
    placedItems:[{key:'workbench'},{key:'wooden-crate'},{key:'campfire-kit'}],
    plots:[{cropKey:'wheat',stage:'mature'},{cropKey:'potato',stage:'young'}],
    skills:[{key:'carpentry',value:50}]
  });
  assert.ok(checklist.find(i=>i.key==='shelter').met);
  assert.ok(checklist.find(i=>i.key==='workshop').met);
  assert.ok(checklist.find(i=>i.key==='food').met);
  const established=propertyDevelopmentLevel({
    buildings:[{key:'homestead',type:'house',level:2}],
    placedItems:[{key:'workbench'},{key:'wooden-crate'},{key:'campfire-kit'}],
    plots:[{cropKey:'wheat',stage:'mature'},{cropKey:'potato',stage:'young'}],
    skills:[{key:'carpentry',value:50}]
  });
  assert.ok(['homestead','established','developed_estate'].includes(established.key));
  assert.ok(established.checklist.some(i=>!i.met)||established.nextHint);
});

test('structure upgrades deepen existing families instead of exploding building types',()=>{
  assert.equal(STRUCTURE_UPGRADES.shelter.length,3);
  assert.equal(STRUCTURE_UPGRADES.storage.length,3);
  assert.equal(STRUCTURE_UPGRADES.workshop.length,3);
  assert.equal(STRUCTURE_UPGRADES.farm.length,3);
  assert.equal(nextStructureUpgrade('shelter',1).key,'cabin');
  const locked=canUpgradeStructure('shelter',1,[],{wood:100,stone:100});
  assert.equal(locked.ok,false);
  assert.equal(locked.error,'skill_locked');
  const ready=canUpgradeStructure('shelter',1,[{key:'carpentry',value:35},{key:'construction',value:45}],{wood:40,stone:20,herbs:2});
  assert.equal(ready.ok,true);
  assert.equal(ready.next.key,'cabin');
  assert.equal(farmTierModifiers(3).moistureDrainScale,0.55);
});

test('advanced crafting unlocks are sparse and skill-gated',()=>{
  assert.ok(ADVANCED_UNLOCKS.length<=10);
  assert.ok(craftingRecipe('hand-cart'));
  assert.ok(craftingRecipe('storage-shed'));
  assert.ok(craftingRecipe('improved-cabin'));
  assert.ok(craftingRecipe('orchard-kit'));
  const unlocks=advancedUnlocksForSkills([{key:'carpentry',value:60},{key:'farming',value:30},{key:'hunting',value:50}]);
  assert.equal(unlocks.find(u=>u.key==='hand-cart').unlocked,true);
  assert.equal(unlocks.find(u=>u.key==='orchard-kit').unlocked,true);
  assert.equal(unlocks.find(u=>u.key==='advanced-house').unlocked,false);
  const recent=recentlyUnlockedAdvanced(
    [{key:'carpentry',value:60}],
    [{key:'carpentry',value:59}]
  );
  assert.ok(recent.some(u=>u.key==='hand-cart'));
});

test('crafted quality includes poor tier and prices scale',()=>{
  const attempt=resolveCraftAttempt({skillValue:5,difficulty:40,key:'quality-poor-test',minSkill:0});
  assert.ok(attempt.quality==null||['poor','standard','fine','exceptional'].includes(attempt.quality));
  assert.equal(foodQualityPriceMod('poor'),0.7);
  assert.equal(foodQualityPriceMod('exceptional'),1.55);
  const q=resolveItemQuality({skill:90,difficulty:10,key:'fine-test'});
  assert.ok(['poor','standard','fine','exceptional'].includes(q));
});

test('rare discoveries are uncommon and journal only records learned facts',()=>{
  const discoveries=generateDiscoveries(42,3);
  assert.equal(discoveries.length,3);
  assert.ok(new Set(discoveries.map(d=>d.key)).size===3);
  const first=discoveries[0];
  const found=resolveDiscoveryFind(first,normalizeFieldJournal());
  assert.equal(found.ok,true);
  assert.ok(found.journal.rareDiscoveries.some(d=>d.key===first.key));
  const empty=normalizeFieldJournal();
  assert.equal(empty.animals.length,0);
  const animals=recordAnimalObservation(empty,'reed-runner',{tracks:true,behavior:'Active near forest edge at dawn.'});
  assert.equal(animals.animals[0].tracksIdentified,true);
  assert.equal(animals.animals[0].knownBehavior.includes('forest edge'),true);
  const plants=recordPlantObservation(animals,'rivergrass',{note:'Prefers damp banks.'});
  assert.equal(plants.plants[0].observed,1);
  const weather=recordWeatherEvent(plants,{condition:'storm',season:'Autumn'});
  assert.equal(weather.weatherEvents.length,1);
});

test('animal behavior and time-of-day create lightweight differences',()=>{
  assert.ok(ANIMAL_PROFILES['reed-runner'].temperament==='skittish');
  assert.ok(animalProfile('rabbit').fleeDistance<animalProfile('meadow-grazer').fleeDistance);
  assert.ok(animalProfile('ridge-stalker').kind==='predator');
  const night=timeOfDayEffects(23);
  assert.equal(night.businessesOpen,false);
  assert.ok(night.visibility<1);
  const morning=timeOfDayEffects(7);
  assert.ok(morning.trackingBonus>0);
  const fleeing=animalBehaviorState('reed-runner',{hour:8,noise:0.9});
  assert.equal(fleeing.behavior,'fleeing');
  const range=animalDetectionRange({species:'reed-runner',noise:0.9,hour:7});
  assert.ok(range>5);
  const washed=buildTrackSign({
    animal:{id:'a1',species:'reed-runner',x:4,z:2,behavior:'feeding'},
    player:{x:0,z:0},
    lastSeenAt:Date.now()-1000,
    skill:55,
    hour:7,
    tracksWashed:true
  });
  assert.ok(washed.freshness==='old'||washed.freshness==='cold'||washed.quality<=1);
});

test('weather and seasons create opportunities rather than hard locks',()=>{
  const rain=weatherStrategy('rain',16);
  assert.ok(rain.cropGrowth>1);
  assert.ok(rain.trackBonus>0);
  const storm=weatherStrategy('storm',12);
  assert.ok(storm.repairDemand>0);
  const snow=weatherStrategy('snow',-2);
  assert.ok(snow.travelSpeed<1);
  assert.ok(snow.trackBonus>0);
  const winter=seasonStrategy('Winter');
  assert.ok(winter.cropGrowth<1);
  assert.ok(winter.trackingBonus>0);
  const plot=advanceCrop({
    crop_key:'wheat',
    planted_at:new Date(Date.now()-3*3600*1000).toISOString(),
    moisture:70,
    health:90,
    soil:60,
    metadata:{farmTier:3}
  },{weather:'rain',temperature:16,season:'Spring',farmTier:3});
  assert.ok(plot.progress>0);
});

test('hand cart transport slows when heavily loaded',()=>{
  const pack=transportForPlayer({hasCart:false});
  assert.equal(pack.key,'backpack');
  const cart=transportForPlayer({hasCart:true,cartLoad:120,skills:[{key:'carpentry',value:60}]});
  assert.equal(cart.key,'hand-cart');
  assert.ok(cart.speedMod<1);
  assert.equal(cart.heavilyLoaded,true);
  assert.ok(cartLoadSpeed(130,140)<cartLoadSpeed(10,140));
});

test('specialization is descriptive and town identity emerges from projects',()=>{
  const spec=playerSpecialization({
    skills:[{key:'carpentry',value:42},{key:'hunting',value:31},{key:'farming',value:18}],
    inventory:{coins:10},
    discoveryCount:1
  });
  assert.equal(spec.primary,'Master Carpenter');
  assert.ok(spec.strongestSkills[0].key==='carpentry');
  const frontier=townIdentityFromProjects([]);
  assert.equal(frontier.key,'frontier_settlement');
  const trade=townIdentityFromProjects(['marketplace','blacksmith']);
  assert.equal(trade.key,'trade_village');
  const arrivals=pendingTownArrivals({completedProjects:['marketplace','clinic'],existingNpcs:[],foodSecure:true});
  assert.ok(arrivals.some(a=>a.npcKey.includes('Merchant')));
  assert.ok(arrivals.length<=2);
  const tier=familiarityTier(20,1);
  assert.equal(tier.key,'familiar');
  const line=npcFamiliarityLine({traveler:'David',familiarity:40,helpfulActs:2,recentActs:['lumber']});
  assert.match(line,/lumber/i);
});

test('regional hooks tease future exploration without building the map',()=>{
  const hooks=regionalHooksView(['north_trail']);
  assert.ok(hooks.some(h=>h.key==='north_trail'&&h.known));
  assert.ok(hooks.some(h=>h.key==='mountain_pass'));
  assert.match(hooks.find(h=>h.key==='north_trail').summary,/mining/i);
});

test('returning player summary and legacy stay sparse and meaningful',()=>{
  const away=whileYouWereAwaySummary({
    readyCrops:2,
    projectProgress:{name:'Blacksmith',percent:78},
    weatherPassed:'storm',
    demandShift:'food',
    arrivals:[{npcKey:'Lira the Merchant'}],
    milestones:[{newlyEarned:true,name:'Working Farm'}]
  });
  assert.ok(away.length<=5);
  assert.ok(away.length>=3);
  const legacy=legacyCandidates({
    milestones:[{key:'master_builder',complete:true}],
    discoveries:[{key:'strange_landmark',name:'Strange Landmark'}],
    skills:[{key:'carpentry',value:52}],
    buildings:[{key:'homestead',type:'house',level:3}],
    townContributions:6,
    playerName:'David',
    gameDay:42
  });
  assert.ok(legacy.length>=1);
  assert.ok(legacy.some(e=>/cabin|Carpentry|landmark|town/i.test(e.title+e.summary)));
  const card=profileCard({
    playerName:'David',
    property:propertyDevelopmentLevel({
      buildings:[{key:'homestead',type:'house',level:2}],
      placedItems:[{key:'workbench'},{key:'wooden-crate'}],
      plots:[{cropKey:'wheat',stage:'ready'}],
      skills:[{key:'carpentry',value:42}]
    }),
    skills:[{key:'carpentry',value:42},{key:'hunting',value:31}],
    milestones:[{complete:true}]
  });
  assert.equal(card.name,'David');
  assert.ok(card.homesteadLevel);
});

test('emergent moments are rare and deterministic for a seed',()=>{
  const a=pickEmergentMoment({seed:'world-1',hour:10,weather:'clear',rare:1});
  const b=pickEmergentMoment({seed:'world-1',hour:10,weather:'clear',rare:1});
  assert.ok(a);
  assert.equal(a.key,b.key);
  const none=pickEmergentMoment({seed:'quiet',hour:3,weather:'clear',rare:0});
  assert.equal(none,null);
});

test('migration 013 is additive and progression endpoint is wired',async()=>{
  const sql=await readFile(new URL('../migrations/013_progression_discovery.sql',import.meta.url),'utf8');
  assert.match(sql,/CREATE TABLE IF NOT EXISTS player_milestones/);
  assert.match(sql,/CREATE TABLE IF NOT EXISTS player_field_journal/);
  assert.match(sql,/CREATE TABLE IF NOT EXISTS private_world_discoveries/);
  assert.match(sql,/CREATE TABLE IF NOT EXISTS player_legacy_events/);
  assert.match(sql,/CREATE TABLE IF NOT EXISTS player_cart_cargo/);
  assert.doesNotMatch(sql,/\bDROP TABLE\b/i);
  assert.doesNotMatch(sql,/\bTRUNCATE\b/i);
  assert.doesNotMatch(sql,/DELETE FROM players/i);
  const fn=await readFile(new URL('../netlify/functions/progression.mjs',import.meta.url),'utf8');
  assert.match(fn,/find_discovery/);
  assert.match(fn,/upgrade_structure/);
  assert.match(fn,/cart_transfer/);
  assert.match(fn,/whileYouWereAway/);
  const ui=await readFile(new URL('../progression-ui.js',import.meta.url),'utf8');
  assert.match(ui,/While you were away/);
  assert.match(ui,/Field Journal/);
  assert.match(ui,/Homestead/);
  assert.ok(CRAFTING_RECIPES.some(r=>r.key==='hand-cart'));
});
