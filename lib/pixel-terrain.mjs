// Shared nearest-neighbor ground, path, and roof materials for the public and private worlds.
function pixelTexture(THREE, paint, repeats = [1, 1]) {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  paint(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeats[0], repeats[1]);
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function paintGround(ctx) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = '#dce2cf';
  for (const [x, y] of [[3,4],[12,2],[24,5],[6,16],[19,13],[28,20],[10,27],[22,29]]) ctx.fillRect(x, y, 2, 1);
  ctx.fillStyle = '#b8c7a1';
  for (const [x, y] of [[7,8],[20,6],[1,22],[15,19],[26,12],[4,29],[30,27]]) ctx.fillRect(x, y, 2, 2);
  ctx.fillStyle = '#edf0dc';
  for (const [x, y] of [[5,10],[22,10],[12,24],[28,3],[2,14],[18,30]]) ctx.fillRect(x, y, 1, 1);
}

function paintPath(ctx) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = '#d9d1b9';
  for (let row = 0; row < 32; row += 8) {
    ctx.fillRect((row / 8 % 2) * 4, row, 24, 5);
    ctx.fillRect(2 + (row / 8 % 2) * 4, row + 5, 2, 1);
  }
  ctx.fillStyle = '#b9aa8c';
  for (const [x, y] of [[4,3],[19,10],[9,20],[25,27],[14,29],[27,4]]) ctx.fillRect(x, y, 2, 2);
  ctx.fillStyle = '#eee6d1';
  for (const [x, y] of [[12,6],[26,14],[3,23],[20,24],[7,14]]) ctx.fillRect(x, y, 2, 1);
}

function paintRoof(ctx) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 32, 32);
  for (let row = 0; row < 32; row += 8) {
    const offset = row / 8 % 2 ? 0 : 8;
    ctx.fillStyle = '#d6d0c2';
    ctx.fillRect(0, row, 32, 1);
    ctx.fillStyle = '#e8e2d2';
    for (let x = offset; x < 32; x += 16) ctx.fillRect(x + 1, row + 1, 14, 5);
    ctx.fillStyle = '#c7c0b1';
    for (let x = offset - 8; x < 32; x += 16) {
      if (x >= 0) ctx.fillRect(x, row + 1, 1, 6);
      if (x + 16 < 32) ctx.fillRect(x + 16, row + 1, 1, 6);
    }
    ctx.fillStyle = '#f2eddf';
    for (let x = offset + 3; x < 32; x += 16) ctx.fillRect(x, row + 2, 3, 1);
  }
}

export function createPixelGroundMaterial(THREE, color) {
  const texture = pixelTexture(THREE, paintGround, [18, 18]);
  return new THREE.MeshStandardMaterial({ color, map: texture, roughness: 1 });
}

export function createPixelTrailMaterial(THREE, color, width, length) {
  const across = Math.max(1, Math.round(Number(width) || 1));
  const along = Math.max(1, Math.ceil((Number(length) || 1) / 2));
  const texture = pixelTexture(THREE, paintPath, [across, along]);
  return new THREE.MeshStandardMaterial({ color, map: texture, roughness: 1 });
}

export function createPixelRoofMaterial(THREE, color) {
  const texture = pixelTexture(THREE, paintRoof, [3, 3]);
  return new THREE.MeshStandardMaterial({ color, map: texture, roughness: 1 });
}
