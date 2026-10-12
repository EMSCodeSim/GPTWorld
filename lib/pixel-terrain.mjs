// Shared nearest-neighbor ground, path, water, wall, and roof materials for both worlds.
import {createPixelTexture, paintBlocks} from './pixel-art-core.mjs';

function pixelTexture(THREE, paint, repeats = [1, 1]) {
  return createPixelTexture(THREE, 32, 32, paint, {repeat: repeats});
}

function paintGround(ctx) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 32, 32);
  paintBlocks(ctx, '#dce2cf', [[3,4,2,1],[12,2,2,1],[24,5,2,1],[6,16,2,1],[19,13,2,1],[28,20,2,1],[10,27,2,1],[22,29,2,1]]);
  paintBlocks(ctx, '#b8c7a1', [[7,8,2,2],[20,6,2,2],[1,22,2,2],[15,19,2,2],[26,12,2,2],[4,29,2,2],[30,27,2,2]]);
  paintBlocks(ctx, '#edf0dc', [[5,10,1,1],[22,10,1,1],[12,24,1,1],[28,3,1,1],[2,14,1,1],[18,30,1,1]]);
}

function paintPath(ctx) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = '#d9d1b9';
  for (let row = 0; row < 32; row += 8) {
    ctx.fillRect((row / 8 % 2) * 4, row, 24, 5);
    ctx.fillRect(2 + (row / 8 % 2) * 4, row + 5, 2, 1);
  }
  paintBlocks(ctx, '#b9aa8c', [[4,3,2,2],[19,10,2,2],[9,20,2,2],[25,27,2,2],[14,29,2,2],[27,4,2,2]]);
  paintBlocks(ctx, '#eee6d1', [[12,6,2,1],[26,14,2,1],[3,23,2,1],[20,24,2,1],[7,14,2,1]]);
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

function paintWater(ctx) {
  ctx.fillStyle = '#3f7384';
  ctx.fillRect(0, 0, 32, 32);
  paintBlocks(ctx, '#4d8798', [[0,2,32,2],[0,10,32,2],[0,18,32,2],[0,26,32,2]]);
  paintBlocks(ctx, '#68a4b0', [[2,3,6,1],[14,11,8,1],[22,19,7,1],[6,27,9,1],[18,4,5,1]]);
  paintBlocks(ctx, '#2f5d6c', [[8,6,4,1],[20,14,5,1],[4,22,6,1],[16,30,4,1]]);
  paintBlocks(ctx, '#9ec7c8', [[10,4,2,1],[24,12,2,1],[3,20,2,1],[17,28,2,1]]);
}

function paintShore(ctx) {
  ctx.fillStyle = '#8a7a58';
  ctx.fillRect(0, 0, 32, 32);
  paintBlocks(ctx, '#9a8864', [[0,0,32,2],[0,14,32,2],[0,26,32,2]]);
  paintBlocks(ctx, '#6f6348', [[3,4,5,2],[15,7,4,2],[24,5,4,2],[7,17,6,2],[18,19,5,2],[2,28,5,2],[21,27,5,2]]);
  paintBlocks(ctx, '#b09a72', [[9,3,2,1],[23,9,2,1],[5,16,2,1],[17,22,2,1],[27,25,2,1]]);
  paintBlocks(ctx, '#6a8050', [[11,10,2,1],[25,18,2,1],[4,24,2,1]]);
  paintBlocks(ctx, '#4f7380', [[1,30,3,1],[14,31,4,1],[26,29,3,1]]);
}

function paintWall(ctx) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 32, 32);
  for (let row = 0; row < 32; row += 8) {
    const offset = row / 8 % 2 ? 0 : 8;
    ctx.fillStyle = '#e6dcc8';
    ctx.fillRect(0, row, 32, 7);
    ctx.fillStyle = '#cbbda5';
    ctx.fillRect(0, row + 7, 32, 1);
    ctx.fillStyle = '#d8cdb8';
    for (let x = offset; x < 32; x += 16) ctx.fillRect(x, row + 1, 1, 6);
    ctx.fillStyle = '#f2ead8';
    for (let x = offset + 3; x < 32; x += 16) ctx.fillRect(x, row + 2, 4, 1);
  }
}

function paintBank(ctx) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 32, 32);
  paintBlocks(ctx, '#d5d9c4', [[1,2,3,1],[12,5,2,1],[22,3,3,1],[6,14,2,1],[18,18,3,1],[28,12,2,1],[4,24,3,1],[16,27,2,1]]);
  paintBlocks(ctx, '#b7c2a0', [[8,8,2,2],[20,10,2,2],[2,20,2,2],[14,22,2,2],[26,24,2,2]]);
  paintBlocks(ctx, '#9aa882', [[10,1,1,1],[24,16,1,1],[5,28,1,1]]);
}

export function createPixelGroundMaterial(THREE, color) {
  const texture = pixelTexture(THREE, paintGround, [18, 18]);
  return new THREE.MeshStandardMaterial({ color, map: texture, roughness: 1, flatShading: true });
}

export function createPixelTrailMaterial(THREE, color, width, length) {
  const across = Math.max(1, Math.round(Number(width) || 1));
  const along = Math.max(1, Math.ceil((Number(length) || 1) / 2));
  const texture = pixelTexture(THREE, paintPath, [across, along]);
  return new THREE.MeshStandardMaterial({ color, map: texture, roughness: 1, flatShading: true });
}

export function createPixelRoofMaterial(THREE, color) {
  const texture = pixelTexture(THREE, paintRoof, [3, 3]);
  return new THREE.MeshStandardMaterial({ color, map: texture, roughness: 1, flatShading: true });
}

export function createPixelWaterMaterial(THREE, color = 0x4d8090) {
  const texture = pixelTexture(THREE, paintWater, [4, 8]);
  return new THREE.MeshStandardMaterial({
    color,
    map: texture,
    roughness: 0.42,
    metalness: 0.04,
    transparent: true,
    opacity: 0.92,
    flatShading: true
  });
}

export function createPixelShoreMaterial(THREE, color = 0x7a6d52) {
  const texture = pixelTexture(THREE, paintShore, [2, 10]);
  return new THREE.MeshStandardMaterial({ color, map: texture, roughness: 1, flatShading: true });
}

export function createPixelWallMaterial(THREE, color) {
  const texture = pixelTexture(THREE, paintWall, [2, 2]);
  return new THREE.MeshStandardMaterial({ color, map: texture, roughness: 0.95, flatShading: true });
}

export function createPixelBankMaterial(THREE, color = 0x667552) {
  const texture = pixelTexture(THREE, paintBank, [6, 18]);
  return new THREE.MeshStandardMaterial({ color, map: texture, roughness: 1, flatShading: true });
}

export function createPixelPatchMaterial(THREE, color) {
  const texture = pixelTexture(THREE, paintGround, [3, 3]);
  return new THREE.MeshStandardMaterial({ color, map: texture, roughness: 1, flatShading: true });
}
