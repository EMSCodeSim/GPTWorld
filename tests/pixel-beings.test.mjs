import assert from 'node:assert/strict';
import test from 'node:test';
import {createPixelHumanoid,animatePixelHumanoid,createPixelCreature} from '../lib/pixel-beings.mjs';

class Geometry {}
class Material {
  constructor(options = {}) { Object.assign(this, options); }
}
class Mesh {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.position = { x: 0, y: 0, z: 0, set(...args) { [this.x, this.y, this.z] = args; } };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.scale = { set() {} };
    this.castShadow = false;
  }
  clone() { return new Mesh(this.geometry, this.material); }
}
class Group {
  constructor() {
    this.children = [];
    this.userData = {};
    this.position = { set() {} };
  }
  add(...items) { this.children.push(...items); }
}

function threeMock() {
  return {
    Group,
    Mesh,
    BoxGeometry: class extends Geometry {},
    CircleGeometry: class extends Geometry {},
    MeshStandardMaterial: Material,
    MeshBasicMaterial: Material,
    CanvasTexture: class {
      constructor(canvas) { this.canvas = canvas; }
    },
    SRGBColorSpace: 'srgb',
    NearestFilter: 'nearest',
    FrontSide: 0
  };
}

function withDocument(run) {
  const oldDocument = globalThis.document;
  globalThis.document = {
    createElement() {
      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            imageSmoothingEnabled: true,
            fillStyle: '#000',
            fillRect() {},
            clearRect() {}
          };
        }
      };
    }
  };
  try { return run(); }
  finally {
    if (oldDocument === undefined) delete globalThis.document;
    else globalThis.document = oldDocument;
  }
}

test('pixel humanoids expose an animatable limb rig', () => withDocument(() => {
  const THREE = threeMock();
  const person = createPixelHumanoid(THREE, { outfit: 0x526f62, pack: true });
  assert.ok(person.userData.rig.armL);
  assert.ok(person.userData.rig.armR);
  assert.ok(person.userData.rig.legL);
  assert.ok(person.userData.rig.legR);
  assert.ok(person.userData.rig.torso);
  assert.ok(person.userData.rig.head);
  assert.ok(person.children.length >= 8);
  animatePixelHumanoid(person, true, 1200, 1);
  assert.notEqual(person.userData.rig.legL.rotation.x, 0);
}));

test('pixel creatures keep a four-leg gait rig', () => withDocument(() => {
  const THREE = threeMock();
  const creature = createPixelCreature(THREE, {
    color: 0xb39a67,
    predator: false,
    runner: true,
    bodyScale: 0.9,
    width: 0.8,
    height: 0.7,
    depth: 1.1
  });
  assert.equal(creature.userData.rig.legs.length, 4);
  assert.ok(creature.userData.rig.body);
  assert.ok(creature.userData.rig.head);
  assert.ok(creature.userData.rig.tail);
  assert.equal(creature.userData.rig.bodyBaseY, creature.userData.rig.body.position.y);
}));
