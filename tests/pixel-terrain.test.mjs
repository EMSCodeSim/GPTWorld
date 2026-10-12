import assert from 'node:assert/strict';
import test from 'node:test';
import {createPixelGroundMaterial,createPixelTrailMaterial,createPixelRoofMaterial} from '../lib/pixel-terrain.mjs';

class Texture {
  constructor(canvas){this.canvas=canvas;this.repeat={set:(x,y)=>{this.repeatX=x;this.repeatY=y;}};}
}
class Material {
  constructor(options){Object.assign(this,options);}
}
function threeMock(){
  return {
    CanvasTexture:Texture,
    MeshStandardMaterial:Material,
    SRGBColorSpace:'srgb',
    NearestFilter:'nearest',
    RepeatWrapping:'repeat'
  };
}

test('terrain, trail, and roof materials use crisp repeating pixel textures',()=>{
  const oldDocument=globalThis.document;
  const painted=[];
  globalThis.document={createElement(){
    return {width:0,height:0,getContext(){return {
      imageSmoothingEnabled:true,fillStyle:'#000',fillRect(...rect){painted.push(rect);}
    };}};
  }};
  try{
    const THREE=threeMock();
    const ground=createPixelGroundMaterial(THREE,0x667d4e);
    const path=createPixelTrailMaterial(THREE,0x8e806d,1.5,8);
    const roof=createPixelRoofMaterial(THREE,0x6b4a33);
    for(const material of[ground,path,roof]){
      assert.equal(material.map.magFilter,'nearest');
      assert.equal(material.map.minFilter,'nearest');
      assert.equal(material.map.wrapS,'repeat');
      assert.equal(material.map.wrapT,'repeat');
      assert.equal(material.map.generateMipmaps,false);
      assert.ok(material.map.canvas.width===32&&material.map.canvas.height===32);
    }
    assert.equal(ground.color,0x667d4e);
    assert.equal(path.map.repeatX,2);
    assert.equal(path.map.repeatY,4);
    assert.equal(roof.color,0x6b4a33);
    assert.ok(painted.length>20);
  }finally{
    if(oldDocument===undefined)delete globalThis.document;
    else globalThis.document=oldDocument;
  }
});
