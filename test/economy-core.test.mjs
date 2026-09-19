import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  DEFAULT_MAX_STACK,
  ITEM_BASE_VALUE,
  MERCHANTS,
  isStackableCrafted,
  merchantByKey,
  normalizeQuantity,
  npcPurchasePrice,
  quantityChoices,
  saleQuote,
  splitStackPlan,
  stackSignature,
  stacksMatch
} from '../netlify/lib/economy-core.mjs';

test('materials and crafted components stack; crates and tools do not',()=>{
  assert.equal(isStackableCrafted('wooden-beam'),true);
  assert.equal(isStackableCrafted('healing-poultice'),true);
  assert.equal(isStackableCrafted('wooden-crate'),false);
  assert.equal(isStackableCrafted('stone-hammer'),false);
  assert.equal(isStackableCrafted('campfire-kit'),false);
  assert.equal(isStackableCrafted('wooden-beam',{placed:true}),false);
});

test('identical stack signatures match only when attributes align',()=>{
  const a={itemKey:'wooden-beam',quality:'standard',durability:80,maxDurability:80};
  const b={...a};
  const fine={...a,quality:'fine'};
  assert.equal(stacksMatch(a,b),true);
  assert.equal(stacksMatch(a,fine),false);
  assert.equal(stackSignature(a),stackSignature(b));
  assert.notEqual(stackSignature(a),stackSignature(fine));
});

test('stack split and quantity normalization reject invalid amounts',()=>{
  assert.equal(normalizeQuantity(0),0);
  assert.equal(normalizeQuantity(-3),0);
  assert.equal(normalizeQuantity(1500),DEFAULT_MAX_STACK);
  assert.deepEqual(splitStackPlan(10,3),{ok:true,take:3,remain:7});
  assert.equal(splitStackPlan(5,5).ok,false);
  assert.equal(splitStackPlan(5,0).ok,false);
  assert.deepEqual(quantityChoices(25),[1,10,25]);
  assert.deepEqual(quantityChoices(1),[1]);
});

test('merchant sale quotes are server-side and respect budgets',()=>{
  const general=merchantByKey('general');
  assert.ok(general);
  const unit=npcPurchasePrice('wooden-beam','standard',general);
  assert.ok(unit>0);
  assert.ok(unit<ITEM_BASE_VALUE['wooden-beam']); // buy-from-player below base retail
  const ok=saleQuote({merchant:general,itemKey:'wooden-beam',quality:'standard',quantity:3,merchantBudget:unit*3});
  assert.equal(ok.ok,true);
  assert.equal(ok.total,unit*3);
  const poor=saleQuote({merchant:general,itemKey:'wooden-beam',quality:'standard',quantity:10,merchantBudget:unit*2});
  assert.equal(poor.ok,true);
  assert.equal(poor.partial,true);
  assert.equal(poor.quantity,2);
  const broke=saleQuote({merchant:general,itemKey:'wooden-beam',quality:'standard',quantity:1,merchantBudget:0});
  assert.equal(broke.ok,false);
  assert.equal(broke.error,'merchant_insufficient_funds');
  const reject=saleQuote({merchant:merchantByKey('provisioner'),itemKey:'iron-fittings',quality:'standard',quantity:1,merchantBudget:100});
  assert.equal(reject.ok,false);
});

test('all configured merchants have unique keys and accept lists',()=>{
  const keys=new Set(MERCHANTS.map(m=>m.key));
  assert.equal(keys.size,MERCHANTS.length);
  assert.ok(keys.has('general'));
  for(const merchant of MERCHANTS){
    assert.ok(merchant.accepts.length>0);
    assert.ok(merchant.defaultBudget>0);
  }
});

test('economy migration is additive',async()=>{
  const sql=(await readFile(new URL('../migrations/009_inventory_npc_economy.sql',import.meta.url),'utf8')).toLowerCase();
  assert.match(sql,/add column if not exists coins/);
  assert.match(sql,/add column if not exists quantity/);
  assert.match(sql,/merchant_trade_receipts/);
  assert.match(sql,/merchant_budgets/);
  assert.match(sql,/inventory_action_receipts/);
  assert.doesNotMatch(sql,/\btruncate\b|\bdrop table\b/);
});

test('merchant endpoint is idempotent and server authoritative',async()=>{
  const server=await readFile(new URL('../netlify/functions/merchant.mjs',import.meta.url),'utf8');
  assert.match(server,/action==='sell'/);
  assert.match(server,/action==='split_stack'/);
  assert.match(server,/merchant_trade_receipts/);
  assert.match(server,/saleQuote/);
  assert.match(server,/economy_migration_required/);
  assert.match(server,/replenish_day_key/);
});

test('crafting stacks identical components on success',async()=>{
  const server=await readFile(new URL('../netlify/functions/crafting.mjs',import.meta.url),'utf8');
  assert.match(server,/isStackableCrafted/);
  assert.match(server,/stacked AS/);
  assert.match(server,/LEAST\(\$\{DEFAULT_MAX_STACK\}/);
  assert.match(server,/COALESCE\(item\.quantity,1\)/);
  assert.match(server,/coins/);
});
