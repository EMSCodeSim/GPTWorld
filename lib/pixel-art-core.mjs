// Shared nearest-neighbor canvas helpers for GPTWorld's isometric pixel look.
export function createPixelCanvas(width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  paint(ctx, width, height);
  return canvas;
}

export function createPixelTexture(THREE, width, height, paint, options = {}) {
  const canvas = createPixelCanvas(width, height, paint);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  if (options.repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(options.repeat[0], options.repeat[1]);
  }
  texture.needsUpdate = true;
  return texture;
}

export function createPixelMaterial(THREE, texture, options = {}) {
  return new THREE.MeshStandardMaterial({
    map: texture,
    color: options.color ?? 0xffffff,
    roughness: options.roughness ?? 1,
    metalness: options.metalness ?? 0,
    transparent: Boolean(options.transparent),
    opacity: options.opacity ?? 1,
    alphaTest: options.alphaTest ?? 0,
    side: options.side ?? THREE.FrontSide,
    flatShading: true,
    ...options.extra
  });
}

export function paintBlocks(ctx, color, rows) {
  ctx.fillStyle = color;
  for (const [x, y, w, h] of rows) ctx.fillRect(x, y, w, h);
}
