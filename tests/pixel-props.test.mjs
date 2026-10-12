import assert from 'node:assert/strict';
import test from 'node:test';
import {createPixelDoorMaterial,createPixelCloud,createPixelBarrel,createPixelLivingPlantPart,createPixelWindow} from '../lib/pixel-props.mjs';

class Geometry {}
class Material { constructor(options={}){Object.assign(this,options);} }
class Mesh {
  constructor(geometry,material){this.geometry=geometry;this.material=material;this.position={set(...args){[this.x,this.y,this.z]=args;}};this.rotation={y:0};this.scale={set(){}};this.castShadow=false;}
  clone(){return new Mesh(this.geometry,this.material);}
}
class Group {
  constructor(){this.children=[];this.position={set(...args){[this.x,this.y,this.z]=args;}};}
  add(...items){this.children.push(...items);}
}
function threeMock(){
  return {
    Group,Mesh,
    BoxGeometry:class extends Geometry{},
    PlaneGeometry:class extends Geometry{},
    MeshStandardMaterial:Material,
    CanvasTexture:class{constructor(canvas){this.canvas=canvas;}},
    SRGBColorSpace:'srgb',
    NearestFilter:'nearest',
    DoubleSide:2,
    FrontSide:0
  };
}
function withDocument(run){
  const old=globalThis.document;
  globalThis.document={createElement(){return{width:0,height:0,getContext(){return{imageSmoothingEnabled:true,fillStyle:'#000',fillRect(){},clearRect(){}};}};}};
  try{return run();}
  finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}
}

test('pixel doors and windows use nearest-neighbor textures',()=>withDocument(()=>{
  const THREE=threeMock();
  const door=createPixelDoorMaterial(THREE,0x4b3422);
  const win=createPixelWindow(THREE);
  assert.equal(door.map.magFilter,'nearest');
  assert.equal(door.map.minFilter,'nearest');
  assert.equal(door.flatShading,true);
  assert.equal(win.material.map.magFilter,'nearest');
  assert.equal(win.material.transparent,true);
}));

test('pixel clouds, barrels, and living plant parts stay renderable groups',()=>withDocument(()=>{
  const THREE=threeMock();
  const cloud=createPixelCloud(THREE,1);
  const barrel=createPixelBarrel(THREE,1);
  const blade=createPixelLivingPlantPart(THREE,{part:'blade',width:.4,height:.8,color:0x6f9b55});
  const flower=createPixelLivingPlantPart(THREE,{part:'flower',width:.3,height:.3,color:0xd8bd62});
  assert.ok(cloud.children.length>=2);
  assert.ok(barrel.children.length>=2);
  assert.ok(blade.children.length>=1);
  assert.ok(flower.children.length>=1);
}));
