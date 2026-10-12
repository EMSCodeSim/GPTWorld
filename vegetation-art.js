// Pixel-scale vegetation art for GPTWorld. Visuals only; resource state stays in the world systems.
// Pass the existing THREE import to avoid loading another Three.js instance.

function pixelTexture(THREE, width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  paint(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function pixelMaterial(THREE, texture) {
  return new THREE.MeshStandardMaterial({
    map: texture,
    color: 0xffffff,
    roughness: 1,
    transparent: true,
    alphaTest: 0.08,
    side: THREE.DoubleSide,
    flatShading: true
  });
}

function addSpritePlane(THREE, parent, material, width, height, y, rotation = 0) {
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  plane.position.y = y;
  plane.rotation.y = rotation;
  plane.castShadow = true;
  plane.receiveShadow = true;
  parent.add(plane);
  return plane;
}

function paintPine(ctx) {
  const blocks = (color, rows) => {
    ctx.fillStyle = color;
    for (const [x,y,w,h] of rows) ctx.fillRect(x,y,w,h);
  };
  // Broad stepped boughs and a broken pixel edge give the canopy a hand-placed silhouette.
  blocks('#183c2c', [[15,1,3,4],[12,5,9,4],[9,9,15,4],[6,13,21,4],[3,17,27,4],[1,21,31,4],[4,25,25,4],[7,29,19,4],[10,33,13,4]]);
  blocks('#285b38', [[15,3,3,3],[12,7,7,3],[9,11,12,3],[6,15,16,3],[4,19,18,3],[3,23,18,3],[6,27,15,3],[10,31,10,3]]);
  blocks('#3f7844', [[14,6,3,2],[10,10,4,2],[7,14,5,2],[5,18,5,2],[4,22,5,2],[7,26,5,2],[11,30,4,2]]);
  blocks('#6d9b50', [[14,5,2,1],[9,9,3,1],[6,13,4,1],[4,17,4,1],[3,21,4,1],[6,25,4,1]]);
  blocks('#24432f', [[22,12,3,3],[24,18,4,3],[21,25,4,3],[17,31,4,2]]);
}

export function createPineArt(THREE, scale = 1) {
  const group = new THREE.Group();
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x705034, roughness: 1, flatShading: true });
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(.20 * scale, .36 * scale, 2.3 * scale, 5),
    trunkMaterial
  );
  trunk.position.y = 1.15 * scale;
  trunk.castShadow = true;
  group.add(trunk);

  const texture = pixelTexture(THREE, 32, 36, paintPine);
  const material = pixelMaterial(THREE, texture);
  const crown = new THREE.Group();
  // Two crossed, camera-facing planes retain a readable tree silhouette from every walking direction.
  addSpritePlane(THREE, crown, material, 4.6 * scale, 4.5 * scale, 3.05 * scale);
  addSpritePlane(THREE, crown, material, 4.6 * scale, 4.5 * scale, 3.05 * scale, Math.PI / 2);
  group.add(crown);
  return { group, trunk, crown };
}

function paintHerbs(ctx, variant) {
  const leaves = variant % 2
    ? ['#759b48','#a6b764','#527a3f']
    : ['#668f49','#b1bc68','#527440'];
  ctx.fillStyle = '#415d37';
  ctx.fillRect(9,20,14,2);
  const tufts = [[5,17,1],[10,14,0],[15,17,2],[20,13,1],[26,17,0],[12,10,2],[22,9,1]];
  tufts.forEach(([x,y,palette], index) => {
    const leaf = leaves[palette];
    ctx.fillStyle = '#426b3e';
    ctx.fillRect(x+3,y+4,1,5);
    ctx.fillStyle = leaf;
    ctx.fillRect(x,y+2,3,2);
    ctx.fillRect(x+2,y,3,3);
    ctx.fillRect(x+4,y+2,3,2);
    if (index % 2 === 0) ctx.fillRect(x+3,y+5,3,1);
  });
  ctx.fillStyle = variant % 2 ? '#e7d78b' : '#c49bd1';
  for (const [x,y] of [[11,8],[20,7],[15,15]]) {
    ctx.fillRect(x,y,2,2);
    ctx.fillStyle = '#f5e7b6';
    ctx.fillRect(x,y,1,1);
    ctx.fillStyle = variant % 2 ? '#e7d78b' : '#c49bd1';
  }
}

export function createHerbArt(THREE, scale = 1, variant = 0) {
  const group = new THREE.Group();
  const texture = pixelTexture(THREE, 32, 24, ctx => paintHerbs(ctx, variant));
  const material = pixelMaterial(THREE, texture);
  addSpritePlane(THREE, group, material, .95 * scale, .78 * scale, .4 * scale);
  addSpritePlane(THREE, group, material, .95 * scale, .78 * scale, .4 * scale, Math.PI / 2);
  return group;
}

function paintRock(ctx, variant = 0) {
  const base = variant % 2 ? '#6f7268' : '#7a7d73';
  const mid = variant % 2 ? '#8a8d83' : '#94978d';
  const dark = variant % 2 ? '#555850' : '#5c5f57';
  const lite = '#b0b3a8';
  ctx.clearRect(0, 0, 32, 28);
  ctx.fillStyle = base;
  ctx.fillRect(6, 10, 20, 14);
  ctx.fillRect(10, 6, 14, 6);
  ctx.fillRect(4, 16, 6, 8);
  ctx.fillRect(22, 14, 6, 8);
  ctx.fillStyle = mid;
  ctx.fillRect(8, 8, 8, 5);
  ctx.fillRect(16, 12, 7, 4);
  ctx.fillStyle = dark;
  ctx.fillRect(6, 20, 18, 2);
  ctx.fillRect(22, 18, 4, 4);
  ctx.fillRect(10, 14, 3, 2);
  ctx.fillStyle = lite;
  ctx.fillRect(11, 7, 3, 1);
  ctx.fillRect(17, 11, 2, 1);
}

export function createRockArt(THREE, scale = 1, variant = 0) {
  const group = new THREE.Group();
  const texture = pixelTexture(THREE, 32, 28, ctx => paintRock(ctx, variant));
  const material = pixelMaterial(THREE, texture);
  const width = 1.7 * scale;
  const height = 1.35 * scale;
  addSpritePlane(THREE, group, material, width, height, height * 0.48);
  addSpritePlane(THREE, group, material, width, height, height * 0.48, Math.PI / 2);
  // Keep a low solid collider body for shadow contact without changing gather radius.
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(0.9 * scale, 0.35 * scale, 0.9 * scale),
    new THREE.MeshStandardMaterial({ color: 0x6f7268, roughness: 1, flatShading: true })
  );
  base.position.y = 0.18 * scale;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);
  return group;
}
