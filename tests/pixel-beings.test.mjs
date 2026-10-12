import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPixelHumanoid,
  animatePixelHumanoid,
  createPixelCreature,
  animatePixelCreature
} from '../lib/pixel-beings.mjs';

class Geometry {}
class Material {
  constructor(options = {}) {
    Object.assign(this, options);
    this.userData = {};
    if (this.map) {
      this.map.repeat = this.map.repeat || { set() {} };
      this.map.offset = this.map.offset || { set() {} };
    }
  }
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
class Sprite {
  constructor(material) {
    this.material = material;
    this.center = { set() {} };
    this.scale = { set() {} };
    this.position = { x: 0, y: 0, z: 0 };
  }
}
class Group {
  constructor() {
    this.children = [];
    this.userData = {};
    this.position = { set() {} };
    this.rotation = { y: 0 };
  }
  add(...items) { this.children.push(...items); }
}

function threeMock() {
  return {
    Group,
    Mesh,
    Sprite,
    BoxGeometry: class extends Geometry {},
    CircleGeometry: class extends Geometry {},
    MeshStandardMaterial: Material,
    MeshBasicMaterial: Material,
    SpriteMaterial: Material,
    CanvasTexture: class {
      constructor(canvas) {
        this.image = canvas;
        this.canvas = canvas;
        this.repeat = { set() {} };
        this.offset = { set() {} };
        this.needsUpdate = false;
        this.wrapS = null;
        this.wrapT = null;
        this.colorSpace = null;
        this.magFilter = null;
        this.minFilter = null;
        this.generateMipmaps = true;
      }
    },
    SRGBColorSpace: 'srgb',
    NearestFilter: 'nearest',
    ClampToEdgeWrapping: 'clamp',
    RepeatWrapping: 'repeat',
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

test('pixel humanoids expose sprite atlases and a gather-compatible stub rig', () => withDocument(() => {
  const THREE = threeMock();
  const person = createPixelHumanoid(THREE, { outfit: 0x526f62, pack: true });
  assert.equal(person.userData.pixel.kind, 'humanoid');
  assert.ok(person.userData.pixel.sprite);
  assert.ok(person.userData.pixel.material.map);
  assert.ok(person.userData.rig.armL);
  assert.ok(person.userData.rig.armR);
  assert.ok(person.userData.rig.legL);
  assert.ok(person.userData.rig.legR);
  assert.ok(person.userData.rig.torso);
  assert.ok(person.userData.rig.head);
  assert.ok(person.children.length >= 2);

  person.rotation.y = Math.PI / 2;
  animatePixelHumanoid(person, true, 1200, 1);
  assert.equal(person.userData.pixel.dir, 1);
  assert.ok(person.userData.pixel.frame >= 1);
  assert.notEqual(person.userData.rig.legL.rotation.x, 0);

  person.userData.rig.armR.rotation.x = -1.2;
  animatePixelHumanoid(person, false, 2000, 1);
  assert.equal(person.userData.pixel.gathering, true);
  assert.equal(person.userData.pixel.frame, 0);
}));

test('pixel creatures keep directional frames and a four-leg gait rig', () => withDocument(() => {
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
  assert.equal(creature.userData.pixel.kind, 'creature');
  assert.ok(creature.userData.pixel.sprite);
  assert.equal(creature.userData.rig.legs.length, 4);
  assert.ok(creature.userData.rig.body);
  assert.ok(creature.userData.rig.head);
  assert.ok(creature.userData.rig.tail);
  assert.equal(creature.userData.rig.bodyBaseY, creature.userData.rig.body.position.y);

  creature.rotation.y = Math.PI;
  animatePixelCreature(creature, true, 900, 'fleeing');
  assert.equal(creature.userData.pixel.dir, 2);
  assert.ok(creature.userData.pixel.frame >= 1);

  animatePixelCreature(creature, false, 900, 'feeding');
  assert.equal(creature.userData.pixel.frame, 0);
}));
