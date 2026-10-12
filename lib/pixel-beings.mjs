// Original isometric pixel sprites for travelers and wildlife.
// Painted frames use a shared palette and top-left light; gameplay keeps using
// group.position / group.rotation.y plus a stub limb rig for gather poses.
import {createPixelTexture} from './pixel-art-core.mjs';

const HUMAN_FRAME_W = 24;
const HUMAN_FRAME_H = 32;
const HUMAN_DIRS = 4; // 0=+Z/SE-ish, 1=+X, 2=-Z, 3=-X in world yaw quarters
const HUMAN_FRAMES = 3; // idle, walkA, walkB
const CREATURE_FRAME_W = 32;
const CREATURE_FRAME_H = 24;
const CREATURE_FRAMES = 3;

function hexColor(value, fallback = '#dfb083') {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `#${value.toString(16).padStart(6, '0')}`;
  }
  if (typeof value === 'string' && value.trim()) return value;
  return fallback;
}

function facingIndex(rotationY) {
  const twoPi = Math.PI * 2;
  const a = ((Number(rotationY) || 0) % twoPi + twoPi) % twoPi;
  return Math.round(a / (Math.PI / 2)) % HUMAN_DIRS;
}

function stubBone(y = 0) {
  return {
    rotation: { x: 0, y: 0, z: 0 },
    position: {
      x: 0,
      y,
      z: 0,
      set(x, ny, z) {
        this.x = x;
        this.y = ny;
        this.z = z;
      }
    }
  };
}

function setAtlasFrame(material, col, row, frameW, frameH, cols, rows) {
  const map = material.map;
  if (!map) return;
  map.repeat.set(1 / cols, 1 / rows);
  map.offset.set(col / cols, 1 - (row + 1) / rows);
  map.needsUpdate = true;
}

function paintHumanFrame(ctx, ox, oy, dir, frame, colors) {
  const { skin, outfit, hair, accent, leather, pack } = colors;
  const flip = dir === 1 || dir === 2;
  const px = (x, y, w, h, color) => {
    const drawX = flip ? ox + HUMAN_FRAME_W - x - w : ox + x;
    ctx.fillStyle = color;
    ctx.fillRect(drawX, oy + y, w, h);
  };

  // Soft ground contact shadow baked into the sprite for readability.
  px(6, 29, 12, 2, '#1a241c');

  const walk = frame > 0;
  const stride = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  const legLY = walk ? 20 + (stride > 0 ? 1 : 0) : 20;
  const legRY = walk ? 20 + (stride < 0 ? 1 : 0) : 20;
  const armLY = walk ? 12 - stride : 12;
  const armRY = walk ? 12 + stride : 12;

  // Legs / boots
  px(8, legLY, 3, 8, accent);
  px(13, legRY, 3, 8, accent);
  px(7, legLY + 7, 4, 2, '#332a22');
  px(13, legRY + 7, 4, 2, '#332a22');

  // Torso + belt
  px(7, 11, 10, 10, outfit);
  px(7, 18, 10, 2, '#49392b');
  px(11, 18, 2, 2, '#b79a62');
  if (pack && (dir === 0 || dir === 3)) px(9, 12, 6, 7, leather);
  if (pack && (dir === 1 || dir === 2)) px(9, 12, 6, 7, leather);

  // Arms / hands
  px(4, armLY, 3, 8, outfit);
  px(17, armRY, 3, 8, outfit);
  px(4, armLY + 7, 3, 2, skin);
  px(17, armRY + 7, 3, 2, skin);

  // Head + hair + face (light from upper-left)
  px(8, 4, 8, 8, skin);
  px(8, 3, 8, 3, hair);
  px(7, 5, 2, 4, hair);
  px(15, 5, 2, 4, hair);
  const faceDir = dir === 0 || dir === 1;
  if (faceDir) {
    px(10, 7, 1, 1, '#1d1a17');
    px(13, 7, 1, 1, '#1d1a17');
    px(11, 9, 2, 1, '#3a2a20');
    px(9, 6, 1, 1, '#c9966e');
  } else {
    px(11, 7, 2, 2, '#1d1a17');
  }

  // Gather / work pose: raised right arm
  if (frame === 0 && colors.gather) {
    px(17, 6, 3, 8, outfit);
    px(17, 5, 3, 2, skin);
  }
}

function paintHumanAtlas(ctx, colors) {
  for (let dir = 0; dir < HUMAN_DIRS; dir++) {
    for (let frame = 0; frame < HUMAN_FRAMES; frame++) {
      paintHumanFrame(
        ctx,
        frame * HUMAN_FRAME_W,
        dir * HUMAN_FRAME_H,
        dir,
        frame,
        colors
      );
    }
  }
}

function humanMaterial(THREE, options) {
  const colors = {
    skin: hexColor(options.skin, '#dfb083'),
    outfit: hexColor(options.outfit, '#8b7650'),
    hair: hexColor(options.hair, '#3b2a20'),
    accent: hexColor(options.accent, '#3d3329'),
    leather: '#5c4934',
    pack: Boolean(options.pack),
    gather: false
  };
  const width = HUMAN_FRAME_W * HUMAN_FRAMES;
  const height = HUMAN_FRAME_H * HUMAN_DIRS;
  const texture = createPixelTexture(THREE, width, height, ctx => paintHumanAtlas(ctx, colors));
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.08,
    depthWrite: false
  });
  material.userData.palette = colors;
  setAtlasFrame(material, 0, 0, HUMAN_FRAME_W, HUMAN_FRAME_H, HUMAN_FRAMES, HUMAN_DIRS);
  return material;
}

export function createPixelHumanoid(THREE, {
  outfit = 0x8b7650,
  skin = 0xdfb083,
  hair = 0x3b2a20,
  accent = 0x3d3329,
  pack = false
} = {}) {
  const group = new THREE.Group();
  const material = humanMaterial(THREE, { outfit, skin, hair, accent, pack });
  const sprite = new THREE.Sprite(material);
  sprite.center.set(0.5, 0);
  sprite.scale.set(1.55, 2.15, 1);
  sprite.position.y = 0.02;
  group.add(sprite);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 10),
    new THREE.MeshBasicMaterial({ color: 0x152018, transparent: true, opacity: 0.22, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  group.add(shadow);

  const armL = stubBone(1.25);
  const armR = stubBone(1.25);
  const legL = stubBone(0.47);
  const legR = stubBone(0.47);
  const torso = stubBone(1.28);
  const head = stubBone(1.96);
  const hairMesh = stubBone(2.22);

  group.userData.pixel = {
    kind: 'humanoid',
    sprite,
    material,
    frame: 0,
    dir: 0,
    pack: Boolean(pack)
  };
  group.userData.rig = { armL, armR, legL, legR, torso, head, hairMesh };
  return group;
}

export function animatePixelHumanoid(group, moving, t, speed = 1) {
  const pixel = group?.userData?.pixel;
  const rig = group?.userData?.rig;
  if (!pixel?.material) return;

  // Work/gather arm poses only apply while standing; movement clears them so
  // walk frames and stub gait stay in sync.
  const gatherPose = !moving && Math.abs(rig?.armR?.rotation?.x || 0) > 0.5;
  const dir = facingIndex(group.rotation.y);
  let frame = 0;
  if (gatherPose) frame = 0;
  else if (moving) frame = 1 + (Math.floor(t * 0.012 * speed) % 2);

  // Redraw atlas only when gather pose starts/stops so the raised arm shows.
  if (gatherPose !== Boolean(pixel.gathering)) {
    pixel.gathering = gatherPose;
    const palette = { ...pixel.material.userData.palette, gather: gatherPose };
    const canvas = pixel.material.map?.image;
    if (canvas?.getContext) {
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      paintHumanAtlas(ctx, palette);
      pixel.material.map.needsUpdate = true;
    }
  }

  if (pixel.dir !== dir || pixel.frame !== frame) {
    pixel.dir = dir;
    pixel.frame = frame;
    setAtlasFrame(pixel.material, frame, dir, HUMAN_FRAME_W, HUMAN_FRAME_H, HUMAN_FRAMES, HUMAN_DIRS);
  }

  // Keep stub limbs in sync for gather/NPC pose readers; bob the sprite for gait.
  if (rig && !gatherPose) {
    const a = moving ? Math.sin(t * 0.012 * speed) * 0.52 : 0;
    rig.legL.rotation.x = a;
    rig.legR.rotation.x = -a;
    rig.armL.rotation.x = -a * 0.72;
    rig.armR.rotation.x = a * 0.72;
  }
  pixel.sprite.position.y = 0.02 + (moving ? Math.abs(Math.sin(t * 0.012 * speed)) * 0.04 : 0);
}

function paintCreatureFrame(ctx, ox, oy, dir, frame, colors) {
  const { fur, dark, light, predator, runner } = colors;
  const flip = dir === 1 || dir === 2;
  const px = (x, y, w, h, color) => {
    const drawX = flip ? ox + CREATURE_FRAME_W - x - w : ox + x;
    ctx.fillStyle = color;
    ctx.fillRect(drawX, oy + y, w, h);
  };

  px(8, 21, 16, 2, '#1a241c');

  const walk = frame > 0;
  const lift = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  const bodyY = predator ? 8 : runner ? 9 : 8;
  const bodyH = predator ? 9 : 8;

  px(8, bodyY, 16, bodyH, fur);
  px(9, bodyY + 1, 4, 2, light);

  // Legs
  px(10, 16 - (lift > 0 ? 1 : 0), 3, 6, dark);
  px(14, 16 + (lift > 0 ? 1 : 0), 3, 6, dark);
  px(18, 16 - (lift < 0 ? 1 : 0), 3, 6, dark);
  px(22, 16 + (lift < 0 ? 1 : 0), 3, 6, dark);

  // Head toward +X in local paint (mirrored for opposite dirs)
  const headX = 22;
  px(headX, bodyY - 1, 7, 7, dark);
  px(headX + 5, bodyY + 2, 3, 3, light);
  px(headX + 2, bodyY + 1, 1, 1, '#171512');
  px(headX + 4, bodyY + 1, 1, 1, '#171512');

  if (predator) {
    px(headX + 1, bodyY - 3, 2, 3, '#2f251f');
    px(headX + 4, bodyY - 3, 2, 3, '#2f251f');
    px(6, bodyY + 3, 4, 3, dark); // tail
  } else if (runner) {
    px(headX + 1, bodyY - 4, 2, 4, dark);
    px(headX + 4, bodyY - 4, 2, 4, dark);
    px(5, bodyY + 2, 4, 2, dark);
  } else {
    px(headX + 1, bodyY - 3, 2, 3, '#d0c39b');
    px(headX + 4, bodyY - 3, 2, 3, '#d0c39b');
    px(5, bodyY + 2, 4, 2, dark);
  }

  if (walk) px(10, bodyY - 1, 12, 1, light);
}

function paintCreatureAtlas(ctx, colors) {
  for (let dir = 0; dir < HUMAN_DIRS; dir++) {
    for (let frame = 0; frame < CREATURE_FRAMES; frame++) {
      paintCreatureFrame(
        ctx,
        frame * CREATURE_FRAME_W,
        dir * CREATURE_FRAME_H,
        dir,
        frame,
        colors
      );
    }
  }
}

export function createPixelCreature(THREE, {
  color = 0x96784e,
  predator = false,
  runner = false,
  bodyScale = 0.8,
  width = 0.8,
  height = 0.7,
  depth = 1.1
} = {}) {
  const group = new THREE.Group();
  const body = Math.max(0.45, Number(bodyScale) || 0.8);
  const colors = {
    fur: hexColor(color, '#96784e'),
    dark: predator ? '#3f3027' : runner ? '#735f3e' : '#604c32',
    light: runner ? '#d4c18d' : '#c7aa78',
    predator: Boolean(predator),
    runner: Boolean(runner)
  };

  const texture = createPixelTexture(
    THREE,
    CREATURE_FRAME_W * CREATURE_FRAMES,
    CREATURE_FRAME_H * HUMAN_DIRS,
    ctx => paintCreatureAtlas(ctx, colors)
  );
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.08,
    depthWrite: false
  });
  setAtlasFrame(material, 0, 0, CREATURE_FRAME_W, CREATURE_FRAME_H, CREATURE_FRAMES, HUMAN_DIRS);

  const sprite = new THREE.Sprite(material);
  sprite.center.set(0.5, 0);
  const scale = 1.35 + body * 0.55;
  sprite.scale.set(scale * 1.25, scale, 1);
  sprite.position.y = 0.02;
  group.add(sprite);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 10),
    new THREE.MeshBasicMaterial({ color: 0x152018, transparent: true, opacity: 0.2, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  group.add(shadow);

  const legs = [stubBone(0.4), stubBone(0.4), stubBone(0.4), stubBone(0.4)];
  const bodyMesh = stubBone(body * 0.72);
  const head = stubBone(body * 0.86);
  const tail = stubBone(body * 0.75);

  group.userData.pixel = {
    kind: 'creature',
    sprite,
    material,
    frame: 0,
    dir: 0,
    predator,
    runner
  };
  group.userData.rig = {
    body: bodyMesh,
    head,
    legs,
    tail,
    headBaseY: head.position.y,
    bodyBaseY: bodyMesh.position.y
  };
  // Keep footprint metadata for callers that inspect width/height.
  group.userData.span = { width, height, depth, bodyScale: body };
  return group;
}

export function animatePixelCreature(group, moving, t, behavior = 'roaming') {
  const pixel = group?.userData?.pixel;
  if (!pixel?.material) return;
  const dir = facingIndex(group.rotation.y);
  const pace = behavior === 'fleeing' ? 0.018 : behavior === 'feeding' ? 0 : 0.01;
  let frame = 0;
  if (behavior === 'feeding') frame = 0;
  else if (moving && pace > 0) frame = 1 + (Math.floor(t * pace) % 2);

  if (pixel.dir !== dir || pixel.frame !== frame) {
    pixel.dir = dir;
    pixel.frame = frame;
    setAtlasFrame(pixel.material, frame, dir, CREATURE_FRAME_W, CREATURE_FRAME_H, CREATURE_FRAMES, HUMAN_DIRS);
  }
  pixel.sprite.position.y = 0.02 + (moving ? Math.abs(Math.sin(t * 0.012)) * 0.03 : 0);
}

export const PIXEL_BEING_PALETTE = {
  skin: '#dfb083',
  hair: '#3b2a20',
  leather: '#5c4934',
  shadow: '#1a241c'
};
