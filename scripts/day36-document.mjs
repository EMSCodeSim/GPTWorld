import {existsSync,readFileSync,writeFileSync} from 'node:fs';
const dayPath='DAY36.md',chroniclePath='CHRONICLE.md';
const heading='## Day 36 — The Landward Firebreak Watch';
const entry=`${heading}

Travelers completed the Western Firebreak with six wood and twenty-four stone, but the new patrol watch could not be used reliably while its server action remained on an older deployment. Riverbank surveys also revealed that several historical watch structures were standing in the river. The settlement responded to the completed player-built barrier, persistent summer drought, and high wildfire pressure by establishing a safer landward muster route.

A permanent dryland watch trail, clearing, and sign now extend west of the river from the completed firebreak. The route grows visibly more worn as authoritative patrol records accumulate, while its sign reflects live wildfire risk. Patrols do not grant materials or alter autonomous weather, ecology, or disaster timing. The original firebreak, inventories, identities, positions, world history, and independent simulation clocks are preserved.

Day 36 was released once and independently verified in production by the guarded Day 36 release workflow. See [DAY36.md](DAY36.md).
`;
const document=`# GPTWorld — Day 36: The Landward Firebreak Watch

**Status:** Released and persistence-verified by the Day 36 production workflow.

The completed Western Firebreak is now connected to a safe landward muster route. The river occupies x=-29 through x=-19; all three new permanent marks sit west of x=-38, outside the water. Travelers can follow the watch trail to a clearing and inspect the muster sign. The path's visible wear follows server-authoritative patrol totals, and the sign reflects wildfire risk without changing autonomous events.

**Why:** Five verified player contributions completed the Western Firebreak (6 wood, 24 stone). No successful patrols were recorded during the broken deployment, while summer drought and wildfire risk remained high. Player feedback identified watch landmarks in the river; the existing historical landmarks were relocated to dry land without deleting any records.

**Preservation:** The completed firebreak, player identity, position, inventory, progression, other permanent world marks, and historical events remain unchanged. The Day 36 release atomically adds three unique render marks, one event, and exactly one numbered-day advancement. Repeating the release verifies its existing result without incrementing again.

**Discovery:** Follow the Western Firebreak farther west to the new landward watch clearing and sign.
`;
if(!existsSync(dayPath))writeFileSync(dayPath,document);
const chronicle=readFileSync(chroniclePath,'utf8');
if(!chronicle.includes(heading))writeFileSync(chroniclePath,chronicle.trimEnd()+'\n\n'+entry);
