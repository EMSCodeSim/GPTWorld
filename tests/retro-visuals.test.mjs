import assert from 'node:assert/strict';
import test from 'node:test';
import {configureRetroRenderer,resizeRetroViewport,RETRO_RENDER_SCALE,RETRO_VIEW_HEIGHT} from '../lib/retro-visuals.mjs';

test('retro viewport uses orthographic bounds and low-res pixel canvas', () => {
  const camera = {
    left: 0, right: 0, top: 0, bottom: 0,
    updateProjectionMatrix() { this.updated = true; }
  };
  const renderer = {
    domElement: { style: {} },
    setSize(width, height, updateStyle) {
      this.width = width;
      this.height = height;
      this.updateStyle = updateStyle;
    }
  };
  resizeRetroViewport(renderer, camera, 1000, 500);
  const half = RETRO_VIEW_HEIGHT / 2;
  assert.equal(camera.top, half);
  assert.equal(camera.bottom, -half);
  assert.equal(camera.left, -half * 2);
  assert.equal(camera.right, half * 2);
  assert.equal(renderer.width, Math.round(1000 * RETRO_RENDER_SCALE));
  assert.equal(renderer.height, Math.round(500 * RETRO_RENDER_SCALE));
  assert.equal(renderer.updateStyle, false);
  assert.equal(renderer.domElement.style.imageRendering, 'pixelated');
  assert.equal(camera.updated, true);
});

test('retro renderer hardens shadows and nearest-neighbor presentation', () => {
  const THREE = { BasicShadowMap: 0, SRGBColorSpace: 'srgb' };
  const renderer = {
    shadowMap: {},
    domElement: { style: {} },
    setPixelRatio(value) { this.pixelRatio = value; }
  };
  configureRetroRenderer(THREE, renderer);
  assert.equal(renderer.pixelRatio, 1);
  assert.equal(renderer.shadowMap.enabled, true);
  assert.equal(renderer.shadowMap.type, 0);
  assert.equal(renderer.outputColorSpace, 'srgb');
  assert.equal(renderer.domElement.style.imageRendering, 'pixelated');
});
