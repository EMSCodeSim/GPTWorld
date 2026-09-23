import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceCrop,cropHarvest,cropUnlocked,huntChance,resolveHunt} from '../netlify/lib/survival-core.mjs';

test('starter crops unlock and advanced crops use farming levels',()=>{
  assert.equal(cropUnlocked('wheat',0),true);assert.equal(cropUnlocked('carrot',0),true);
  assert.equal(cropUnlocked('potato',19),false);assert.equal(cropUnlocked('potato',20),true);
  assert.equal(cropUnlocked('pumpkin',44),false);assert.equal(cropUnlocked('farm-herbs',65),true);
});

test('crop growth is elapsed-time and weather driven',()=>{
  const plot={crop_key:'wheat',planted_at:'2026-01-01T00:00:00Z',watered_at:'2026-01-01T00:00:00Z',moisture:100,health:100};
  assert.equal(advanceCrop(plot,{now:new Date('2026-01-01T00:06:00Z'),weather:'clear'}).stage,'seed');
  assert.equal(advanceCrop(plot,{now:new Date('2026-01-01T02:00:00Z'),weather:'rain'}).stage,'ready');
  assert.ok(advanceCrop(plot,{now:new Date('2026-01-01T01:00:00Z'),weather:'snow'}).progress<.3);
});

test('dry crops lose moisture and health and dead crops do not mature',()=>{
  const crop=advanceCrop({crop_key:'carrot',planted_at:'2026-01-01T00:00:00Z',watered_at:'2026-01-01T00:00:00Z',moisture:10,health:25},{now:new Date('2026-01-01T12:00:00Z'),weather:'drought'});
  assert.equal(crop.stage,'dead');assert.equal(crop.health,0);
});

test('harvest yields scale and return seed for replanting',()=>{
  const novice=cropHarvest('wheat',0,100),expert=cropHarvest('wheat',80,100);
  assert.ok(expert.quantity>novice.quantity);assert.equal(novice.seedPouches,1);assert.ok(novice.xp>0);
});

test('hunting equipment and skill improve odds with deterministic result',()=>{
  assert.ok(huntChance({skill:60,equipment:'reinforced-bow',distance:2})>huntChance({skill:0,equipment:'basic-bow',distance:5}));
  assert.ok(huntChance({skill:70,equipment:'composite-bow',distance:2})>huntChance({skill:70,equipment:'reinforced-bow',distance:2}));
  const a=resolveHunt({key:'same-request',species:'reed-runner',skill:20}),b=resolveHunt({key:'same-request',species:'reed-runner',skill:20});
  assert.deepEqual(a,b);assert.ok(a.xp>0);if(a.success)assert.deepEqual(a.rewards.map(x=>x.key),['raw-meat','hide']);
});
