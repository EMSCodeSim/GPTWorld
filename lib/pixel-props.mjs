// Original pixel props and ecology plant parts shared by public/private worlds.
import {createPixelTexture, paintBlocks} from './pixel-art-core.mjs';

function mat(THREE, color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true, ...extra });
}

function paintDoor(ctx) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 16, 24);
  paintBlocks(ctx, '#e4d3b4', [[1,1,14,22]]);
  paintBlocks(ctx, '#c9b18a', [[1,1,14,1],[1,8,14,1],[1,15,14,1],[1,22,14,1],[1,1,1,22],[14,1,1,22]]);
  paintBlocks(ctx, '#8a6a3d', [[3,3,4,4],[9,3,4,4],[3,10,4,4],[9,10,4,4]]);
  paintBlocks(ctx, '#d2b36a', [[12,12,2,2]]);
}

function paintWindow(ctx) {
  ctx.fillStyle = '#2a3a3d';
  ctx.fillRect(0, 0, 12, 12);
  paintBlocks(ctx, '#88a8ad', [[1,1,4,4],[7,1,4,4],[1,7,4,4],[7,7,4,4]]);
  paintBlocks(ctx, '#d7e7ea', [[2,2,1,1],[8,2,1,1]]);
  paintBlocks(ctx, '#4b3422', [[0,5,12,2],[5,0,2,12]]);
}

function paintCloud(ctx) {
  ctx.clearRect(0, 0, 32, 16);
  paintBlocks(ctx, '#d9e1df', [[4,6,20,6],[8,3,14,5],[12,2,8,3],[2,8,8,4],[22,7,7,4]]);
  paintBlocks(ctx, '#eef3f1', [[9,4,6,2],[14,3,4,2],[6,7,4,1]]);
  paintBlocks(ctx, '#b8c1c0', [[5,10,10,1],[18,11,8,1]]);
}

function paintBlade(ctx, color) {
  ctx.clearRect(0, 0, 12, 20);
  ctx.fillStyle = color;
  ctx.fillRect(5, 2, 2, 16);
  ctx.fillRect(3, 8, 2, 8);
  ctx.fillRect(7, 6, 2, 10);
  ctx.fillStyle = '#3f6a3a';
  ctx.fillRect(5, 14, 2, 4);
}

function paintFlower(ctx, color) {
  ctx.clearRect(0, 0, 12, 12);
  ctx.fillStyle = color;
  ctx.fillRect(4, 4, 4, 4);
  ctx.fillRect(2, 5, 2, 2);
  ctx.fillRect(8, 5, 2, 2);
  ctx.fillRect(5, 2, 2, 2);
  ctx.fillRect(5, 8, 2, 2);
  ctx.fillStyle = '#f5e7b6';
  ctx.fillRect(5, 5, 2, 2);
}

export function createPixelDoorMaterial(THREE, color = 0x4b3422) {
  const texture = createPixelTexture(THREE, 16, 24, paintDoor);
  return new THREE.MeshStandardMaterial({
    color,
    map: texture,
    roughness: 0.95,
    flatShading: true
  });
}

export function createPixelWindow(THREE, width = 0.76, height = 0.86) {
  const texture = createPixelTexture(THREE, 12, 12, paintWindow);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({
      map: texture,
      color: 0xffffff,
      roughness: 1,
      transparent: true,
      alphaTest: 0.05,
      flatShading: true
    })
  );
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

export function createPixelCloud(THREE, index = 0) {
  const group = new THREE.Group();
  const texture = createPixelTexture(THREE, 32, 16, paintCloud);
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: 0xffffff,
    roughness: 1,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    side: THREE.DoubleSide,
    flatShading: true
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 3.6), material);
  plane.position.y = 0.2;
  group.add(plane);
  const planeB = plane.clone();
  planeB.rotation.y = Math.PI / 2;
  group.add(planeB);
  group.position.set(-28 + index * 18, 18 + (index % 2) * 2, -20 + (index % 3) * 18);
  return group;
}

export function createPixelBarrel(THREE, scale = 1) {
  const group = new THREE.Group();
  const wood = mat(THREE, 0x714a2d);
  const band = mat(THREE, 0x3a2a21);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62 * scale, 0.78 * scale, 0.62 * scale), wood);
  body.position.y = 0.4 * scale;
  body.castShadow = true;
  group.add(body);
  for (const y of [0.18, 0.4, 0.62]) {
    const ring = new THREE.Mesh(new THREE.BoxGeometry(0.68 * scale, 0.06 * scale, 0.68 * scale), band);
    ring.position.y = y * scale;
    group.add(ring);
  }
  return group;
}

export function createPixelLivingPlantPart(THREE, entity = {}) {
  const group = new THREE.Group();
  const part = String(entity.part || '');
  const width = Math.max(0.08, Number(entity.width || 0.4));
  const height = Math.max(0.08, Number(entity.height || 0.4));
  const depth = Math.max(0.08, Number(entity.depth || 0.4));
  const color = typeof entity.color === 'number' ? entity.color : 0x6f9b55;
  const hex = `#${color.toString(16).padStart(6, '0')}`;

  if (part === 'blade' || part === 'plant-patch') {
    const texture = createPixelTexture(THREE, 12, 20, ctx => paintBlade(ctx, hex));
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      color: 0xffffff,
      roughness: 1,
      transparent: true,
      alphaTest: 0.08,
      side: THREE.DoubleSide,
      flatShading: true
    });
    const w = Math.max(0.35, width);
    const h = Math.max(0.45, height);
    for (const rot of [0, Math.PI / 2]) {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
      plane.position.y = h / 2;
      plane.rotation.y = rot;
      plane.castShadow = true;
      group.add(plane);
    }
  } else if (part === 'flower') {
    const texture = createPixelTexture(THREE, 12, 12, ctx => paintFlower(ctx, hex));
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      color: 0xffffff,
      roughness: 1,
      transparent: true,
      alphaTest: 0.08,
      side: THREE.DoubleSide,
      flatShading: true
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(0.3, width), Math.max(0.3, height)), material);
    plane.position.y = Math.max(0.18, height * 0.8);
    group.add(plane);
  } else if (part === 'stem') {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(0.06, width * 0.35), height, Math.max(0.06, depth * 0.35)),
      mat(THREE, color || 0x684b32)
    );
    mesh.position.y = height / 2;
    mesh.castShadow = true;
    group.add(mesh);
  } else if (part === 'crown') {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat(THREE, color || 0x4f793e));
    mesh.position.y = Math.max(0.38, height * 0.72);
    mesh.scale.set(width, height, depth);
    mesh.castShadow = true;
    group.add(mesh);
  } else {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat(THREE, color || 0x5f7f48));
    mesh.position.y = height / 2;
    mesh.castShadow = true;
    group.add(mesh);
  }
  return group;
}
