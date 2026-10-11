// Shared pixel-scale viewport for the public town and private homesteads.
// Rendering below CSS resolution produces chunky, nearest-neighbor pixels while
// keeping the existing 3D gameplay and hit testing intact.
export const RETRO_RENDER_SCALE = 0.58;
export const RETRO_VIEW_HEIGHT = 27;

export function resizeRetroViewport(renderer, camera, width, height) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const aspect = safeWidth / safeHeight;
  const halfHeight = RETRO_VIEW_HEIGHT / 2;

  camera.left = -halfHeight * aspect;
  camera.right = halfHeight * aspect;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();

  renderer.domElement.style.imageRendering = 'pixelated';
  renderer.setSize(
    Math.max(1, Math.round(safeWidth * RETRO_RENDER_SCALE)),
    Math.max(1, Math.round(safeHeight * RETRO_RENDER_SCALE)),
    false
  );
}
