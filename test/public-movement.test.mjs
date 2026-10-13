import test from 'node:test';import assert from 'node:assert/strict';
import {WALK_LIMIT,walkInputFromScreen,blockedByWorld,moveWithSlide} from '../lib/public-movement.mjs';
test('screen joystick travels toward top and right of isometric camera',()=>{
 const forward=walkInputFromScreen(0,-1);assert.ok(forward.x<0&&forward.z<0);
 const right=walkInputFromScreen(1,0);assert.ok(right.x>0&&right.z<0);
 assert.ok(Math.abs(Math.hypot(forward.x,forward.z)-1)<.001);
});
test('extended land is walkable while map edge remains solid',()=>{
 assert.equal(WALK_LIMIT,51);
 assert.equal(blockedByWorld(44,42),false);
 assert.equal(blockedByWorld(51.5,0),true);
 assert.equal(blockedByWorld(0,-52),true);
});
test('river remains impassable except at completed bridge',()=>{
 assert.equal(blockedByWorld(-24,45),true);
 assert.equal(blockedByWorld(-24,0,{bridgeBuilt:false}),true);
 assert.equal(blockedByWorld(-24,0,{bridgeBuilt:true}),false);
});
test('player slides along circular obstacles instead of stopping',()=>{
 const obstacle={x:2,z:2,r:1};
 const blocked=(x,z)=>blockedByWorld(x,z,{obstacles:[obstacle]});
 const point=moveWithSlide(1,1,1,.2,blocked);
 assert.deepEqual(point,{x:1,z:1.2});
});
