import {existsSync,readFileSync,writeFileSync} from 'node:fs';
const heading='## Day 52 — The Resting Nursery';
const body='Player gathering exhausted Edda’s hardy herb patch. A resting nursery bed and notice record the depletion without creating stock or changing autonomous regeneration.';
if(!existsSync('DAY52.md'))writeFileSync('DAY52.md','# GPTWorld — Day 52: The Resting Nursery\n\n'+body+'\n\nDiscovery: Visit Edda’s hardy herb nursery.\n');
const p='CHRONICLE.md',c=readFileSync(p,'utf8');if(!c.includes(heading))writeFileSync(p,c.trimEnd()+'\n\n'+heading+'\n\n'+body+' See [DAY52.md](DAY52.md).\n');