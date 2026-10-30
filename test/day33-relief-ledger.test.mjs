import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY33,DAY33_EVENT,DAY33_ENTITIES,decorateDay33Relief} from '../lib/day33-relief-ledger.mjs';

test('Day 33 is a unique persistent storehouse relief landmark group',()=>{
 assert.equal(DAY33,33);
 assert.equal(DAY33_EVENT,'day33_storehouse_relief_ledger');
 assert.equal(DAY33_ENTITIES.length,3);
 assert.equal(new Set(DAY33_ENTITIES.map(e=>e.id)).size,3);
 assert.deepEqual(DAY33_ENTITIES.map(e=>e.type),['trail','object','object']);
 assert.ok(DAY33_ENTITIES.every(e=>e.type!=='resource'));
 assert.ok(DAY33_ENTITIES.filter(e=>e.type==='object').every(e=>e.origin===DAY33_EVENT&&e.x>8&&e.z>9));
});

test('read-only live receipt follows stockpile changes and preserves unrelated marks',()=>{
 const input=[...DAY33_ENTITIES,{id:'existing-marker',type:'object',x:2,z:2}];
 const first=decorateDay33Relief(input,{herbs:8});
 const next=decorateDay33Relief(input,{herbs:0});
 assert.match(first.find(e=>e.id==='day33-relief-receipt-board').history,/8 herbs/);
 assert.match(next.find(e=>e.id==='day33-relief-receipt-board').label,/0 herbs/);
 assert.notEqual(first.find(e=>e.id==='day33-relief-herb-baskets').color,next.find(e=>e.id==='day33-relief-herb-baskets').color);
 assert.equal(next.find(e=>e.id==='existing-marker'),input[3]);
 assert.equal(input[2].label,'Relief receipt ledger');
 assert.equal(decorateDay33Relief([],null).length,0);
 assert.match(decorateDay33Relief(DAY33_ENTITIES,{herbs:-10})[2].label,/0 herbs/);
});
