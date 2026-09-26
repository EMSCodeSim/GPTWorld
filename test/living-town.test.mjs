import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  TOWN_PROJECTS,
  projectByKey,
  normalizeContribution,
  acceptContribution,
  progressPercent,
  remainingRequirements,
  isProjectComplete,
  activeProjectQueue,
  unlockedCapabilities,
  demandPriceModifier,
  demandTier,
  tickDemand,
  normalizeDemand,
  historyEntryFromProject,
  constructionStage,
  structureRenderEntity,
  canContributeResource,
  inventoryAmountFor,
  CONSTRUCTION_STAGES
} from '../netlify/lib/town-projects-core.mjs';
import {npcPurchasePrice,saleQuote,merchantByKey} from '../netlify/lib/economy-core.mjs';
import {pickActiveEvent,cropYieldModifier,mergeEventDemandBias,eventPlayerBrief,npcWorldAwareLine} from '../netlify/lib/living-events-core.mjs';
import {buildTrackSign,resolveHuntAttempt,playerNoise,huntingRange,freshnessForAge} from '../netlify/lib/hunting-core.mjs';
import {advanceNeeds} from '../netlify/lib/light-survival-core.mjs';

test('community projects are data-driven with required resources and unlocks',()=>{
  assert.ok(TOWN_PROJECTS.length>=5);
  const blacksmith=projectByKey('blacksmith');
  assert.equal(blacksmith.name.includes('Blacksmith'),true);
  assert.equal(blacksmith.required.wood,800);
  assert.equal(blacksmith.required.iron,100);
  assert.ok(blacksmith.unlocks.includes('tool_repair'));
  assert.ok(blacksmith.structure?.id);
});

test('contribution acceptance is transactional and never overfills',()=>{
  const project=projectByKey('mill');
  const first=acceptContribution(project.required,{},'wood',50);
  assert.equal(first.ok,true);
  assert.equal(first.accepted,50);
  assert.equal(first.complete,false);
  const almost={wood:project.required.wood-3};
  const finish=acceptContribution(project.required,almost,'wood',10);
  assert.equal(finish.accepted,3);
  assert.equal(finish.complete,false);
  const full={...project.required,wood:project.required.wood-1};
  const done=acceptContribution(project.required,full,'wood',5);
  assert.equal(done.accepted,1);
  assert.equal(done.complete,true);
  assert.equal(isProjectComplete(project.required,project.required),true);
  assert.deepEqual(remainingRequirements(project.required,project.required),{});
});

test('normalizeContribution validates inventory and crafted aliases',()=>{
  assert.equal(normalizeContribution('wood',5).ok,true);
  assert.equal(normalizeContribution('iron',2).itemKey,'iron-fittings');
  assert.equal(normalizeContribution('banana',1).ok,false);
  assert.equal(normalizeContribution('wood',0).ok,false);
});

test('client affordability preview covers inventory and crafted resources',()=>{
  assert.equal(canContributeResource('wood',5,{wood:5}),true);
  assert.equal(canContributeResource('wood',6,{wood:5}),false);
  assert.equal(canContributeResource('iron',2,{iron:2}),true);
  assert.equal(canContributeResource('iron',2,{'iron-fittings':3}),true);
  assert.equal(canContributeResource('iron',2,{wood:99}),false);
  assert.equal(inventoryAmountFor('rations',{rations:4}),4);
  assert.equal(inventoryAmountFor('rations',{'trail-rations':7}),7);
});

test('progress percent and active queue advance in order',()=>{
  assert.equal(progressPercent({wood:100},{wood:50}),50);
  const rows={blacksmith:{status:'complete',contributed:projectByKey('blacksmith').required}};
  const queue=activeProjectQueue(rows);
  assert.equal(queue.active.key,'mill');
  assert.ok(unlockedCapabilities(rows).includes('tool_repair'));
});

test('construction stages are config-driven and render as buildings',()=>{
  assert.equal(CONSTRUCTION_STAGES.length,5);
  assert.equal(constructionStage(10).key,'foundation');
  assert.equal(constructionStage(30).key,'frame');
  assert.equal(constructionStage(60).key,'partial');
  assert.equal(constructionStage(80).key,'nearly');
  assert.equal(constructionStage(100).key,'complete');
  const mid=structureRenderEntity(projectByKey('blacksmith'),42);
  assert.equal(mid.type,'building');
  assert.equal(mid.constructionStage,'frame');
  assert.equal(mid.scaffold,true);
  assert.equal(mid.completed,false);
  const done=structureRenderEntity(projectByKey('mill'),100,{completed:true});
  assert.equal(done.type,'building');
  assert.equal(done.completed,true);
  assert.equal(done.scaffold,false);
  assert.ok(done.unlocks.includes('grain_processing'));
});

test('demand tiers are plain labels over numeric demand',()=>{
  assert.equal(demandTier(10).label,'LOW');
  assert.equal(demandTier(50).label,'NORMAL');
  assert.equal(demandTier(75).label,'HIGH');
  assert.equal(demandTier(90).label,'URGENT');
});

test('town demand raises and lowers NPC purchase prices',()=>{
  const merchant=merchantByKey('general');
  const low=normalizeDemand({wood:10,stone:50,herbs:50,food:50,tools:50,furniture:50,clothing:50,construction:50,crafted:50});
  const high=normalizeDemand({wood:95,stone:50,herbs:50,food:50,tools:50,furniture:50,clothing:50,construction:50,crafted:50});
  const lowPrice=npcPurchasePrice('wooden-beam','standard',merchant,low);
  const highPrice=npcPurchasePrice('wooden-beam','standard',merchant,high);
  assert.ok(highPrice>lowPrice);
  assert.ok(demandPriceModifier(high,'wooden-beam')>demandPriceModifier(low,'wooden-beam'));
  const quote=saleQuote({merchant,itemKey:'wooden-beam',quantity:1,merchantBudget:1000,demandState:high});
  assert.equal(quote.ok,true);
  assert.equal(quote.demandAdjusted,true);
});

test('demand tick reacts to stockpile pressure and sales',()=>{
  const next=tickDemand(normalizeDemand(),{stockpile:{wood:5,stone:5,herbs:5},needs:{score:20},soldCategory:'food',soldQty:4});
  assert.ok(next.wood>55);
  assert.ok(next.construction>40);
  assert.ok(next.food!==50);
});

test('history entries are generated from project completion',()=>{
  const entry=historyEntryFromProject(projectByKey('tavern'),{gameDay:14,playerName:'Ava'});
  assert.match(entry.eventKey,/tavern/);
  assert.ok(entry.title.length>5);
  assert.equal(entry.payload.completedBy,'Ava');
});

test('living events create player briefs and NPC world lines',()=>{
  const drought=pickActiveEvent({weather:{condition:'drought',temperatureC:32},needs:{score:40},stockpile:{},ecosystem:{},unlocks:[],hour:12},0);
  assert.ok(drought);
  assert.ok(cropYieldModifier(drought)<1);
  const brief=eventPlayerBrief(drought);
  assert.equal(brief.key,'drought');
  assert.ok(brief.changed.length>=1);
  assert.ok(brief.actions.length>=1);
  const demand=mergeEventDemandBias(normalizeDemand(),{key:'x',effects:{demandBias:{food:10}}});
  assert.ok(demand.food>50);
  const line=npcWorldAwareLine({
    npcName:'Tovan the Smith',
    role:'Smith',
    project:{name:'Build the Blacksmith Forge',remaining:{stone:42}},
    demand:{food:80,wood:50},
    event:drought
  });
  assert.match(line,/stone|forge|Blacksmith/i);
});

test('hunting loop builds track signs and respects range/noise',()=>{
  assert.equal(freshnessForAge(30).key,'fresh');
  assert.equal(freshnessForAge(400).key,'old');
  const sign=buildTrackSign({animal:{id:'a1',x:10,z:4,species:'reed-runner',kind:'herbivore',behavior:'grazing'},player:{x:8,z:4},now:1000,lastSeenAt:900,skill:40});
  assert.equal(sign.animalId,'a1');
  assert.ok(sign.direction);
  assert.ok(playerNoise({running:true})>playerNoise({crouching:true,moving:true}));
  assert.ok(huntingRange('composite-bow')>huntingRange('basic-bow'));
  const hit=resolveHuntAttempt({key:'hunt-a',skill:80,equipment:'reinforced-bow',distance:2,tracked:true,stalked:true,noise:0.1});
  assert.equal(hit.ok,true);
  const far=resolveHuntAttempt({key:'hunt-b',skill:80,equipment:'basic-bow',distance:20});
  assert.equal(far.ok,false);
});

test('light survival creates recoverable pressure without hard fail',()=>{
  const storm=advanceNeeds({hunger:30,warmth:60},{elapsedHours:3,weather:'storm',sheltered:false});
  assert.ok(storm.warmth<60);
  assert.ok(storm.tips.length>=1);
  const fed=advanceNeeds(storm,{elapsedHours:1,weather:'clear',sheltered:true,ate:true});
  assert.ok(fed.hunger<storm.hunger);
});

test('living town migration is additive and safe',async()=>{
  const sql=(await readFile(new URL('../migrations/012_living_town.sql',import.meta.url),'utf8')).toLowerCase();
  assert.match(sql,/create table if not exists town_projects/);
  assert.match(sql,/town_project_contributions/);
  assert.match(sql,/town_project_receipts/);
  assert.match(sql,/town_history/);
  assert.doesNotMatch(sql,/drop table|truncate/);
});

test('town projects api persists buildings not invisible town_structure',async()=>{
  const src=await readFile(new URL('../netlify/functions/town-projects.mjs',import.meta.url),'utf8');
  assert.match(src,/idempotency_key/);
  assert.match(src,/FOR UPDATE/);
  assert.match(src,/debitInventory|wood=wood-/);
  assert.match(src,/town_project_completed/);
  assert.match(src,/persistStructure/);
  assert.match(src,/structureRenderEntity/);
  assert.match(src,/craftedCounts/);
  assert.doesNotMatch(src,/type:'town_structure'/);
});

test('town board and living-town client normalize contribution affordability',async()=>{
  const [town,client,index,opps,main]=await Promise.all([
    readFile(new URL('../town.html',import.meta.url),'utf8'),
    readFile(new URL('../living-town.js',import.meta.url),'utf8'),
    readFile(new URL('../index.html',import.meta.url),'utf8'),
    readFile(new URL('../opportunities.js',import.meta.url),'utf8'),
    readFile(new URL('../main.js',import.meta.url),'utf8')
  ]);
  assert.match(town,/Community Projects/);
  assert.match(town,/Town History/);
  assert.match(town,/canPay\(/);
  assert.match(town,/ownedAmount/);
  assert.match(town,/demandTier|URGENT/);
  assert.match(client,/canPayResource/);
  assert.match(client,/ownedAmount/);
  assert.match(client,/iron-fittings/);
  assert.match(index,/living-town\.js/);
  assert.match(index,/opportunities\.js/);
  assert.match(index,/player-guidance\.js/);
  assert.match(opps,/NEARBY|opportunitiesPanel/);
  assert.match(main,/case'town_structure'/);
  assert.match(main,/constructionStage/);
});

test('private hunting UI exposes track stalk hunt harvest and homestead identity',async()=>{
  const ui=await readFile(new URL('../private-world.js',import.meta.url),'utf8');
  assert.match(ui,/Read tracks/);
  assert.match(ui,/Stalk quietly/);
  assert.match(ui,/Harvest wounded animal/);
  assert.match(ui,/Fertilize plot/);
  assert.match(ui,/huntContextChip/);
  assert.match(ui,/showHomesteadIdentity/);
  assert.match(ui,/Hunting increased|skillName/);
});

test('living systems return event briefs and world-aware NPC dialogue',async()=>{
  const src=await readFile(new URL('../netlify/functions/living-systems.mjs',import.meta.url),'utf8');
  assert.match(src,/eventPlayerBrief/);
  assert.match(src,/npcWorldAwareLine/);
  assert.match(src,/eventBrief/);
  assert.match(src,/town_project_completed/);
});
