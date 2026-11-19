import {existsSync,readFileSync,writeFileSync} from 'node:fs';
const heading='## Day 47 — The Firebreak Watch Line';
const doc='# GPTWorld — Day 47: The Firebreak Watch Line\\n\\n**Status:** Production-verified after guarded release.\\n\\nAn autonomous wildfire was observed during a dry spring, following seven player patrols of the completed Western Firebreak. A watch line and fire-watch post persist beside the existing drought survey. Player inventories and autonomous weather, ecosystem and disaster cycles remain unchanged.\\n\\n**Discovery:** Follow the drought-watch stake toward the fire-watch post.\\n'.replaceAll('\\n','\n');
if(!existsSync('DAY47.md'))writeFileSync('DAY47.md',doc);
const p='CHRONICLE.md',c=readFileSync(p,'utf8');
if(!c.includes(heading))writeFileSync(p,c.trimEnd()+'\\n\\n'+heading+'\\n\\nAn autonomous wildfire prompted a permanent firebreak watch line and post alongside the player-built firebreak. See [DAY47.md](DAY47.md).\\n'.replaceAll('\\n','\n'));
