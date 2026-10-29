// Day 32: the heavily harvested timberline gains a persistent place to see forest consequences
// and learn about the existing player-controlled forest response. No resources are spawned.
export const DAY32 = 32;
export const DAY32_EVENT = 'day32_timberline_stewardship_fork';
export const DAY32_ENTITIES = Object.freeze([
  Object.freeze({
    id:'day32-timberline-haul-spur',type:'trail',label:'Timberline haul spur',
    width:0.6,color:'#776550',points:[[-31.2,8.2],[-30.7,9.1],[-30.15,10.0]]
  }),
  Object.freeze({
    id:'day32-timberline-cutover-ground',type:'terrain',
    label:'Timberline cutover ground',x:-30.1,z:10.35,
    width:1.2,depth:0.85,height:0.035,color:'#635241',
    origin:DAY32_EVENT,
    history:'Repeated player wood harvesting left depleted sites across the forest, including the western pine. This cutover patch records the impact without consuming more wood or altering autonomous regrowth.'
  }),
  Object.freeze({
    id:'day32-timberline-stewardship-board',type:'object',
    label:'Timberline stewardship choices',x:-29.35,z:10.25,
    width:1.1,depth:0.2,height:1.5,color:'#9a805a',
    origin:DAY32_EVENT,
    history:'The shared forest ledger recorded 793 wood harvests and 132 exhausted sites. One traveler previously chose continued expansion, accepting additional habitat pressure. Future travelers can choose replanting, a managed woodlot, harvest restrictions, or continued expansion through the existing forest response system. This board is a record and guide, not a vote or an automatic change of policy.'
  }),
  Object.freeze({
    id:'day32-timberline-regrowth-stake',type:'object',
    label:'Timberline regrowth observation stake',x:-29.9,z:11.35,
    width:0.18,depth:0.18,height:1.25,color:'#8d815c',
    origin:DAY32_EVENT,
    history:'This fixed marker makes it easier to return and inspect natural recovery after harvesting. Trees, stumps, saplings, wildlife, weather, and regrowth continue changing on their own clocks; the marker does not plant or grant a tree.'
  })
]);
