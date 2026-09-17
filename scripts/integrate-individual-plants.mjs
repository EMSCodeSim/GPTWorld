import fs from 'node:fs';
const edit=(path,changes)=>{let code=fs.readFileSync(path,'utf8');for(const [before,after,label] of changes){if(code.includes(after)){console.log('Already integrated',label);continue;}if(!code.includes(before))throw Error(`Missing anchor: ${label}`);code=code.replace(before,after);}fs.writeFileSync(path,code);};
edit('netlify/functions/world.mjs',[
 ["import { advanceIndividuals } from '../../lib/individual-wildlife.mjs';","import { advanceIndividuals } from '../../lib/individual-wildlife.mjs';\nimport { advancePlantIndividuals, harvestIndividualPlant } from '../../lib/individual-plants.mjs';",'plant lifecycle import'],
 ["  advanceIndividuals(next, year);\n  return next;","  advanceIndividuals(next, year);\n  advancePlantIndividuals(next, year);\n  return next;",'yearly plant lifecycle'],
 ["  state.wildlifeJournal ||= [];\n  const today", "  state.wildlifeJournal ||= [];\n  if (!Array.isArray(state.plantIndividuals)) { advancePlantIndividuals(state, Number(state.simulatedYear||0)); await sql`UPDATE world_state SET value = ${JSON.stringify(state)}::jsonb, updated_at=now() WHERE key='ecosystem'`; }\n  const today",'initialize plant records']
]);
const path='netlify/functions/_sim-core.mjs';let code=fs.readFileSync(path,'utf8');
const start=" for(const s of species.filter(item=>item.kind==='plant'&&Number(item.population||0)>0)){";
const end=' const predatorPreview=[];';
if(!code.includes('part.plantId=individual?.id')){
 const a=code.indexOf(start,code.indexOf('export function ecologyRenderEntities('));const b=code.indexOf(end,a);
 if(a<0||b<0||b<=a)throw Error('Cannot locate plant renderer boundaries');
 const block=` for(const s of species.filter(item=>item.kind==='plant'&&Number(item.population||0)>0)){const pop=Math.max(0,Number(s.population||0)),life=s.lifeCycle||{},health=clamp(1-Number(life.waterStress||0)*.45-Number(life.grazingPressure||0)*.3,.2,1),individuals=Array.isArray(ecosystem?.plantIndividuals)?ecosystem.plantIndividuals.filter(p=>p.speciesId===s.id):[],count=individuals.length||Math.max(1,Math.min(28,Math.round(Math.sqrt(pop)/6*health)));
  for(let i=0;i<count;i++){const individual=individuals[i]||null,slot=individual?.slot??i,point=habitatPoint(s.habitat,\`\${s.id}:plant:\${slot}\`,1),breeze=Number(weather?.wind||0)*.12*Math.sin(frame*.18+i),safe=outsideTown(point.x+breeze,point.z,\`\${s.id}:plant:\${slot}:wind\`),x=clamp(safe.x,-32,32),z=clamp(safe.z,-32,32),stage=individual?.stage||'mature',scale=({seed:.12,sprout:.28,young:.57,mature:1,old:1.12,dead:.68})[stage]??1,size=(.35+hash01(\`\${s.id}:s:\${slot}\`)*.5)*(.65+health*.45)*scale,parts=[];plantCluster(parts,s,slot,x,z,size);for(const part of parts){part.plantId=individual?.id||part.clusterId;part.plantStage=stage;part.plantHealth=individual?.health??health;part.harvestAvailable=individual?.resources??1;part.plantAge=individual?.age??null;if(stage==='dead')part.color='#756e60';}plantParts.push(...parts);if(stage!=='dead'&&(individual?.resources??1)>.05)plantFoods.push({id:parts[0]?.clusterId||\`eco-plant-\${s.id}-\${slot}\`,plantId:individual?.id,species:s.id,x,z});}
 }
`;
 code=code.slice(0,a)+block+code.slice(b);fs.writeFileSync(path,code);
}
for(const [file,marker] of [
 ['netlify/functions/resource-state.mjs','gatherIndividualPlant'],
 ['netlify/functions/private-world.mjs','resourceLifecycle'],
 ['main.js','plant_dead'],
 ['lib/plant-lifecycle.mjs','harvestPlant']
]){if(!fs.readFileSync(file,'utf8').includes(marker))throw Error(`Missing Plants & Trees 2.0 integration: ${file}`);}
console.log('Plant lifecycle and visual growth integration applied');
