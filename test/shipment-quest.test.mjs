import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SHIPMENT_QUEST_ID,SHIPMENT_POINTS,SHIPMENT_REWARD,SHIPMENT_STAGES,SHIPMENT_CLUES,
  shipmentNext,shipmentNarrative,shipmentObjective,shipmentRewardFor,shipmentRunConfig,
  shipmentNormalizeMeta,shipmentFeedback,isShipmentClueAction,shipmentClueAllowed,
  shipmentClueKey,shipmentWaypoint
} from '../lib/shipment-quest-core.mjs';

test('shipment quest progresses in order from Tovan to turn-in',()=>{
 let stage='not_started';
 for(const action of ['accept','inspect_tracks','avoid_wolf','recover','turn_in']){
  stage=shipmentNext(stage,action);
  assert.ok(stage);
 }
 assert.equal(stage,'completed');
 assert.equal(SHIPMENT_QUEST_ID,'missing-blacksmith-shipment');
});

test('wolf fight requires a bow and does not skip investigation',()=>{
 assert.equal(shipmentNext('wagon_found','fight_wolf',{hasBow:false}),null);
 assert.equal(shipmentNext('wagon_found','fight_wolf',{hasBow:true}),'wolf_resolved');
 assert.equal(shipmentNext('tracking','turn_in'),null);
 assert.equal(shipmentNext('shipment_recovered','turn_in'),'completed');
 assert.equal(shipmentNext('completed','turn_in'),null);
});

test('completed runs can replay into a fresh tracking stage',()=>{
 assert.equal(shipmentNext('completed','replay'),'tracking');
 assert.equal(shipmentNext('tracking','replay'),null);
 assert.equal(shipmentNext('not_started','replay'),null);
});

test('discovery positions, completion narrative and reward are defined',()=>{
 for(const point of Object.values(SHIPMENT_POINTS))assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.z));
 assert.match(shipmentNarrative('completed'),/Trail Repair Fittings/);
 assert.match(shipmentNarrative('not_started'),/metalwork|shipment/i);
 assert.ok(SHIPMENT_REWARD.coins>0&&SHIPMENT_REWARD.blacksmithingXp>0);
 assert.equal(new Set(SHIPMENT_STAGES).size,SHIPMENT_STAGES.length);
 assert.ok(SHIPMENT_POINTS.axle&&SHIPMENT_POINTS.scrap&&SHIPMENT_POINTS.mara);
});

test('optional clues are discoverable during investigation stages only',()=>{
 assert.equal(isShipmentClueAction('find_clue_axle'),true);
 assert.equal(isShipmentClueAction('hear_rumor'),true);
 assert.equal(isShipmentClueAction('recover'),false);
 assert.equal(shipmentClueKey('find_clue_scrap'),'scrap');
 assert.equal(shipmentClueAllowed('tracking'),true);
 assert.equal(shipmentClueAllowed('wagon_found'),true);
 assert.equal(shipmentClueAllowed('not_started'),false);
 assert.equal(shipmentClueAllowed('completed'),false);
 assert.deepEqual(SHIPMENT_CLUES,['axle','scrap','rumor']);
});

test('bow and stealth paths grant different turn-in rewards',()=>{
 const bow=shipmentRewardFor({stage:'completed',choice:'bow',meta:{clues:[],seed:0,run:1,completions:1}});
 const sneak=shipmentRewardFor({stage:'completed',choice:'stealth',meta:{clues:[],seed:0,run:1,completions:1}});
 assert.ok(bow.coins>sneak.coins,'bow bounty should pay more coin');
 assert.ok(sneak.herbs>bow.herbs,'stealth path should yield herbs');
 assert.ok(sneak.wood>bow.wood,'stealth path should yield wood');
 assert.ok(bow.archeryXp>0);
 assert.equal(sneak.archeryXp,0);
});

test('finding more clues increases payout and blacksmithing bonus',()=>{
 const plain=shipmentRewardFor({choice:'stealth',meta:{clues:[],seed:1}});
 const rich=shipmentRewardFor({choice:'stealth',meta:{clues:['axle','scrap','rumor'],seed:1}});
 assert.ok(rich.coins>plain.coins);
 assert.ok(rich.blacksmithingXp>=plain.blacksmithingXp);
 assert.ok(rich.herbs>=plain.herbs);
 assert.ok(rich.wood>=plain.wood);
});

test('run variants rotate clue hints and bonus resources for replay value',()=>{
 const a=shipmentRunConfig(0),b=shipmentRunConfig(1),c=shipmentRunConfig(2),d=shipmentRunConfig(3);
 assert.notEqual(a.clueHint,b.clueHint);
 assert.ok(a.bonusResource&&b.bonusResource&&c.bonusResource);
 assert.equal(a.bonusResource,d.bonusResource);
 assert.match(shipmentObjective('tracking',{seed:1}),/Optional|east|Mara|axle|canvas|fork/i);
});

test('meta normalization keeps clue sets clean and preserves choice',()=>{
 const meta=shipmentNormalizeMeta({clues:['axle','axle','nope','rumor'],seed:2,run:4,choice:'bow'},'wagon_found');
 assert.deepEqual(meta.clues,['axle','rumor']);
 assert.equal(meta.choice,'bow');
 assert.equal(meta.run,4);
 assert.equal(meta.variant.index,2%3);
});

test('feedback and waypoints cover the full loop',()=>{
 assert.match(shipmentFeedback('accept'),/tracks/i);
 assert.match(shipmentFeedback('fight_wolf'),/wolf|Archery|crate/i);
 assert.match(shipmentFeedback('avoid_wolf'),/slip|Quiet|crate/i);
 assert.match(shipmentFeedback('turn_in',{choice:'bow',meta:{clues:['axle'],seed:0}}),/coins|Trail Repair/i);
 assert.match(shipmentFeedback('replay'),/new trail|clues/i);
 assert.equal(shipmentWaypoint('tracking')[0],'Wagon tracks');
 assert.equal(shipmentWaypoint('completed'),null);
});
