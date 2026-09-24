import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync(new URL('../private-world.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../private-world.css',import.meta.url),'utf8');

test('crafting skill cards filter recipes',()=>{
  assert.match(ui,/craftingSkillFilter='all'/);
  assert.match(ui,/visibleRecipes=craftingSkillFilter==='all'/);
  assert.match(ui,/recipe=>recipe\.skill===craftingSkillFilter/);
  assert.match(ui,/aria-pressed/);
  assert.match(ui,/textContent:'All'/);
  assert.match(css,/crafting-skill\.filter-button\.active/);
});
