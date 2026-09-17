const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number.isFinite(Number(value))?Number(value):min));

export const GROWTH_STAGES=Object.freeze(['seed','sprout','young','mature','old','dead']);
const AGE_STAGES=Object.freeze({seed:0,sprout:1,young:2,mature:4,old:14,dead:22});
const STAGE_SCALE=Object.freeze({seed:.12,sprout:.28,young:.57,mature:1,old:1.12,dead:.68});

export function growthStageForAge(ageYears,health=100){
  if(Number(health)<=0)return'dead';
  const age=Math.max(0,Number(ageYears)||0);
  if(age<AGE_STAGES.sprout)return'seed';
  if(age<AGE_STAGES.young)return'sprout';
  if(age<AGE_STAGES.mature)return'young';
  if(age<AGE_STAGES.old)return'mature';
  if(age<AGE_STAGES.dead)return'old';
  return'dead';
}

export const plantScale=plant=>STAGE_SCALE[String(plant?.stage||'mature')]??1;

export function normalizePlant(plant,{id,speciesId='unknown',year=0,slot=0,maxResources=1,legacyMature=true}={}){
  const source=plant&&typeof plant==='object'?plant:{};
  const hasLifecycle=Number(source.lifecycleVersion)>=2;
  const age=!hasLifecycle&&legacyMature?6:(Number.isFinite(Number(source.age))?Math.max(0,Number(source.age)):0);
  const health=clamp((Number(source.health)<=1?Number(source.health)*100:source.health)??100,0,100);
  const stage=hasLifecycle&&GROWTH_STAGES.includes(source.stage)?source.stage:growthStageForAge(age,health);
  const maximum=Math.max(0,Math.round(Number(source.maxResources??maxResources)||0));
  const resources=clamp(Number(!hasLifecycle&&legacyMature?maximum:(source.resources??(legacyMature?maximum:0))),0,maximum);
  return{
    ...source,lifecycleVersion:2,id:String(source.id||id),speciesId:String(source.speciesId||speciesId),slot:Number(source.slot??slot),
    birthYear:Number.isFinite(Number(source.birthYear))?Number(source.birthYear):Number(year)-age,
    age,stage,health,resources,maxResources:maximum,lastAdvancedYear:Number(source.lastAdvancedYear??year),
    harvestHistory:Array.isArray(source.harvestHistory)?source.harvestHistory.slice(-20):[],generation:Math.max(1,Math.round(Number(source.generation)||1))
  };
}

export function advancePlant(plant,{year,moisture=.65,stress=0,grazing=0}={}){
  const p={...plant,harvestHistory:[...(plant.harvestHistory||[])]};
  const target=Number.isFinite(Number(year))?Number(year):Number(p.lastAdvancedYear??0);
  const elapsed=Math.max(0,Math.min(5,target-Number(p.lastAdvancedYear??target)));
  if(elapsed<=0)return p;
  const wet=clamp(moisture,.1,1),environment=wet*.55+(1-clamp(stress))*0.3+(1-clamp(grazing))*.15;
  p.age=Math.max(0,Number(p.age||0)+elapsed);
  p.health=clamp(Number(p.health??100)+elapsed*(environment*8-3-clamp(stress)*8-clamp(grazing)*5),0,100);
  p.stage=growthStageForAge(p.age,p.health);
  if(p.stage!=='dead')p.resources=clamp(Number(p.resources||0)+elapsed*Math.max(.25,p.maxResources*.22)*environment,0,p.maxResources);
  else p.resources=0;
  p.resources=Math.floor(p.resources*100)/100;p.lastAdvancedYear=target;return p;
}

export function harvestPlant(plant,{amount=1,year=0,playerId=null,cutDown=false}={}){
  const p={...plant,harvestHistory:[...(plant.harvestHistory||[])]};
  if(p.stage==='dead'||p.health<=0)return{ok:false,error:'plant_dead',plant:p};
  if(Number(p.resources)<amount)return{ok:false,error:'plant_depleted',plant:p};
  p.resources=clamp(Number(p.resources)-amount,0,p.maxResources);
  const tree=String(p.speciesId).includes('pine')||String(p.speciesId).includes('tree');
  p.health=clamp(Number(p.health)-(tree?(cutDown||p.resources<=0?18:5):3)*amount,0,100);
  if(tree&&p.resources<=0){p.health=0;p.stage='dead';p.state='stump';}
  else p.stage=growthStageForAge(p.age,p.health);
  p.harvestHistory.push({year:Number(year)||0,playerId,amount:Number(amount),remaining:p.resources});
  p.harvestHistory=p.harvestHistory.slice(-20);
  return{ok:true,amount:Number(amount),plant:p};
}

export function resourceLifecycle(node,{nodeId,resource,max,generation=0,now=new Date(),legacyMature=true}={}){
  const biological=resource==='wood'||resource==='herbs';
  if(!biological)return{...node};
  const speciesId=resource==='wood'?'pine-tree':'wild-herb';
  const maximum=Math.max(1,Math.round(Number(max)||1));
  const source=node&&typeof node==='object'?node:{};
  const gen=Math.max(0,Math.round(Number(source.generation??generation)||0));
  let plant=normalizePlant(source.plant,{id:`${nodeId}:plant:${gen}`,speciesId,year:0,maxResources:maximum,legacyMature});
  if(!source.plant&&Number.isFinite(Number(source.remaining))){plant.resources=clamp(Number(source.remaining),0,maximum);if(resource==='wood'&&plant.resources<=0){plant.health=0;plant.stage='dead';plant.state='stump';}}
  let nextGeneration=gen;
  let replaced=false;
  const replacementAt=source.replacementAt||(plant.stage==='dead'?new Date(new Date(now).getTime()+24*60*60*1000).toISOString():null);
  if(plant.stage==='dead'&&replacementAt&&new Date(replacementAt)<=new Date(now)){
    nextGeneration=gen+1;plant=normalizePlant(null,{id:`${nodeId}:plant:${nextGeneration}`,speciesId,year:0,maxResources:maximum,legacyMature:false});
    replaced=true;
  }
  const timestamp=new Date(replaced?now:(source.lastGrowthAt||now));const elapsedHours=clamp((new Date(now)-timestamp)/36e5,0,24*30);
  if(plant.stage!=='dead'&&elapsedHours>0){
    plant.age+=elapsedHours/(24*30);
    plant.stage=growthStageForAge(plant.age,plant.health);
    const rate=resource==='herbs'?maximum/20:maximum/60;
    plant.resources=clamp(plant.resources+elapsedHours*60*rate,0,plant.maxResources);
  }
  const stageCapacity={seed:0,sprout:1,young:Math.max(1,Math.ceil(maximum*.5)),mature:maximum,old:Math.max(1,Math.ceil(maximum*.75)),dead:0}[plant.stage]??maximum;
  plant.resources=clamp(plant.resources,0,stageCapacity);
  plant.resources=Math.floor(plant.resources*100)/100;
  const advanced=replaced||!source.lastGrowthAt||elapsedHours>=1/60;
  return{...source,resource,max:maximum,remaining:Math.floor(plant.resources),generation:nextGeneration,plant,replacementAt:nextGeneration!==gen?null:replacementAt,lastGrowthAt:advanced?new Date(now).toISOString():source.lastGrowthAt};
}
