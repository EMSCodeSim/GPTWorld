import test from 'node:test';
import assert from 'node:assert/strict';
import {
  gatherAmountFor,
  bestGatherTool,
  communityScaleFactor,
  scaleProjectRequirements,
  milestoneReward,
  placeableFarmModifiers,
  placeableHuntModifiers,
  GATHER_TOOL_BONUSES
} from '../netlify/lib/balance-core.mjs';
import {TOWN_PROJECTS,projectByKey,demandCategoryFor} from '../netlify/lib/town-projects-core.mjs';
import {RESOURCE_DEFAULTS} from '../lib/resource-defaults.mjs';
import {CROPS,cropHarvest} from '../netlify/lib/survival-core.mjs';
import {generateDiscoveries,whileYouWereAwaySummary,HOMESTEAD_MILESTONES} from '../netlify/lib/progression-core.mjs';
import {DEFAULT_MAX_STACK,MERCHANTS,ITEM_BASE_VALUE} from '../netlify/lib/economy-core.mjs';

test('tools meaningfully increase gather yield',()=>{
  assert.equal(bestGatherTool(['hand-axe'],'wood').yield,2);
  assert.equal(bestGatherTool(['stone-hammer'],'stone').yield,2);
  assert.equal(bestGatherTool(['masterwork-tools'],'herbs').yield,2);
  const bare=gatherAmountFor({resource:'wood',toolKeys:[],remaining:6});
  assert.equal(bare.amount,1);
  assert.equal(bare.boosted,false);
  const axed=gatherAmountFor({resource:'wood',toolKeys:['hand-axe'],remaining:6});
  assert.equal(axed.amount,2);
  assert.equal(axed.boosted,true);
  const capped=gatherAmountFor({resource:'wood',toolKeys:['hand-axe'],remaining:1});
  assert.equal(capped.amount,1);
  assert.ok(GATHER_TOOL_BONUSES['hand-axe'].wood>1);
});

test('community projects are session-scaled and grow gently with activity',()=>{
  const blacksmith=projectByKey('blacksmith');
  assert.ok(blacksmith.required.wood<=250);
  assert.ok(blacksmith.required.coins<=500);
  assert.equal(communityScaleFactor(1),1);
  assert.ok(communityScaleFactor(5)>1);
  const scaled=scaleProjectRequirements(blacksmith.required,5);
  assert.ok(scaled.wood>blacksmith.required.wood);
  assert.ok(TOWN_PROJECTS.every(p=>Object.values(p.required).every(n=>Number(n)>0)));
});

test('resource regen and stacks avoid grind extremes',()=>{
  assert.equal(RESOURCE_DEFAULTS.stone.regrowMinutes,180);
  assert.ok(RESOURCE_DEFAULTS.stone.max>=12);
  assert.equal(DEFAULT_MAX_STACK,99);
  assert.ok(MERCHANTS.reduce((sum,m)=>sum+m.defaultBudget,0)>=1000);
  assert.equal(ITEM_BASE_VALUE['trail-rations'],5);
});

test('first-session farming is faster and seasons affect harvest',()=>{
  const wheat=CROPS.find(c=>c.key==='wheat');
  assert.ok(wheat.growHours<=1.5);
  assert.ok(wheat.xp>=1.8);
  const autumn=cropHarvest('wheat',0,100,{soil:60,season:'Autumn'});
  const spring=cropHarvest('wheat',0,100,{soil:60,season:'Spring'});
  assert.ok(autumn.quantity>=spring.quantity);
});

test('milestones grant concrete rewards and discoveries stay rare',()=>{
  assert.ok(HOMESTEAD_MILESTONES.every(m=>m.reward));
  assert.ok(milestoneReward('first_shelter').inventory.wood>=10);
  assert.ok(milestoneReward('town_contributor').coins>=20);
  const discoveries=generateDiscoveries(99,3);
  assert.equal(discoveries.length,3);
  assert.ok(discoveries.every(d=>Number(d.rarity)>0));
  const quiet=whileYouWereAwaySummary({awayMinutes:10,readyCrops:2});
  assert.equal(quiet.length,0);
  const away=whileYouWereAwaySummary({
    awayMinutes:60,
    readyCrops:1,
    projectProgress:{name:'Build the Blacksmith Forge',percent:82,remainingHint:'18 more stone'},
    catchUpSteps:4
  });
  assert.ok(away.length<=5);
  assert.ok(away.some(line=>/ready to harvest|18 more stone|kept living/i.test(line)));
});

test('placeables connect to farm and hunt loops',()=>{
  const farm=placeableFarmModifiers(['orchard-kit','scarecrow-kit','raised-bed-kit']);
  assert.ok(farm.farmYieldBonus>=1);
  assert.ok(farm.cropHealthDrainScale<1);
  assert.ok(farm.farmGrowthBonus>1);
  const hunt=placeableHuntModifiers(['hunter-blind'],['skinning-knife']);
  assert.ok(hunt.stalkAlertScale<1);
  assert.ok(hunt.huntLootBonus>=1);
});

test('construction items prefer construction demand category',()=>{
  assert.equal(demandCategoryFor('wooden-beam'),'construction');
  assert.equal(demandCategoryFor('iron-fittings'),'construction');
});
