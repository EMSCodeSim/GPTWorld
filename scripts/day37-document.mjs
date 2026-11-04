import {existsSync,readFileSync,writeFileSync} from 'node:fs';
const dayPath='DAY37.md',chroniclePath='CHRONICLE.md';
const heading='## Day 37 — The First Watch Tally';
const entry=`${heading}

A traveler recorded the first voluntary patrol of the completed Western Firebreak. The settlement preserved that action as a permanent tally marker and a walked loop beside the landward muster clearing. The patrol was recorded in shared state; the mark does not create supplies or control wildfire weather.

Day 37 was released once and verified in production. See [DAY37.md](DAY37.md).
`;
const document=`# GPTWorld — Day 37: The First Watch Tally

**Status:** Released and persistence-verified by the Day 37 production workflow.

The first verified voluntary firebreak patrol was recorded on November 3. A permanent tally marker and a short worn footpath now mark the first watch beside the landward muster, on dry ground west of the river.

The shared world records 1 patrol by Traveler. The completed Western Firebreak remains at 6/6 wood and 24/24 stone. Forest pressure remains critical, with drought 0.76 and wildfire risk 0.603 at the November 4 observation. Weather, ecology, disasters, and resource regeneration continue on independent clocks.

The release is gated on a recorded patrol and Day 36, adds two persistent render marks and one event, and advances exactly once. Existing player and world data are preserved.

**Discovery:** Look for the first tally beside the dryland firebreak muster sign.
`;
if(!existsSync(dayPath))writeFileSync(dayPath,document);
const chronicle=readFileSync(chroniclePath,'utf8');
if(!chronicle.includes(heading))writeFileSync(chroniclePath,chronicle.trimEnd()+'\n\n'+entry);
