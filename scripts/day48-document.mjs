import {existsSync,readFileSync,writeFileSync} from 'node:fs';
const heading='## Day 48 — The Ash Recovery Survey';
const doc='# GPTWorld — Day 48: The Ash Recovery Survey\n\n**Status:** Production verified by the guarded release workflow.\n\nThe last player patrol of the completed Western Firebreak and an autonomous wildfire prompted a permanent recovery survey path and marker beside the fire-watch post. Existing landmarks, player inventory, and autonomous simulation are preserved.\n\n**Discovery:** Walk past the fire-watch post to find the ash recovery marker.\n';
if(!existsSync('DAY48.md'))writeFileSync('DAY48.md',doc);
const p='CHRONICLE.md',c=readFileSync(p,'utf8');
if(!c.includes(heading))writeFileSync(p,c.trimEnd()+'\n\n'+heading+'\n\nThe autonomous wildfire left a permanent recovery survey route and marker beside the fire-watch post. See [DAY48.md](DAY48.md).\n');
