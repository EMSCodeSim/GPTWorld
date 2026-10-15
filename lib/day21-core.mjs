export const DAY21=21;
export const DAY21_ENTITIES=[
 {id:'day21-blacksmith-salvage-spur',type:'trail',points:[[13.2,4.8],[12.5,7.2],[11.2,10.1],[10.5,12.1]],width:.75,color:'#806f59',label:'Blacksmith salvage spur',origin:'town_survey',created_day:21,history:'A cart trail built beside the smithy material yard.'},
 {id:'day21-blacksmith-stone-yard',type:'resource',resource:'stone',x:10.5,z:12.5,max:5,scale:.85,regrowMinutes:720,label:'Blacksmith salvage scree',origin:'town_survey',created_day:21,history:'A finite stone deposit found near the smithy.'},
 {id:'day21-blacksmith-salvage-marker',type:'object',x:9.8,z:12.5,width:.35,height:1.5,depth:.35,color:'#806a51',label:'Blacksmith salvage marker',origin:'town_survey',created_day:21,history:'The settlement marked a source of stone for the unfinished forge.'}
];
export const DAY21_EVENT={day:21,evolution:'blacksmith_salvage_spur',visible_mark:'day21-blacksmith-stone-yard',reason:'Travelers gathered stone and wood and delivered iron fittings to the community blacksmith.',consequence:'A persistent salvage trail and finite stone deposit; players must gather and contribute themselves.'};
