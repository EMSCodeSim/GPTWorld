import fs from 'node:fs';
const edit=(path,oldText,newText)=>{const source=fs.readFileSync(path,'utf8');if(source.includes(newText))return;if(!source.includes(oldText))throw Error(`Missing expected anchor in ${path}`);fs.writeFileSync(path,source.replace(oldText,newText));};
const world='netlify/functions/world.mjs';
edit(world,"import { neon } from '@neondatabase/serverless';","import { neon } from '@neondatabase/serverless';\nimport { advanceAnimalSpecies } from '../../lib/animal-needs.mjs';");
edit(world,"  next.species = survivors;","  next.species = advanceAnimalSpecies(survivors, next.climate, 1);");
const sim='netlify/functions/_sim-core.mjs';
edit(sim,"entity.preyKilled=record.s.kind==='predator'&&record.behavior==='feeding';","entity.preyKilled=record.s.kind==='predator'&&record.behavior==='feeding';entity.speciesName=record.s.name||record.s.id;entity.needs={hunger:Number(record.s.needs?.hunger??.25),thirst:Number(record.s.needs?.thirst??.2),energy:Number(record.s.needs?.energy??.85),fear:Number(record.s.needs?.fear??0)};entity.health=Number(record.s.health??1);entity.goal=record.s.goal||record.behavior;entity.population=Number(record.s.population||0);");
console.log('Animal survival integrated into yearly ecology and entity inspection metadata.');