import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  BUILDING_EXTERIORS,
  BUILDING_INTERIORS,
  canEnterBuilding,
  interactionResult,
  interiorEntryUrl,
  interiorExitUrl,
  isInsideExitThreshold,
  loadingOutcome,
  normalizeBuildingLevel,
  outdoorExitPosition,
  rememberOutdoorPosition,
  resolveInteriorObjects,
  shouldAutoResumePublicWorld,
  stepInteriorMovement
} from '../lib/interior-core.mjs';

test('town buildings unlock playable interiors only at level 2+',()=>{
  assert.equal(canEnterBuilding(1),false);
  assert.equal(canEnterBuilding(2),true);
  assert.equal(canEnterBuilding(3),true);
  assert.equal(canEnterBuilding('2'),true);
  assert.equal(canEnterBuilding(1,'homestead'),true);
  assert.equal(normalizeBuildingLevel(99),3);
  for(const id of Object.keys(BUILDING_INTERIORS)){
    assert.ok(BUILDING_EXTERIORS[id],'exterior spawn exists for '+id);
    assert.ok(interiorEntryUrl(id)?.includes(`building=${id}`));
  }
  assert.ok(interiorEntryUrl('homestead','./interior.html',{from:'private'})?.includes('from=private'));
});

test('entering records outdoor position and exiting resumes the public world',()=>{
  const spawn=rememberOutdoorPosition({x:4.2,z:9.1},'storehouse');
  assert.equal(spawn.x,4.2);
  assert.equal(spawn.z,9.1);
  assert.equal(spawn.buildingId,'storehouse');
  assert.equal(spawn.from,'interior');
  assert.equal(interiorExitUrl('./index.html'),'./index.html?from=interior');
  assert.equal(shouldAutoResumePublicWorld('interior'),true);
  assert.equal(shouldAutoResumePublicWorld('private'),true);
  assert.equal(shouldAutoResumePublicWorld('town'),false);
  const fallback=outdoorExitPosition('inn');
  assert.equal(fallback.x,4);
  assert.ok(fallback.z>-8);
});

test('level 3 interiors add expansion furniture while level 2 keeps the base room',()=>{
  const level2=resolveInteriorObjects('smithy',2);
  const level3=resolveInteriorObjects('smithy',3);
  assert.equal(level2.length,3);
  assert.equal(level3.length,5);
  assert.ok(level3.some(([name])=>name==='quench trough'));
  assert.deepEqual(resolveInteriorObjects('unknown',3),[]);
});

test('players can explore with collision and leave through the exit threshold',()=>{
  const blocked=(x,z)=>x>0.5;
  const moved=stepInteriorMovement({x:0,z:0},{x:5,z:3},.2,{blocked});
  assert.equal(moved.x,0);
  assert.ok(moved.z>0);
  assert.equal(isInsideExitThreshold({x:0,z:5.85}),true);
  assert.equal(isInsideExitThreshold({x:3,z:0}),false);
});

test('interior interactions support inspect, stockpile ledger, and exit',()=>{
  assert.equal(interactionResult({name:'exit to world',kind:'exit'}).type,'exit');
  const ledger=interactionResult({name:'inventory ledger',kind:'stockpile-ledger'},{stockpile:{wood:4,stone:2,herbs:1}});
  assert.equal(ledger.type,'stockpile');
  assert.match(ledger.message,/wood 4/);
  const inspect=interactionResult({name:'anvil',message:'Heavy iron.'},{level:3});
  assert.equal(inspect.type,'inspect');
  assert.match(inspect.message,/Level 3/);
});

test('loading outcomes never leave the player in an infinite open state',()=>{
  const closed=loadingOutcome({buildingId:'inn',level:1});
  assert.equal(closed.ok,false);
  assert.equal(closed.closed,true);
  assert.equal(closed.showRetry,false);
  const open=loadingOutcome({buildingId:'inn',level:2});
  assert.equal(open.ok,true);
  assert.equal(open.hideLoading,true);
  const timeout=loadingOutcome({buildingId:'inn',level:2,error:'timeout'});
  assert.equal(timeout.showRetry,true);
  assert.match(timeout.message,/too long/);
  const unknown=loadingOutcome({buildingId:'barn',level:3});
  assert.equal(unknown.ok,false);
  assert.match(unknown.title,/Unknown/);
});

test('public client saves outdoor spawn and auto-resumes after interior exit',async()=>{
  const main=await readFile(new URL('../main.js',import.meta.url),'utf8');
  assert.match(main,/rememberOutdoorPosition/);
  assert.match(main,/INTERIOR_SPAWN_KEY/);
  assert.match(main,/shouldAutoResumePublicWorld/);
  assert.match(main,/buildingEnterBusy/);
  const interior=await readFile(new URL('../interior.js',import.meta.url),'utf8');
  assert.match(interior,/from '\.\/lib\/interior-core\.mjs'/);
  assert.match(interior,/buildingReady/);
  assert.match(interior,/leaveInterior/);
  assert.match(interior,/interactionResult/);
  assert.match(interior,/resolveInteriorObjects/);
  assert.match(interior,/isInsideExitThreshold/);
  assert.match(interior,/loadPrivateHomestead/);
  assert.match(interior,/PRIVATE_INTERIOR_SPAWN_KEY/);
  assert.match(interior,/fromPrivate/);
  const html=await readFile(new URL('../interior.html',import.meta.url),'utf8');
  assert.match(html,/from=interior/);
  assert.match(html,/user-scalable=no/);
});

test('homestead reuses town interior architecture for private cabins',()=>{
  assert.ok(BUILDING_INTERIORS.homestead.alwaysOpen);
  assert.ok(BUILDING_INTERIORS.homestead.private);
  assert.equal(loadingOutcome({buildingId:'homestead',level:1}).ok,true);
  assert.ok(resolveInteriorObjects('homestead',2).length>=3);
});
