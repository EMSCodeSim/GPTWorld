import test from 'node:test';
import assert from 'node:assert/strict';
import {SHIPMENT_QUEST_ID,SHIPMENT_POINTS,SHIPMENT_REWARD,SHIPMENT_STAGES,shipmentNext,shipmentNarrative} from '../lib/shipment-quest-core.mjs';

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
test('discovery positions, completion narrative and reward are defined',()=>{
 for(const point of Object.values(SHIPMENT_POINTS))assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.z));
 assert.match(shipmentNarrative('completed'),/Trail Repair Fittings/);
 assert.ok(SHIPMENT_REWARD.coins>0&&SHIPMENT_REWARD.blacksmithingXp>0);
 assert.equal(new Set(SHIPMENT_STAGES).size,SHIPMENT_STAGES.length);
});
