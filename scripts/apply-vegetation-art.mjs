import fs from 'node:fs';

const mainPath='main.js';
let src=fs.readFileSync(mainPath,'utf8');

const importLine="import {createPineArt,createHerbArt} from './vegetation-art.js';";
if(!src.includes(importLine)){
  const threeImport=/import \* as THREE from 'https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.180\.0\/\+esm';/;
  if(!threeImport.test(src)) throw new Error('Three.js import not found');
  src=src.replace(threeImport,m=>`${m}\n${importLine}`);
}

const treeReplacement=`function addTree(id,x,z,s=1){const art=createPineArt(THREE,s),g=art.group,trunk=art.trunk,c=art.crown;g.position.set(x,0,z);scene.add(g);registerResource({type:'resource',nodeId:id,resource:'wood',label:'pine tree',plantInfo:{type:'evergreen tree',habitat:'upland and well-drained ground',ecology:'Provides cover and renewable woody biomass; new trees can establish in suitable habitat after harvest.',use:'wood for construction, fuel, and future crafting'},object:g,treeParts:{trunk,crown:c,scale:s},radius:2.25,amount:1,depleted:false});return g}`;
const herbReplacement=`function addHerbs(id,x,z){const g=createHerbArt(THREE,1,String(id||'').length%2);g.position.set(x,0,z);g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});scene.add(g);registerResource({type:'resource',nodeId:id,resource:'herbs',label:'wild herbs',plantInfo:{type:'wild flowering herb patch',habitat:'open ground with adequate soil moisture',ecology:'A short-lived plant resource that can spread and recolonize suitable habitat.',use:'herbs for healing and future recipes'},object:g,radius:1.8,amount:1,depleted:false});return g}`;

const treeRe=/function addTree\(id,x,z,s=1\)\{.*?\}\nfunction addRock/s;
if(!treeRe.test(src)) throw new Error('addTree function not found');
src=src.replace(treeRe,`${treeReplacement}\nfunction addRock`);

const herbRe=/function addHerbs\(id,x,z\)\{.*?\}\n(?=function createHumanoid|\nfunction createHumanoid)/s;
if(!herbRe.test(src)) throw new Error('addHerbs function not found');
src=src.replace(herbRe,`${herbReplacement}\n`);

fs.writeFileSync(mainPath,src);

const indexPath='index.html';
let html=fs.readFileSync(indexPath,'utf8');
html=html.replace('./main.js?v=food-web-1','./main.js?v=vegetation-art-1');
fs.writeFileSync(indexPath,html);

console.log('Vegetation art renderer connected.');
