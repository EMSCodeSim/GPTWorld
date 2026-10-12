// Original chunky pixel humanoids and wildlife for the isometric public/private worlds.
// Geometry stays animation-compatible with existing arm/leg/head rigs.
import {createPixelTexture, paintBlocks} from './pixel-art-core.mjs';

function mat(THREE, color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true, ...extra });
}

function paintFace(ctx, skinHex) {
  ctx.fillStyle = skinHex;
  ctx.fillRect(0, 0, 16, 16);
  paintBlocks(ctx, '#1d1a17', [[4,6,2,2],[10,6,2,2]]);
  paintBlocks(ctx, '#3a2a20', [[7,10,2,1]]);
  paintBlocks(ctx, '#c9966e', [[6,8,1,1],[9,8,1,1]]);
}

function faceMaterial(THREE, skin = 0xdfb083) {
  const hex = `#${skin.toString(16).padStart(6, '0')}`;
  const texture = createPixelTexture(THREE, 16, 16, ctx => paintFace(ctx, hex));
  return new THREE.MeshStandardMaterial({
    map: texture,
    color: 0xffffff,
    roughness: 1,
    flatShading: true
  });
}

export function createPixelHumanoid(THREE, {
  outfit = 0x8b7650,
  skin = 0xdfb083,
  hair = 0x3b2a20,
  accent = 0x3d3329,
  pack = false
} = {}) {
  const group = new THREE.Group();
  const cloth = mat(THREE, outfit);
  const skinMat = mat(THREE, skin);
  const hairMat = mat(THREE, hair);
  const legMat = mat(THREE, accent);
  const bootMat = mat(THREE, 0x332a22);
  const leather = mat(THREE, 0x5c4934);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.86, 0.42), cloth);
  torso.position.y = 1.28;
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.52, 0.48), faceMaterial(THREE, skin));
  head.position.y = 1.96;
  head.castShadow = true;
  group.add(head);

  const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.22, 0.52), hairMat);
  hairMesh.position.y = 2.22;
  group.add(hairMesh);

  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.2), skinMat);
  neck.position.y = 1.68;
  group.add(neck);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.1, 0.46), mat(THREE, 0x49392b));
  belt.position.y = 0.88;
  group.add(belt);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.08), mat(THREE, 0xb79a62));
  buckle.position.set(0, 0.88, 0.24);
  group.add(buckle);

  const armGeo = new THREE.BoxGeometry(0.2, 0.7, 0.22);
  const legGeo = new THREE.BoxGeometry(0.24, 0.7, 0.26);
  const armL = new THREE.Mesh(armGeo, cloth);
  const armR = armL.clone();
  const legL = new THREE.Mesh(legGeo, legMat);
  const legR = legL.clone();
  armL.position.set(-0.48, 1.25, 0);
  armR.position.set(0.48, 1.25, 0);
  legL.position.set(-0.18, 0.47, 0);
  legR.position.set(0.18, 0.47, 0);
  for (const mesh of [armL, armR, legL, legR]) {
    mesh.castShadow = true;
    group.add(mesh);
  }

  for (const x of [-0.48, 0.48]) {
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.18), skinMat);
    hand.position.set(x, 0.86, 0);
    group.add(hand);
  }
  for (const x of [-0.18, 0.18]) {
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.38), bootMat);
    boot.position.set(x, 0.1, 0.05);
    group.add(boot);
  }

  if (pack) {
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.72, 0.28), leather);
    bag.position.set(0, 1.3, -0.34);
    bag.castShadow = true;
    group.add(bag);
  }

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.48, 12),
    new THREE.MeshBasicMaterial({ color: 0x152018, transparent: true, opacity: 0.26, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  group.add(shadow);

  group.userData.rig = { armL, armR, legL, legR, torso, head, hairMesh };
  return group;
}

export function animatePixelHumanoid(group, moving, t, speed = 1) {
  const r = group?.userData?.rig;
  if (!r) return;
  const a = moving ? Math.sin(t * 0.012 * speed) * 0.52 : 0;
  r.legL.rotation.x = a;
  r.legR.rotation.x = -a;
  r.armL.rotation.x = -a * 0.72;
  r.armR.rotation.x = a * 0.72;
  r.torso.rotation.z = moving ? Math.sin(t * 0.024 * speed) * 0.02 : 0;
  r.torso.position.y = 1.28 + (moving ? Math.abs(Math.sin(t * 0.012 * speed)) * 0.018 : Math.sin(t * 0.0025) * 0.008);
  if (r.head) {
    r.head.rotation.y = moving ? 0 : Math.sin(t * 0.0017) * 0.1;
    r.head.position.y = 1.96 + (moving ? Math.abs(Math.sin(t * 0.012 * speed)) * 0.012 : Math.sin(t * 0.0025) * 0.006);
  }
  if (r.hairMesh) {
    r.hairMesh.rotation.y = r.head?.rotation.y || 0;
    r.hairMesh.position.y = 2.22 + (r.head?.position.y - 1.96 || 0);
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
  const dark = predator ? 0x3f3027 : runner ? 0x735f3e : 0x604c32;
  const light = runner ? 0xd4c18d : 0xc7aa78;
  const fur = mat(THREE, color);
  const darkMat = mat(THREE, dark);
  const lightMat = mat(THREE, light);

  const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), fur);
  bodyMesh.scale.set(Math.max(0.45, width), Math.max(0.42, height), Math.max(0.5, depth));
  bodyMesh.position.y = body * 0.72;
  bodyMesh.castShadow = true;
  group.add(bodyMesh);

  const headF = width * 0.58;
  const headSize = predator ? body * 0.62 : runner ? body * 0.5 : body * 0.58;
  const head = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), darkMat);
  head.scale.set(headSize, headSize * 0.78, headSize * 0.82);
  head.position.set(headF, body * 0.86, 0);
  head.castShadow = true;
  group.add(head);

  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), lightMat);
  muzzle.scale.set(headSize * 0.45, headSize * 0.28, headSize * 0.34);
  muzzle.position.set(headF + headSize * 0.58, body * 0.82, 0);
  group.add(muzzle);

  const eyeZ = headSize * 0.36;
  for (const z of [-eyeZ, eyeZ]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), mat(THREE, 0x171512));
    eye.position.set(headF + headSize * 0.34, body * 0.94, z);
    group.add(eye);
  }

  const nose = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat(THREE, predator ? 0x171512 : 0x3a3026));
  nose.scale.set(headSize * 0.2, headSize * 0.15, headSize * 0.2);
  nose.position.set(headF + headSize * 0.82, body * 0.8, 0);
  group.add(nose);

  const legH = predator ? body * 0.7 : runner ? body * 0.78 : body * 0.86;
  const legW = Math.max(0.07, body * 0.11);
  const front = width * 0.32;
  const rear = -width * 0.32;
  const side = depth * 0.34;
  const legs = [];
  for (const [x, z] of [[front, side], [front, -side], [rear, side], [rear, -side]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(legW * 1.2, legH, legW * 1.2), darkMat);
    leg.position.set(x, legH / 2, z);
    leg.castShadow = true;
    group.add(leg);
    legs.push(leg);
  }

  const tail = new THREE.Mesh(new THREE.BoxGeometry(predator ? body * 0.75 : body * 0.52, body * 0.14, body * 0.14), darkMat);
  tail.position.set(-width * 0.62, body * 0.75, 0);
  group.add(tail);

  if (predator) {
    for (const z of [-headSize * 0.28, headSize * 0.28]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(body * 0.12, body * 0.28, body * 0.1), mat(THREE, 0x2f251f));
      ear.position.set(headF + body * 0.02, body * 1.22, z);
      group.add(ear);
    }
  } else if (runner) {
    for (const z of [-headSize * 0.28, headSize * 0.28]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(body * 0.1, body * 0.42, body * 0.08), darkMat);
      ear.position.set(headF - body * 0.06, body * 1.28, z);
      group.add(ear);
    }
  } else {
    for (const z of [-headSize * 0.32, headSize * 0.32]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(body * 0.1, body * 0.3, body * 0.08), mat(THREE, 0xd0c39b));
      ear.position.set(headF + body * 0.08, body * 1.22, z);
      group.add(ear);
    }
  }

  group.userData.rig = {
    body: bodyMesh,
    head,
    legs,
    tail,
    headBaseY: head.position.y,
    bodyBaseY: bodyMesh.position.y
  };
  return group;
}
