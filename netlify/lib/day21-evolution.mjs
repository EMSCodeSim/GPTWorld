// Day 21 adds a modest, shared stone-salvage area alongside the existing
// community Blacksmith Forge construction site (center: 13.5, 2.4).
// Resource-state.mjs discovers resource nodes from world_state.render_entities,
// validates position and handles depletion/regrowth server-side.
export const DAY21=21;
export const DAY21_ENTITIES=Object.freeze([
  Object.freeze({
    id:'day21-blacksmith-stone-yard',type:'resource',resource:'stone',
    label:'Blacksmith stone salvage',x:18,z:6.8,max:5,scale:0.85,regrowMinutes:90
  }),
  Object.freeze({
    id:'day21-blacksmith-salvage-marker',type:'object',
    label:'Stone salvage for the community forge',
    x:17.4,z:5.8,width:0.35,height:1.5,depth:0.35,color:'#806a51'
  }),
  Object.freeze({
    id:'day21-blacksmith-salvage-trail',type:'trail',
    color:'#86755c',width:0.8,points:[[15.9,4.9],[17,5.8],[18,6.8]]
  })
]);
