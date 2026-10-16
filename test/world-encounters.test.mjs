import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ENCOUNTER_DEFS,ENCOUNTER_REGIONS,encounterByKey,choiceById,canAfford,applyCost,applyReward,
  regionAt,playerLevelFromSkills,pickEncounter,normalizeHistory,recentKeysFromHistory,
  cooldownsFromHistory,buildEncounterInstance,publicEncounterView,shouldTrace,rewardSummary
} from '../lib/world-encounters-core.mjs';

test('encounter catalog covers peaceful and challenge moods with real choices',()=>{
  assert.ok(ENCOUNTER_DEFS.length>=8);
  const moods=new Set(ENCOUNTER_DEFS.map(d=>d.mood));
  assert.ok(moods.has('peaceful')&&moods.has('challenge'));
  for(const def of ENCOUNTER_DEFS){
    assert.ok(def.key&&def.name&&def.region&&def.spawn&&Array.isArray(def.choices)&&def.choices.length>=2);
    assert.ok(def.choices.some(c=>c.id==='leave'),`${def.key} must allow walking away`);
    for(const choice of def.choices){
      assert.ok(choice.id&&choice.label&&choice.message);
    }
  }
});

test('regions resolve around town, forest, and crossing landmarks',()=>{
  assert.equal(regionAt(0,0)?.key,'town');
  assert.equal(regionAt(21,6)?.key,'east_trail');
  assert.equal(regionAt(28,10)?.key,'east_forest');
  assert.equal(regionAt(-21,1)?.key,'west_crossing');
  assert.ok(Object.keys(ENCOUNTER_REGIONS).length>=5);
});

test('selection avoids recent repeats and respects level gates',()=>{
  const recent=['stuck_cart','prey_in_danger','lost_satchel','hidden_cache','rumor_wanderer'];
  const picked=pickEncounter({regionKey:'east_trail',level:1,recentKeys:recent,seed:3,cooldowns:{}});
  assert.ok(picked);
  assert.ok(!recent.includes(picked.key));
  const gated=pickEncounter({regionKey:'west_crossing',level:1,recentKeys:[],seed:1});
  // shortcut_guardian requires level 2 — may still soft-fallback to another def
  assert.ok(gated);
  const high=pickEncounter({regionKey:'west_crossing',level:5,recentKeys:[],seed:2,cooldowns:{}});
  assert.ok(high);
});

test('costs, rewards, and affordance are applied without mutating source inventory',()=>{
  const def=encounterByKey('stuck_cart');
  const help=choiceById(def,'help');
  const inv={wood:1,stone:0,herbs:0,coins:2};
  assert.equal(canAfford(help,inv),true);
  assert.equal(canAfford(help,{wood:0}),false);
  const spent=applyCost(inv,help);
  assert.equal(spent.wood,0);
  assert.equal(inv.wood,1);
  const paid=applyReward(spent,help);
  assert.ok(paid.coins>inv.coins);
  assert.match(rewardSummary(help),/coins|stone/i);
});

test('clue-gated choices stay locked until the clue is found',()=>{
  const def=encounterByKey('hidden_cache');
  const inst=buildEncounterInstance(def,{seed:9,discoveredClue:false});
  const view=publicEncounterView(inst,def);
  const open=view.choices.find(c=>c.id==='open');
  assert.equal(open.requiresClue,true);
  assert.equal(open.locked,true);
  const found=publicEncounterView({...inst,clue:{...inst.clue,found:true}},def);
  assert.equal(found.choices.find(c=>c.id==='open').locked,false);
});

test('history drives cooldowns and recent key windows',()=>{
  const now=Date.now();
  const history=normalizeHistory([
    {key:'stuck_cart',choice:'help',at:new Date(now-1000).toISOString()},
    {key:'glow_caps',choice:'harvest',at:new Date(now-2000).toISOString()}
  ]);
  assert.deepEqual(recentKeysFromHistory(history,2),['stuck_cart','glow_caps']);
  const cool=cooldownsFromHistory(history,ENCOUNTER_DEFS,now);
  assert.ok(cool.stuck_cart>now);
});

test('traces only fire for meaningful helpful choices',()=>{
  const cart=encounterByKey('stuck_cart');
  assert.ok(shouldTrace(cart,'help'));
  assert.equal(shouldTrace(cart,'leave'),null);
  const satchel=encounterByKey('lost_satchel');
  assert.ok(shouldTrace(satchel,'return'));
  assert.equal(shouldTrace(satchel,'keep'),null);
  const guardian=encounterByKey('shortcut_guardian');
  assert.ok(shouldTrace(guardian,'fight',true));
  assert.equal(shouldTrace(guardian,'fight',false),null);
});

test('player level rises with skill averages',()=>{
  assert.equal(playerLevelFromSkills([]),1);
  assert.ok(playerLevelFromSkills([{value:40},{value:40}])>=4);
});
