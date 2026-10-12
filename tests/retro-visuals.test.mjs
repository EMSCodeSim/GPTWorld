import assert from 'node:assert/strict';
import test from 'node:test';
import {
  configureRetroRenderer,
  resizeRetroViewport,
  createHybridPresenter,
  enableCharacterLighting,
  markCharacterObject,
  RETRO_RENDER_SCALE,
  RETRO_VIEW_HEIGHT,
  CHARACTER_LAYER,
  ENVIRONMENT_LAYER
} from '../lib/retro-visuals.mjs';

test('retro viewport keeps orthographic bounds and full-resolution canvas', () => {
  const camera = {
    left: 0, right: 0, top: 0, bottom: 0,
    updateProjectionMatrix() { this.updated = true; }
  };
  const hybrid = { size: null, setSize(w, h) { this.size = [w, h]; } };
  const renderer = {
    domElement: { style: {} },
    setSize(width, height, updateStyle) {
      this.width = width;
      this.height = height;
      this.updateStyle = updateStyle;
    }
  };
  resizeRetroViewport(renderer, camera, 1000, 500, hybrid);
  const half = RETRO_VIEW_HEIGHT / 2;
  assert.equal(camera.top, half);
  assert.equal(camera.bottom, -half);
  assert.equal(camera.left, -half * 2);
  assert.equal(camera.right, half * 2);
  assert.equal(renderer.width, 1000);
  assert.equal(renderer.height, 500);
  assert.equal(renderer.updateStyle, false);
  assert.deepEqual(hybrid.size, [1000, 500]);
  assert.equal(camera.updated, true);
});

test('retro renderer enables transparent character overlay presentation', () => {
  const THREE = { BasicShadowMap: 0, SRGBColorSpace: 'srgb' };
  const renderer = {
    shadowMap: {},
    domElement: { style: {} },
    setPixelRatio(value) { this.pixelRatio = value; },
    setClearColor(color, alpha) { this.clearColor = [color, alpha]; }
  };
  configureRetroRenderer(THREE, renderer);
  assert.equal(renderer.pixelRatio, 1);
  assert.equal(renderer.shadowMap.enabled, true);
  assert.equal(renderer.shadowMap.type, 0);
  assert.equal(renderer.outputColorSpace, 'srgb');
  assert.equal(renderer.domElement.style.imageRendering, 'auto');
  assert.equal(renderer.domElement.style.zIndex, '1');
  assert.deepEqual(renderer.clearColor, [0x000000, 0]);
});

test('hybrid presenter mounts a pixel environment canvas under characters', () => {
  const created = [];
  class FakeEnvRenderer {
    constructor() {
      this.shadowMap = {};
      this.domElement = { style: {}, setAttribute() {}, parentElement: null };
      this.sizes = [];
      created.push(this);
    }
    setPixelRatio() {}
    setSize(w, h, updateStyle) { this.sizes.push([w, h, updateStyle]); }
    dispose() { this.disposed = true; }
  }
  const host = {
    children: [],
    style: { position: 'relative' },
    insertBefore(node, ref) {
      this.children.unshift(node);
      node.parentElement = this;
      this.ref = ref;
    },
    removeChild(node) {
      this.children = this.children.filter(child => child !== node);
      node.parentElement = null;
    }
  };
  const characterRenderer = {
    domElement: { parentElement: host, style: {} },
    setClearColor(color, alpha) { this.clear = [color, alpha]; },
    setSize() {}
  };
  const THREE = {
    WebGLRenderer: FakeEnvRenderer,
    BasicShadowMap: 0,
    SRGBColorSpace: 'srgb'
  };
  const hybrid = createHybridPresenter(THREE, characterRenderer);
  assert.equal(created.length, 1);
  assert.equal(host.children[0], created[0].domElement);
  assert.equal(created[0].domElement.style.imageRendering, 'pixelated');
  assert.equal(created[0].domElement.style.zIndex, '0');
  assert.deepEqual(characterRenderer.clear, [0x000000, 0]);
  hybrid.setSize(1000, 500, 1000, 500);
  assert.deepEqual(created[0].sizes.at(-1), [Math.round(1000 * RETRO_RENDER_SCALE), Math.round(500 * RETRO_RENDER_SCALE), false]);
  assert.equal(typeof hybrid.render, 'function');
  hybrid.dispose();
  assert.equal(created[0].disposed, true);
});

test('character lighting and layer helpers cover both world layers', () => {
  const light = {
    layers: { enabled: new Set([0]), enable(v) { this.enabled.add(v); } },
    shadow: { camera: { layers: { enabled: new Set([0]), enable(v) { this.enabled.add(v); } } } }
  };
  enableCharacterLighting(light);
  assert.ok(light.layers.enabled.has(ENVIRONMENT_LAYER));
  assert.ok(light.layers.enabled.has(CHARACTER_LAYER));
  assert.ok(light.shadow.camera.layers.enabled.has(CHARACTER_LAYER));

  const root = {
    layers: { value: 0, set(v) { this.value = v; } },
    children: [{ layers: { value: 0, set(v) { this.value = v; } }, traverse(fn) { fn(this); } }],
    traverse(fn) {
      fn(this);
      for (const child of this.children) child.traverse(fn);
    }
  };
  markCharacterObject(root);
  assert.equal(root.layers.value, CHARACTER_LAYER);
  assert.equal(root.children[0].layers.value, CHARACTER_LAYER);
});
