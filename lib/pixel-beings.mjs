// Stylized Pixar-inspired travelers and wildlife for the isometric worlds.
// Soft rounded proportions, expressive faces, layered clothing, and attachment
// anchors so equipped gear follows the animated limb/body rig. Optimized for
// mobile browsers (shared geometries, modest segment counts, no external assets).
import {markCharacterObject} from './retro-visuals.mjs';

function mat(THREE, color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.55,
    metalness: options.metalness ?? 0.06,
    flatShading: false,
    map: options.map,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0
  });
}

function addMesh(THREE, parent, geometry, color, pos, options = {}) {
  const mesh = new THREE.Mesh(geometry, mat(THREE, color, options));
  mesh.position.set(pos[0], pos[1], pos[2]);
  if (options.scale) mesh.scale.set(options.scale[0], options.scale[1], options.scale[2]);
  if (options.rot) {
    mesh.rotation.x = options.rot[0] || 0;
    mesh.rotation.y = options.rot[1] || 0;
    mesh.rotation.z = options.rot[2] || 0;
  }
  mesh.castShadow = options.castShadow !== false;
  mesh.receiveShadow = Boolean(options.receiveShadow);
  parent.add(mesh);
  return mesh;
}

function paintFaceTexture(THREE, skinHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  // Soft skin base
  ctx.fillStyle = skinHex;
  ctx.fillRect(0, 0, 64, 64);
  // Warm cheek blush
  ctx.fillStyle = 'rgba(230, 130, 110, 0.28)';
  ctx.beginPath();
  ctx.ellipse(20, 40, 8, 6, 0, 0, Math.PI * 2);
  ctx.ellipse(44, 40, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Soft brow arches
  ctx.strokeStyle = 'rgba(55, 38, 28, 0.5)';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(14, 22);
  ctx.quadraticCurveTo(22, 18, 30, 22);
  ctx.moveTo(34, 22);
  ctx.quadraticCurveTo(42, 18, 50, 22);
  ctx.stroke();
  // Friendly smile
  ctx.strokeStyle = 'rgba(110, 60, 50, 0.62)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(24, 46);
  ctx.quadraticCurveTo(32, 52, 40, 46);
  ctx.stroke();
  // Soft nose hint
  ctx.fillStyle = 'rgba(180, 110, 90, 0.28)';
  ctx.beginPath();
  ctx.ellipse(32, 36, 3.5, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createPixelHumanoid(THREE, {
  outfit = 0x8b7650,
  skin = 0xdfb083,
  hair = 0x3b2a20,
  accent = 0x3d3329,
  pack = false
} = {}) {
  const group = new THREE.Group();
  const skinHex = `#${Number(skin).toString(16).padStart(6, '0')}`;
  const shirt = Number(outfit) || 0x8b7650;
  const pants = Number(accent) || 0x3d3329;
  const trim = 0xb79a62;

  // Slightly larger head / rounded torso = stylized “Pixar” silhouette.
  const pelvis = new THREE.Group();
  pelvis.position.y = 0.9;
  group.add(pelvis);

  const torso = addMesh(THREE, pelvis, new THREE.CapsuleGeometry(0.36, 0.48, 6, 12), shirt, [0, 0.4, 0], {
    scale: [1.05, 1.02, 0.82],
    roughness: 0.62
  });
  // Soft belly / volume
  addMesh(THREE, pelvis, new THREE.SphereGeometry(0.28, 12, 10), shirt, [0, 0.28, 0.08], {
    scale: [1.05, 0.72, 0.7],
    roughness: 0.68,
    castShadow: false
  });

  const belt = addMesh(THREE, pelvis, new THREE.TorusGeometry(0.34, 0.04, 8, 18), 0x4a3828, [0, 0.06, 0], {
    roughness: 0.5,
    castShadow: false
  });
  belt.rotation.x = Math.PI / 2;
  addMesh(THREE, pelvis, new THREE.BoxGeometry(0.15, 0.1, 0.08), trim, [0, 0.06, 0.32], {
    roughness: 0.42,
    castShadow: false
  });
  // Collar
  addMesh(THREE, pelvis, new THREE.TorusGeometry(0.22, 0.035, 6, 14), trim, [0, 0.78, 0.04], {
    roughness: 0.55,
    castShadow: false
  }).rotation.x = Math.PI / 2;

  const faceMap = paintFaceTexture(THREE, skinHex);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 16, 14),
    new THREE.MeshStandardMaterial({
      map: faceMap,
      color: 0xffffff,
      roughness: 0.48,
      metalness: 0.04
    })
  );
  head.position.set(0, 1.95, 0.02);
  head.scale.set(0.95, 1.05, 0.92);
  head.castShadow = true;
  group.add(head);

  // Layered hair volume
  const hairMesh = addMesh(THREE, group, new THREE.SphereGeometry(0.36, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58), hair, [0, 2.12, -0.04], {
    roughness: 0.82
  });
  hairMesh.scale.set(1.02, 0.82, 1.0);
  addMesh(THREE, group, new THREE.SphereGeometry(0.14, 10, 8), hair, [0, 2.0, -0.22], {
    scale: [1.4, 0.9, 0.8],
    roughness: 0.85,
    castShadow: false
  });

  // Neck
  addMesh(THREE, group, new THREE.CapsuleGeometry(0.09, 0.12, 4, 8), skin, [0, 1.7, 0.02], {
    roughness: 0.5,
    castShadow: false
  });

  const armGeo = new THREE.CapsuleGeometry(0.095, 0.34, 5, 10);
  const forearmGeo = new THREE.CapsuleGeometry(0.08, 0.28, 5, 9);
  const legGeo = new THREE.CapsuleGeometry(0.11, 0.32, 5, 10);
  const lowerLegGeo = new THREE.CapsuleGeometry(0.09, 0.3, 5, 9);

  function makeArm(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.46, 1.55, 0);
    group.add(pivot);
    const upper = addMesh(THREE, pivot, armGeo.clone(), shirt, [0, -0.22, 0], { roughness: 0.64 });
    // Shoulder puff
    addMesh(THREE, pivot, new THREE.SphereGeometry(0.12, 10, 8), shirt, [0, 0.02, 0], {
      scale: [1.05, 0.85, 1.0],
      roughness: 0.7,
      castShadow: false
    });
    const elbow = new THREE.Group();
    elbow.position.y = -0.42;
    pivot.add(elbow);
    addMesh(THREE, elbow, forearmGeo.clone(), shirt, [0, -0.16, 0], { roughness: 0.64 });
    // Cuff
    addMesh(THREE, elbow, new THREE.TorusGeometry(0.085, 0.02, 6, 12), trim, [0, -0.28, 0], {
      roughness: 0.5,
      castShadow: false
    }).rotation.x = Math.PI / 2;
    const hand = addMesh(THREE, elbow, new THREE.SphereGeometry(0.09, 10, 8), skin, [0, -0.36, 0.01], {
      castShadow: false,
      roughness: 0.48
    });
    const attachHand = new THREE.Group();
    attachHand.position.set(0, -0.38, 0.02);
    elbow.add(attachHand);
    return { pivot, elbow, mesh: upper, hand, attachHand };
  }

  function makeLeg(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.18, 0.86, 0);
    group.add(pivot);
    const upper = addMesh(THREE, pivot, legGeo.clone(), pants, [0, -0.19, 0], { roughness: 0.72 });
    const knee = new THREE.Group();
    knee.position.y = -0.38;
    pivot.add(knee);
    addMesh(THREE, knee, lowerLegGeo.clone(), pants, [0, -0.16, 0], { roughness: 0.74 });
    const boot = addMesh(THREE, knee, new THREE.BoxGeometry(0.24, 0.14, 0.36), 0x2f2822, [0, -0.35, 0.07], {
      roughness: 0.88
    });
    const attachFoot = new THREE.Group();
    attachFoot.position.set(0, -0.35, 0.07);
    knee.add(attachFoot);
    const attachLeg = new THREE.Group();
    attachLeg.position.set(0, -0.2, 0);
    pivot.add(attachLeg);
    return { pivot, knee, mesh: upper, boot, attachFoot, attachLeg };
  }

  const armLeft = makeArm(-1), armRight = makeArm(1);
  const legLeft = makeLeg(-1), legRight = makeLeg(1);
  const armL = armLeft.mesh, armR = armRight.mesh, legL = legLeft.mesh, legR = legRight.mesh;

  // Soft shoulder pads / collar accents
  for (const side of [-1, 1]) {
    addMesh(THREE, group, new THREE.SphereGeometry(0.12, 10, 8), pants, [side * 0.44, 1.5, 0], {
      scale: [0.95, 0.78, 0.88],
      roughness: 0.75
    });
  }

  // Expressive eyes with highlights
  const eyeGeo = new THREE.SphereGeometry(0.042, 8, 6);
  const eyeMat = mat(THREE, 0x1a1714, { roughness: 0.28, metalness: 0.12 });
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat.clone());
  eyeL.position.set(-0.1, 0.04, 0.29);
  eyeR.position.set(0.1, 0.04, 0.29);
  head.add(eyeL);
  head.add(eyeR);
  const shineL = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), mat(THREE, 0xf8f4ea, { roughness: 0.15 }));
  const shineR = shineL.clone();
  shineL.position.set(0.012, 0.012, 0.032);
  shineR.position.set(0.012, 0.012, 0.032);
  eyeL.add(shineL);
  eyeR.add(shineR);

  // Attachment anchors — equipment meshes parent here so gait/attack animate gear.
  const attachHead = new THREE.Group();
  attachHead.position.set(0, 0.12, 0);
  head.add(attachHead);
  const attachChest = new THREE.Group();
  attachChest.position.set(0, 0.42, 0.02);
  pelvis.add(attachChest);
  const attachBack = new THREE.Group();
  attachBack.position.set(0, 1.3, -0.36);
  group.add(attachBack);
  const attachMainHand = armRight.attachHand;
  const attachOffHand = armLeft.attachHand;

  if (pack) {
    addMesh(THREE, attachBack, new THREE.BoxGeometry(0.52, 0.68, 0.26), 0x5c4934, [0, 0, 0], { roughness: 0.78 });
    addMesh(THREE, attachBack, new THREE.BoxGeometry(0.08, 0.55, 0.06), 0x302820, [-0.2, 0.02, 0.12], { castShadow: false });
    addMesh(THREE, attachBack, new THREE.BoxGeometry(0.08, 0.55, 0.06), 0x302820, [0.2, 0.02, 0.12], { castShadow: false });
  }

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.44, 16),
    new THREE.MeshBasicMaterial({ color: 0x152018, transparent: true, opacity: 0.26, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  group.add(shadow);

  group.userData.pixel = {
    kind: 'humanoid',
    feature: true,
    stylized: true,
    pack: Boolean(pack),
    eyeL,
    eyeR,
    blink: 0
  };
  group.userData.attachments = {
    head: attachHead,
    chest: attachChest,
    back: attachBack,
    mainHand: attachMainHand,
    offHand: attachOffHand,
    feetL: legLeft.attachFoot,
    feetR: legRight.attachFoot,
    legsL: legLeft.attachLeg,
    legsR: legRight.attachLeg
  };
  group.userData.rig = {
    armL,
    armR,
    legL,
    legR,
    armLPivot: armLeft.pivot,
    armRPivot: armRight.pivot,
    elbowL: armLeft.elbow,
    elbowR: armRight.elbow,
    legLPivot: legLeft.pivot,
    legRPivot: legRight.pivot,
    kneeL: legLeft.knee,
    kneeR: legRight.knee,
    torso,
    head,
    hairMesh,
    pelvis,
    eyeL,
    eyeR,
    attachHead,
    attachChest,
    attachBack,
    attachMainHand,
    attachOffHand,
    torsoBaseY: torso.position.y,
    headBaseY: head.position.y,
    hairBaseY: hairMesh.position.y
  };
  return markCharacterObject(group);
}

/**
 * @param {object} group
 * @param {boolean} moving
 * @param {number} t
 * @param {number} [speed]
 * @param {{attack?: number, idle?: boolean}} [pose] attack 0–1 draw strength
 */
export function animatePixelHumanoid(group, moving, t, speed = 1, pose = {}) {
  const rig = group?.userData?.rig;
  const pixel = group?.userData?.pixel;
  if (!rig) return;

  const attack = Math.max(0, Math.min(1, Number(pose.attack || 0)));
  const gatherPose = !moving && Math.abs(rig.armR?.rotation?.x || 0) > 0.5 && attack <= 0;
  const walk = moving ? Math.sin(t * 0.012 * speed) * 0.55 : 0;
  const breathe = Math.sin(t * 0.0024) * 0.014;

  if (!gatherPose) {
    const stride = moving && attack <= 0 ? walk : 0;
    if (rig.legLPivot) rig.legLPivot.rotation.x = stride;
    if (rig.legRPivot) rig.legRPivot.rotation.x = -stride;
    if (rig.kneeL) rig.kneeL.rotation.x = moving ? Math.max(0, -stride) * 0.9 : 0;
    if (rig.kneeR) rig.kneeR.rotation.x = moving ? Math.max(0, stride) * 0.9 : 0;

    if (attack > 0) {
      // Draw-and-release: right arm pulls bow, left braces.
      if (rig.armRPivot) {
        rig.armRPivot.rotation.x = -0.35 - attack * 0.95;
        rig.armRPivot.rotation.z = -0.15 * attack;
      }
      if (rig.armLPivot) {
        rig.armLPivot.rotation.x = -0.55 - attack * 0.35;
        rig.armLPivot.rotation.z = 0.35 * attack;
      }
      if (rig.elbowR) rig.elbowR.rotation.x = 0.2 + attack * 0.85;
      if (rig.elbowL) rig.elbowL.rotation.x = 0.15 + attack * 0.25;
    } else {
      if (rig.armLPivot) {
        rig.armLPivot.rotation.x = -stride * 0.72;
        rig.armLPivot.rotation.z = 0;
      }
      if (rig.armRPivot) {
        rig.armRPivot.rotation.x = stride * 0.72;
        rig.armRPivot.rotation.z = 0;
      }
      if (rig.elbowL) rig.elbowL.rotation.x = moving ? 0.12 + Math.max(0, stride) * 0.35 : 0.08;
      if (rig.elbowR) rig.elbowR.rotation.x = moving ? 0.12 + Math.max(0, -stride) * 0.35 : 0.08;
    }

    // Keep legacy mesh handles animated for gather code and integrations.
    rig.legL.rotation.x = stride * 0.08;
    rig.legR.rotation.x = -stride * 0.08;
    if (attack <= 0) {
      rig.armL.rotation.x = -stride * 0.08;
      rig.armR.rotation.x = stride * 0.08;
    }
  }

  rig.torso.rotation.z = moving ? Math.sin(t * 0.024 * speed) * 0.02 : Math.sin(t * 0.0018) * 0.012;
  if (attack > 0) rig.torso.rotation.z += attack * 0.04;
  rig.torso.position.y = rig.torsoBaseY + (moving ? Math.abs(Math.sin(t * 0.012 * speed)) * 0.03 : breathe);
  rig.head.position.y = rig.headBaseY + (moving ? Math.abs(Math.sin(t * 0.012 * speed)) * 0.02 : breathe * 0.6);
  if (attack > 0) rig.head.rotation.x = -0.08 * attack;
  else rig.head.rotation.x = 0;
  rig.hairMesh.position.y = rig.hairBaseY + (rig.head.position.y - rig.headBaseY);
  rig.head.rotation.y = moving || attack > 0 ? 0 : Math.sin(t * 0.0015) * 0.08;
  if (rig.pelvis) rig.pelvis.position.y = 0.9 + (moving ? Math.abs(Math.sin(t * 0.012 * speed)) * 0.02 : breathe * 0.4);

  // Occasional blink
  if (pixel?.eyeL && pixel?.eyeR) {
    const cycle = (t * 0.001) % 4.2;
    const blink = cycle > 4.0 ? Math.max(0.08, 1 - (cycle - 4.0) * 8) : 1;
    pixel.eyeL.scale.y = blink;
    pixel.eyeR.scale.y = blink;
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
  const fur = Number(color) || 0x96784e;
  const dark = predator ? 0x3f3027 : runner ? 0x735f3e : 0x604c32;
  const light = runner ? 0xd4c18d : 0xc7aa78;
  const belly = predator ? 0x8a6a52 : 0xd8c49a;

  const root = new THREE.Group();
  root.position.y = 0.02;
  group.add(root);

  const bodyMesh = addMesh(THREE, root, new THREE.SphereGeometry(0.42 * body, 14, 10), fur, [0, 0.72 * body, 0], {
    scale: [1.15, 0.72, predator ? 0.85 : 1.05],
    roughness: 0.78
  });
  addMesh(THREE, root, new THREE.SphereGeometry(0.28 * body, 12, 8), belly, [0, 0.58 * body, 0.06], {
    scale: [0.85, 0.55, 0.7],
    roughness: 0.7,
    castShadow: false
  });

  const head = addMesh(THREE, root, new THREE.SphereGeometry(0.28 * body, 14, 10), fur, [0, 0.9 * body, 0.55 * body], {
    scale: [0.95, 0.82, 0.9],
    roughness: 0.72
  });
  addMesh(THREE, head, new THREE.SphereGeometry(0.14 * body, 10, 8), light, [0, -0.04, 0.2], {
    scale: [1.05, 0.7, 1.1],
    roughness: 0.65,
    castShadow: false
  });

  const eyeGeo = new THREE.SphereGeometry(0.035 * body, 8, 6);
  const eyeMat = mat(THREE, predator ? 0x2a1810 : 0x171512, { roughness: 0.3 });
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat.clone());
  eyeL.position.set(-0.09 * body, 0.05, 0.2);
  eyeR.position.set(0.09 * body, 0.05, 0.2);
  head.add(eyeL);
  head.add(eyeR);

  const earL = addMesh(
    THREE,
    head,
    new THREE.ConeGeometry(predator ? 0.07 * body : 0.06 * body, predator ? 0.22 * body : runner ? 0.28 * body : 0.2 * body, 6),
    predator ? dark : runner ? fur : light,
    [-0.12 * body, 0.22 * body, -0.02],
    { roughness: 0.8, castShadow: false }
  );
  const earR = addMesh(
    THREE,
    head,
    new THREE.ConeGeometry(predator ? 0.07 * body : 0.06 * body, predator ? 0.22 * body : runner ? 0.28 * body : 0.2 * body, 6),
    predator ? dark : runner ? fur : light,
    [0.12 * body, 0.22 * body, -0.02],
    { roughness: 0.8, castShadow: false }
  );
  earL.rotation.z = -0.25;
  earR.rotation.z = 0.25;

  const legs = [], legPivots = [], lowerLegs = [];
  const upperLegGeo = new THREE.CapsuleGeometry(0.06 * body, 0.27 * body, 5, 8);
  const lowerLegGeo = new THREE.CapsuleGeometry(0.052 * body, 0.21 * body, 5, 8);
  for (const [x, z] of [
    [-0.22 * body, 0.22 * body],
    [0.22 * body, 0.22 * body],
    [-0.24 * body, -0.28 * body],
    [0.24 * body, -0.28 * body]
  ]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.44 * body, z);
    root.add(pivot);
    const upper = addMesh(THREE, pivot, upperLegGeo.clone(), dark, [0, -0.14 * body, 0], { roughness: 0.82 });
    const knee = new THREE.Group();
    knee.position.y = -0.28 * body;
    pivot.add(knee);
    addMesh(THREE, knee, lowerLegGeo.clone(), dark, [0, -0.105 * body, 0], { roughness: 0.84 });
    addMesh(THREE, knee, new THREE.SphereGeometry(0.075 * body, 9, 7), dark, [0, -0.23 * body, 0.045 * body], { scale: [1.2, 0.68, 1.45], roughness: 0.88 });
    legs.push(upper);
    legPivots.push(pivot);
    lowerLegs.push(knee);
  }

  const tail = addMesh(
    THREE,
    root,
    new THREE.ConeGeometry(predator ? 0.1 * body : 0.08 * body, predator ? 0.55 * body : 0.42 * body, 7),
    predator ? dark : light,
    [0, 0.78 * body, -0.55 * body],
    { roughness: 0.75 }
  );
  tail.rotation.x = predator ? 0.55 : 1.15;

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.48 * body, 14),
    new THREE.MeshBasicMaterial({ color: 0x152018, transparent: true, opacity: 0.22, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  group.add(shadow);

  group.userData.pixel = {
    kind: 'creature',
    feature: true,
    predator,
    runner,
    earL,
    earR,
    eyeL,
    eyeR
  };
  group.userData.rig = {
    body: bodyMesh,
    head,
    legs,
    legPivots,
    lowerLegs,
    tail,
    earL,
    earR,
    headBaseY: head.position.y,
    bodyBaseY: bodyMesh.position.y,
    root
  };
  group.userData.span = { width, height, depth, bodyScale: body };
  return markCharacterObject(group);
}

export function animatePixelCreature(group, moving, t, behavior = 'roaming', movementSpeed = 1) {
  const rig = group?.userData?.rig;
  const pixel = group?.userData?.pixel;
  if (!rig) return;

  const fleeing = behavior === 'fleeing';
  const feeding = behavior === 'feeding' || behavior === 'grazing';
  const pace = fleeing ? 0.015 : feeding ? 0 : 0.009;
  const cadence = Math.max(0.55, Math.min(1.7, Number(movementSpeed) || 1));
  const gait = moving && pace > 0 ? Math.sin(t * pace * 55 * cadence) * (fleeing ? 0.48 : 0.28) : 0;

  if (rig.legs?.length === 4) {
    const phases = [1, -1, -1, 1];
    rig.legs.forEach((leg, index) => {
      const swing = gait * phases[index];
      if (rig.legPivots?.[index]) rig.legPivots[index].rotation.x = swing;
      if (rig.lowerLegs?.[index]) rig.lowerLegs[index].rotation.x = moving ? Math.max(0, -swing) * (fleeing ? 1.1 : 0.72) : 0;
      // Legacy handles remain meaningful for wildlife interactions and tests.
      leg.rotation.x = swing * 0.06;
    });
  }

  const bob = moving ? Math.abs(Math.sin(t * 0.012 * cadence)) * (fleeing ? 0.045 : 0.026) : Math.sin(t * 0.0022) * 0.01;
  if (rig.body) rig.body.position.y = rig.bodyBaseY + bob;
  if (rig.head) {
    rig.head.position.y = rig.headBaseY + (feeding ? -0.12 + 0.03 * Math.sin(t * 0.004) : bob * 0.7);
    rig.head.rotation.x = feeding ? 0.45 + Math.sin(t * 0.003) * 0.08 : moving ? Math.sin(t * 0.01) * 0.06 : Math.sin(t * 0.0015) * 0.05;
  }
  if (rig.tail) {
    rig.tail.rotation.z = Math.sin(t * (fleeing ? 0.02 : 0.006)) * (fleeing ? 0.35 : 0.18);
    rig.tail.rotation.x = (fleeing ? 0.35 : 0.9) + Math.sin(t * 0.008) * 0.08;
  }
  if (pixel?.earL && pixel?.earR) {
    const twitch = Math.sin(t * 0.01 + 1.7) * 0.12;
    pixel.earL.rotation.z = -0.25 + twitch;
    pixel.earR.rotation.z = 0.25 - twitch;
  }
  if (pixel?.eyeL && pixel?.eyeR) {
    const cycle = (t * 0.001 + 1.1) % 5.1;
    const blink = cycle > 4.85 ? Math.max(0.08, 1 - (cycle - 4.85) * 10) : 1;
    pixel.eyeL.scale.y = blink;
    pixel.eyeR.scale.y = blink;
  }
}

export const PIXEL_BEING_PALETTE = {
  skin: '#dfb083',
  hair: '#3b2a20',
  leather: '#5c4934',
  shadow: '#1a241c'
};
