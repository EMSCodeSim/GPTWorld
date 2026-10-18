// Day 22: Edda shelters a tiny hardy-herb nursery during severe drought.
// The herb patch uses the existing server-authoritative resource endpoint.
// Shade and water cask are visible scenery, not free inventory.
export const DAY22 = 22;
export const DAY22_TITLE = "Edda's Drought Nursery";
export const DAY22_EVENT = "day22_edda_drought_nursery";
export const DAY22_ENTITIES = Object.freeze([
  Object.freeze({id:"day22-edda-nursery-trail",type:"trail",label:"Drought nursery footpath",width:0.65,color:"#827157",points:[[-9,-12],[-11.3,-13.6],[-12.6,-15]]}),
  Object.freeze({id:"day22-edda-shade-canopy",type:"object",label:"Edda's shade shelter",x:-12.5,z:-14.8,width:1.5,depth:1.1,height:1.3,color:"#887454"}),
  Object.freeze({id:"day22-edda-water-cask",type:"object",label:"Nursery water cask",x:-12,z:-14.1,width:0.55,depth:0.55,height:0.8,color:"#70523a"}),
  Object.freeze({id:"day22-edda-hardy-herbs",type:"resource",resource:"herbs",label:"Drought nursery herbs",x:-13.6,z:-15.7,scale:0.65,max:1,regrowMinutes:720})
]);
