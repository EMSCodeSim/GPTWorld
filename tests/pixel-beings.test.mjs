import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPixelHumanoid,
  animatePixelHumanoid,
  createPixelCreature,
  animatePixelCreature
} from '../lib/pixel-beings.mjs';
import {CHARACTER_LAYER} from '../lib/retro-visuals.mjs';

class Geometry {
  clone() { return new Geometry(); }
}
class Material {
  constructor(options = {}) {
    Object.assign(this, options);
    this.userData = {};
  }
  clone() { return new Material(this); }
}
class Mesh {
  constructor(geometry, material) {
    this.isMesh = true;
    this.geometry = geometry;
    this.material = material;
    this.children = [];
    this.layers = { mask: 1, set(v) { this.mask = 1 << v; this.value = v; } };
    this.position = { x: 0, y: 0, z: 0, set(...args) { [this.x, this.y, this.z] = args; } };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.scale = { x: 1, y: 1, z: 1, set(...args) { [this.x, this.y, this.z] = args; } };
    this.castShadow = false;
  }
  add(...items) { this.children.push(...items); }
  clone() { return new Mesh(this.geometry, this.material); }
  traverse(fn) {
    fn(this);
    for (const child of this.children) {
      if (typeof child.traverse === 'function') child.traverse(fn);
      else fn(child);
    }
  }
}
class Group {
  constructor() {
    this.children = [];
    this.userData = {};
    this.position = { x: 0, y: 0, z: 0, set(...args) { [this.x, this.y, this.z] = args; } };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.scale = { x: 1, y: 1, z: 1, set(...args) { [this.x, this.y, this.z] = args; } };
    this.layers = { mask: 1, set(v) { this.mask = 1 << v; this.value = v; } };
  }
  add(...items) { this.children.push(...items); }
  traverse(fn) {
    fn(this);
    for (const child of this.children) {
      if (typeof child.traverse === 'function') child.traverse(fn);
      else fn(child);
    }
  }
}

function threeMock() {
  return {
    Group,
    Mesh,
    BoxGeometry: class extends Geometry {},
    CircleGeometry: class extends Geometry {},
    SphereGeometry: class extends Geometry {},
    CapsuleGeometry: class extends Geometry {},
    ConeGeometry: class extends Geometry {},
    TorusGeometry: class extends Geometry {},
    MeshStandardMaterial: Material,
    MeshBasicMaterial: Material,
    CanvasTexture: class {
      constructor(canvas) {
        this.image = canvas;
        this.needsUpdate = false;
        this.colorSpace = null;
      }
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
            strokeStyle: '#000',
            lineWidth: 1,
            lineCap: 'round',
            beginPath() {},
            moveTo() {},
            quadraticCurveTo() {},
            ellipse() {},
            stroke() {},
            fill() {},
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

test('feature humanoids expose mesh limbs, faces, and character layer', () => withDocument(() => {
  const THREE = threeMock();
  const person = createPixelHumanoid(THREE, { outfit: 0x526f62, pack: true });
  assert.equal(person.userData.pixel.kind, 'humanoid');
  assert.equal(person.userData.pixel.feature, true);
  assert.equal(person.userData.pixel.stylized, true);
  assert.equal(person.userData.pixel.cartoon, true);
  assert.ok(person.userData.pixel.mouth);
  assert.ok(person.userData.rig.mouth);
  assert.ok(person.userData.rig.armL.isMesh);
  assert.ok(person.userData.rig.armR.isMesh);
  assert.ok(person.userData.rig.legL.isMesh);
  assert.ok(person.userData.rig.legR.isMesh);
  assert.ok(person.userData.rig.head.isMesh);
  assert.ok(person.userData.rig.legLPivot.children.length > 1);
  assert.ok(person.userData.rig.kneeL);
  assert.ok(person.userData.rig.elbowR);
  assert.ok(person.userData.pixel.eyeL);
  assert.ok(person.userData.attachments.head);
  assert.ok(person.userData.attachments.chest);
  assert.ok(person.userData.attachments.back);
  assert.ok(person.userData.attachments.mainHand);
  assert.ok(person.userData.attachments.offHand);
  assert.equal(person.layers.value, CHARACTER_LAYER);
  assert.equal(person.userData.rig.armL.layers.value, CHARACTER_LAYER);

  animatePixelHumanoid(person, true, 1200, 1);
  assert.notEqual(person.userData.rig.legLPivot.rotation.x, 0);
  assert.notEqual(person.userData.rig.kneeR.rotation.x, 0);

  animatePixelHumanoid(person, false, 1500, 1, { attack: 1 });
  assert.ok(person.userData.rig.armRPivot.rotation.x < -0.5);

  person.userData.rig.armR.rotation.x = -1.2;
  animatePixelHumanoid(person, false, 2000, 1);
  assert.equal(person.userData.rig.armR.rotation.x, -1.2);
}));

test('feature creatures keep gait rigs, ears, and character layer', () => withDocument(() => {
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
  assert.equal(creature.userData.pixel.feature, true);
  assert.equal(creature.userData.rig.legs.length, 4);
  assert.ok(creature.userData.rig.body.isMesh);
  assert.ok(creature.userData.rig.head.isMesh);
  assert.ok(creature.userData.rig.tail.isMesh);
  assert.equal(creature.userData.rig.legPivots.length, 4);
  assert.equal(creature.userData.rig.lowerLegs.length, 4);
  assert.ok(creature.userData.pixel.earL);
  assert.equal(creature.layers.value, CHARACTER_LAYER);

  animatePixelCreature(creature, true, 900, 'fleeing');
  assert.notEqual(creature.userData.rig.legs[0].rotation.x, 0);

  animatePixelCreature(creature, false, 900, 'feeding');
  assert.ok(creature.userData.rig.head.rotation.x > 0.2);
}));
