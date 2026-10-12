// Shared pixel-scale viewport for the public town and private homesteads.
// Environment draws to a low-res, nearest-upscaled canvas; characters draw to a
 // full-res transparent overlay with a depth prepass so occlusion stays correct.
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
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.inset = '0';
  renderer.domElement.style.zIndex = '1';
  renderer.domElement.style.imageRendering = 'auto';
  renderer.domElement.style.background = 'transparent';
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
  if (hybrid && typeof hybrid.setSize === 'function') hybrid.setSize(fullW, fullH, safeWidth, safeHeight);
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

export function createHybridPresenter(THREE, characterRenderer) {
  const envRenderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance'
  });
  envRenderer.setPixelRatio(1);
  envRenderer.shadowMap.enabled = true;
  envRenderer.shadowMap.type = THREE.BasicShadowMap;
  envRenderer.outputColorSpace = THREE.SRGBColorSpace;
  envRenderer.domElement.style.position = 'absolute';
  envRenderer.domElement.style.inset = '0';
  envRenderer.domElement.style.width = '100%';
  envRenderer.domElement.style.height = '100%';
  envRenderer.domElement.style.zIndex = '0';
  envRenderer.domElement.style.imageRendering = 'pixelated';
  envRenderer.domElement.style.pointerEvents = 'none';
  envRenderer.domElement.setAttribute('aria-hidden', 'true');

  characterRenderer.setClearColor(0x000000, 0);

  function ensureMounted() {
    const host = characterRenderer.domElement.parentElement;
    if (!host || envRenderer.domElement.parentElement === host) return;
    const computed = typeof getComputedStyle === 'function' ? getComputedStyle(host) : null;
    const position = computed?.position || host.style.position || 'static';
    // Only force positioning when the host would otherwise collapse absolute children.
    if (position === 'static') host.style.position = 'relative';
    host.insertBefore(envRenderer.domElement, characterRenderer.domElement);
  }
  ensureMounted();

  return {
    envRenderer,
    setSize(fullW, fullH, cssW = fullW, cssH = fullH) {
      ensureMounted();
      const envW = Math.max(1, Math.round(cssW * RETRO_RENDER_SCALE));
      const envH = Math.max(1, Math.round(cssH * RETRO_RENDER_SCALE));
      envRenderer.setSize(envW, envH, false);
      characterRenderer.setSize(fullW, fullH, false);
    },
    render(scene, camera) {
      if (!scene || !camera) return;
      ensureMounted();
      const prevBackground = scene.background;
      const prevAutoClear = characterRenderer.autoClear;

      // Bottom canvas: chunky pixel environment only.
      camera.layers.set(ENVIRONMENT_LAYER);
      envRenderer.autoClear = true;
      envRenderer.render(scene, camera);

      // Top canvas: transparent character overlay with world depth.
      camera.layers.set(ENVIRONMENT_LAYER);
      characterRenderer.autoClear = true;
      characterRenderer.setClearColor(0x000000, 0);
      scene.background = null;
      withColorWriteDisabled(scene, () => {
        characterRenderer.render(scene, camera);
      });

      characterRenderer.autoClear = false;
      camera.layers.set(CHARACTER_LAYER);
      characterRenderer.render(scene, camera);

      scene.background = prevBackground;
      camera.layers.enable(ENVIRONMENT_LAYER);
      camera.layers.enable(CHARACTER_LAYER);
      characterRenderer.autoClear = prevAutoClear;
    },
    dispose() {
      const parent = envRenderer.domElement.parentElement;
      if (parent && typeof parent.removeChild === 'function') {
        parent.removeChild(envRenderer.domElement);
      }
      envRenderer.dispose();
    }
  };
}
