import fs from 'node:fs';
const file='netlify/functions/world.mjs';let text=fs.readFileSync(file,'utf8');
const insert=(old,next)=>{if(text.includes(next))return;if(!text.includes(old))throw Error('Expected wildlife integration anchor missing');text=text.replace(old,next);};
insert("import { neon } from '@neondatabase/serverless';","import { neon } from '@neondatabase/serverless';\nimport { advanceIndividuals } from '../../lib/individual-wildlife.mjs';");
insert('  advanceWildlifeAges(next, year);\n  return next;','  advanceWildlifeAges(next, year);\n  advanceIndividuals(next, year);\n  return next;');
fs.writeFileSync(file,text);console.log('Persistent individual records integrated into yearly ecosystem state');