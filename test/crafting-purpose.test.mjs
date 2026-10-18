import test from 'node:test';
import assert from 'node:assert/strict';
import {CRAFTING_RECIPES,recipePurpose,recipesForSkillView,CRAFTING_SKILL_KEYS} from '../netlify/lib/crafting-core.mjs';

test('every craftable recipe has a clearly labeled purpose and honest implementation status',()=>{
  assert.equal(CRAFTING_RECIPES.length,75);
  const keys=new Set();
  for(const recipe of CRAFTING_RECIPES){
    assert.ok(!keys.has(recipe.key),`duplicate recipe: ${recipe.key}`);
    keys.add(recipe.key);
    const purpose=recipePurpose(recipe);
    assert.ok(purpose?.label && purpose?.detail,recipe.key);
    assert.equal(typeof purpose.implemented,'boolean',recipe.key);
  }
});

test('recipe payload exposes purpose for every profession without unlocking recipes',()=>{
  const skills=CRAFTING_SKILL_KEYS.map(key=>({key,value:0}));
  const recipes=recipesForSkillView(skills);
  assert.equal(recipes.length,CRAFTING_RECIPES.length);
  for(const recipe of recipes){
    assert.ok(recipe.purpose,recipe.key);
    if(recipe.minSkill>0)assert.equal(recipe.locked,true,recipe.key);
  }
});

test('do not advertise unimplemented consumable effects as playable',()=>{
  for(const key of ['healing-poultice','trail-rations','hand-cart']){
    const recipe=CRAFTING_RECIPES.find(r=>r.key===key);
    assert.equal(recipePurpose(recipe).implemented,false,key);
  }
});
