// Shared pixel-scale viewport for the public town and private homesteads.
// Environment stays low-res + nearest-neighbor; characters render in a full-res
// overlay pass so polished meshes keep detail without restyling the world.
export const RETRO_RENDER_SCALE = 0.55;
export const RETRO_VIEW_HEIGHT = 27;
export const RETRO_SKY = 0x7fa4a8;
export const RETRO_FOG_NEAR = 34;
export const RETRO_FOG_FAR = 88;
export const ENVIRONMENT_LAYER = 0;
export const CHARACTER_LAYER = 1;

export function configureRetroRenderer(THREE, renderer) {
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  // Canvas stays full CSS resolution so character meshes are not pixelated by
  // CSS upscaling; the environment pass itself is still nearest-neighbor.
  renderer.domElement.style.imageRendering = 'auto';
  return renderer;
}

export function enableCharacterLighting(light) {
  if (!light?.layers?.enable) return light;
  light.layers.enable(ENVIRONMENT_LAYER);
  light.layers.enable(CHARACTER_LAYER);
  if (light.shadow?.camera?.layers?.enable) {
    light.shadow.camera.layers.enable(ENVIRONMENT_LAYER);
    light.shadow.camera.layers.enable(CHARACTER_LAYER);
  }
  return light;
}

export function markCharacterObject(root) {
  if (!root?.traverse) return root;
  root.traverse(obj => {
    if (obj?.layers?.set) obj.layers.set(CHARACTER_LAYER);
  });
  return root;
}

export function resizeRetroViewport(renderer, camera, width, height, hybrid = null) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const aspect = safeWidth / safeHeight;
  const halfHeight = RETRO_VIEW_HEIGHT / 2;

  camera.left = -halfHeight * aspect;
  camera.right = halfHeight * aspect;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();

  const fullW = Math.max(1, Math.round(safeWidth));
  const fullH = Math.max(1, Math.round(safeHeight));
  renderer.setSize(fullW, fullH, false);
  if (hybrid && typeof hybrid.setSize === 'function') hybrid.setSize(fullW, fullH);
}

function withColorWriteDisabled(scene, run) {
  const changed = [];
  scene.traverse(obj => {
    const material = obj?.material;
    if (!material) return;
    const list = Array.isArray(material) ? material : [material];
    for (const mat of list) {
      if (!mat || mat.colorWrite === false) continue;
      changed.push(mat);
      mat.colorWrite = false;
    }
  });
  try {
    run();
  } finally {
    for (const mat of changed) mat.colorWrite = true;
  }
}

export function createHybridPresenter(THREE, renderer) {
  const envTarget = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
    stencilBuffer: false
  });
  envTarget.texture.generateMipmaps = false;
  envTarget.texture.colorSpace = THREE.SRGBColorSpace;

  const blitCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const blitMaterial = new THREE.MeshBasicMaterial({
    map: envTarget.texture,
    depthTest: false,
    depthWrite: false,
    toneMapped: false
  });
  const blitMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blitMaterial);
  const blitScene = new THREE.Scene();
  blitScene.add(blitMesh);

  return {
    setSize(width, height) {
      const envW = Math.max(1, Math.round(width * RETRO_RENDER_SCALE));
      const envH = Math.max(1, Math.round(height * RETRO_RENDER_SCALE));
      envTarget.setSize(envW, envH);
    },
    render(scene, camera) {
      if (!scene || !camera) return;
      const prevAutoClear = renderer.autoClear;
      const prevBackground = scene.background;

      // 1) Pixel environment (no characters) into a low-res target.
      camera.layers.set(ENVIRONMENT_LAYER);
      renderer.setRenderTarget(envTarget);
      renderer.autoClear = true;
      renderer.render(scene, camera);

      // 2) Nearest-neighbor blit keeps the chunky world look on the full canvas.
      renderer.setRenderTarget(null);
      renderer.autoClear = true;
      renderer.render(blitScene, blitCamera);

      // 3) Depth-only environment at full res so characters occlude correctly.
      renderer.autoClear = false;
      renderer.clearDepth();
      scene.background = null;
      withColorWriteDisabled(scene, () => {
        camera.layers.set(ENVIRONMENT_LAYER);
        renderer.render(scene, camera);
      });
      scene.background = prevBackground;

      // 4) Full-res characters/animals with depth test against the world.
      camera.layers.set(CHARACTER_LAYER);
      renderer.render(scene, camera);

      camera.layers.enable(ENVIRONMENT_LAYER);
      camera.layers.enable(CHARACTER_LAYER);
      renderer.autoClear = prevAutoClear;
    },
    dispose() {
      envTarget.dispose();
      blitMaterial.dispose();
      blitMesh.geometry.dispose();
    }
  };
}
