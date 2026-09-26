import http from 'http';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {TOWN_PROJECTS,normalizeDemand,progressPercent,remainingRequirements,demandTier,constructionStage} from '../netlify/lib/town-projects-core.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const port=8766;
const contributed={wood:120,stone:40,iron:10,coins:250};
const blacksmith=TOWN_PROJECTS[0];
const history=[
  {id:'1',eventKey:'founding:settlement',title:'The First Settlement was founded',summary:'Five buildings stood along the dirt road.',gameDay:1,createdAt:new Date().toISOString()},
  {id:'2',eventKey:'project_complete:western_crossing',title:'The Western Crossing was completed',summary:'Travelers finished the first permanent river crossing.',gameDay:2,createdAt:new Date().toISOString()},
  {id:'3',eventKey:'event:resource_shortage:1',title:'Resource Shortage',summary:'Town stores run thin. Merchants pay more for scarce goods.',gameDay:12,createdAt:new Date().toISOString()}
];

function demandWithTiers(raw){
  const demand=normalizeDemand(raw);
  demand.tiers={};
  for(const key of Object.keys(demand)){
    if(['version','updatedAt','lastTick','activeEvent','tiers'].includes(key))continue;
    demand.tiers[key]=demandTier(demand[key]);
  }
  return demand;
}

function townPayload(){
  const required={...blacksmith.required};
  const percent=progressPercent(required,contributed);
  const remaining=remainingRequirements(required,contributed);
  const stage=constructionStage(percent);
  const active={
    key:blacksmith.key,name:blacksmith.name,summary:blacksmith.summary,order:blacksmith.order,status:'active',
    required,contributed,remaining,percent,unlocks:[...blacksmith.unlocks],structure:blacksmith.structure,
    playerContribution:{wood:40,stone:10},playerTotal:50,completedAt:null,constructionStage:stage.key
  };
  return{
    ok:true,activeProject:active,projects:[active],completedProjects:[],structures:[],unlocks:[],
    demand:demandWithTiers({wood:72,stone:61,food:58,construction:70,tools:48}),
    history,gameDay:13,stockpile:{wood:44,stone:18,herbs:9},
    inventory:{wood:28,stone:12,herbs:6,coins:340,iron:0,tools:1,furniture:0,rations:2,'stone-hammer':1,'trail-rations':2},
    catalog:TOWN_PROJECTS.map(p=>({key:p.key,name:p.name,order:p.order,required:{...p.required},unlocks:[...p.unlocks]}))
  };
}

const upgrades={
  ok:true,
  buildings:{
    inn:{name:'Wayfarer Inn',benefits:['Shelter for travelers','More guest rooms','Expanded gathering hall'],costs:[{wood:12,stone:5,herbs:0},{wood:28,stone:12,herbs:3}]},
    smithy:{name:'Smithy',benefits:['Basic smithy','Improved tool benches','Expanded forge'],costs:[{wood:10,stone:12,herbs:0},{wood:22,stone:26,herbs:0}]},
    storehouse:{name:'Storehouse',benefits:['Shared supplies','Reinforced storage','Expanded storage'],costs:[{wood:18,stone:8,herbs:0},{wood:35,stone:20,herbs:0}]},
    healer:{name:'Healer’s Cottage',benefits:['Basic treatment','Herbal workroom','Expanded clinic'],costs:[{wood:14,stone:6,herbs:8},{wood:30,stone:14,herbs:18}]},
    council:{name:'Council Hall',benefits:['Founding council','Community planning','Expanded council chamber'],costs:[{wood:20,stone:12,herbs:0},{wood:42,stone:25,herbs:4}]}
  },
  levels:{inn:2,smithy:1,storehouse:2,healer:1,council:1},
  stockpile:{wood:44,stone:18,herbs:9}
};

const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.mjs':'text/javascript','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};

const server=http.createServer((req,res)=>{
  const url=new URL(req.url,`http://127.0.0.1:${port}`);
  if(url.pathname==='/.netlify/functions/town-projects'){
    res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
    if(req.method==='POST'){
      let body='';req.on('data',c=>body+=c);req.on('end',()=>{
        try{
          const data=JSON.parse(body||'{}');
          const amount=Math.max(1,Number(data.amount||1));
          const resource=String(data.resource||'wood');
          contributed[resource]=(contributed[resource]||0)+amount;
          const payload=townPayload();
          res.end(JSON.stringify({ok:true,action:'contribute',projectKey:data.projectKey,resource,amount,complete:false,inventory:payload.inventory,...payload}));
        }catch{res.end(JSON.stringify({ok:false,error:'bad_json'}));}
      });
      return;
    }
    res.end(JSON.stringify(townPayload()));
    return;
  }
  if(url.pathname==='/.netlify/functions/town-upgrades'){
    res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
    res.end(JSON.stringify(upgrades));
    return;
  }
  let file=url.pathname==='/'?'/index.html':url.pathname;
  const full=path.join(path.dirname(__dirname),decodeURIComponent(file));
  const rootDir=path.dirname(__dirname);if(!full.startsWith(rootDir)||!fs.existsSync(full)||fs.statSync(full).isDirectory()){
    res.writeHead(404);res.end('not found');return;
  }
  const ext=path.extname(full);
  res.writeHead(200,{'content-type':mime[ext]||'application/octet-stream'});
  fs.createReadStream(full).pipe(res);
});
server.listen(port,()=>console.log(`demo server http://127.0.0.1:${port}`));
