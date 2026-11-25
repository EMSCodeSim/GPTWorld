import {existsSync,readFileSync,writeFileSync} from 'node:fs';
const heading='## Day 51 — Autumn Rain Observation';
const body='Autumn rain returned to the recovery plot after severe summer drought. A visible rain collection basin and observation gauge commemorate the player-influenced recovery effort without altering autonomous weather or resources.';
if(!existsSync('DAY51.md'))writeFileSync('DAY51.md','# GPTWorld — Day 51: Autumn Rain Observation\n\n'+body+'\n\nDiscovery: Look beside the drought recovery marker.\n');
const p='CHRONICLE.md',c=readFileSync(p,'utf8');if(!c.includes(heading))writeFileSync(p,c.trimEnd()+'\n\n'+heading+'\n\n'+body+' See [DAY51.md](DAY51.md).\n');