// Pixar-style cartoon travelers and wildlife for the isometric worlds.
// Oversized head, big expressive eyes, soft rounded clothing, and attachment
// anchors so equipped gear follows the animated limb/body rig. Optimized for
// mobile browsers (procedural primitives only, modest segment counts).
import {markCharacterObject} from './retro-visuals.mjs';

function mat(THREE, color, options = {}) {
  const material = {
    color,
    roughness: options.roughness ?? 0.48,
    metalness: options.metalness ?? 0.04,
    flatShading: false
  };
  if (options.map) material.map = options.map;
  if (options.emissive != null) {
    material.emissive = options.emissive;
    material.emissiveIntensity = options.emissiveIntensity ?? 0;
  }
  return new THREE.MeshStandardMaterial(material);
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

function paintCartoonSkin(THREE, skinHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  // Soft gradient skin (fallback solid fill for lightweight test mocks)
  if (typeof ctx.createRadialGradient === 'function') {
    const grad = ctx.createRadialGradient(42, 38, 8, 48, 48, 56);
    grad.addColorStop(0, lightenHex(skinHex, 0.12));
    grad.addColorStop(0.55, skinHex);
    grad.addColorStop(1, darkenHex(skinHex, 0.1));
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = skinHex;
  }
  ctx.fillRect(0, 0, 96, 96);
  // Subtle cheek warmth — keep light so 3D eyes stay the star
  ctx.fillStyle = 'rgba(255, 130, 120, 0.18)';
  ctx.beginPath();
  ctx.ellipse(26, 62, 9, 6, -0.15, 0, Math.PI * 2);
  ctx.ellipse(70, 62, 9, 6, 0.15, 0, Math.PI * 2);
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function lightenHex(hex, amount) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  const r = Math.min(255, ((n >> 16) & 255) + Math.round(255 * amount));
  const g = Math.min(255, ((n >> 8) & 255) + Math.round(255 * amount));
  const b = Math.min(255, (n & 255) + Math.round(255 * amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function darkenHex(hex, amount) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  const r = Math.max(0, ((n >> 16) & 255) - Math.round(255 * amount));
  const g = Math.max(0, ((n >> 8) & 255) - Math.round(255 * amount));
  const b = Math.max(0, (n & 255) - Math.round(255 * amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function makeCartoonEye(THREE, side) {
  const eye = new THREE.Group();
  if (!eye.scale) eye.scale = {x: 1, y: 1, z: 1};
  // White sclera — oversized Pixar eye
  const sclera = addMesh(THREE, eye, new THREE.SphereGeometry(0.11, 14, 12), 0xfff8f0, [0, 0, 0], {
    roughness: 0.28,
    metalness: 0.02,
    castShadow: false
  });
  sclera.scale.set(1, 1.18, 0.9);
  // Iris
  const iris = addMesh(THREE, eye, new THREE.SphereGeometry(0.068, 12, 10), 0x5a3d28, [0, 0.004, 0.055], {
    roughness: 0.32,
    metalness: 0.08,
    castShadow: false
  });
  iris.scale.set(1, 1.08, 0.58);
  // Pupil
  addMesh(THREE, eye, new THREE.SphereGeometry(0.034, 10, 8), 0x120e0c, [0, 0.002, 0.09], {
    roughness: 0.18,
    metalness: 0.15,
    castShadow: false
  });
  // Dual catchlights
  const shineA = addMesh(THREE, eye, new THREE.SphereGeometry(0.02, 8, 6), 0xffffff, [0.022, 0.024, 0.11], {
    roughness: 0.08,
    metalness: 0.2,
    castShadow: false
  });
  addMesh(THREE, eye, new THREE.SphereGeometry(0.011, 6, 5), 0xffffff, [-0.02, -0.012, 0.1], {
    roughness: 0.1,
    castShadow: false
  });
  // Soft upper lid
  const lid = addMesh(THREE, eye, new THREE.SphereGeometry(0.115, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), 0xd4a07a, [0, 0.045, 0.015], {
    roughness: 0.5,
    castShadow: false
  });
  lid.scale.set(1.05, 0.55, 0.9);
  eye.position.set(side * 0.14, 0.055, 0.34);
  eye.rotation.y = side * -0.14;
  return {root: eye, sclera, shine: shineA};
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
  const trim = 0xc4a36a;
  const skinOpts = {roughness: 0.42, metalness: 0.03, emissive: 0x3a1810, emissiveIntensity: 0.04};
  const clothOpts = {roughness: 0.68, metalness: 0.02};

  // Cartoon proportions: shorter chunky body, oversized head.
  const pelvis = new THREE.Group();
  pelvis.position.y = 0.82;
  group.add(pelvis);

  const torso = addMesh(THREE, pelvis, new THREE.CapsuleGeometry(0.34, 0.38, 6, 14), shirt, [0, 0.34, 0], {
    scale: [1.12, 1.0, 0.88],
    ...clothOpts
  });
  // Soft belly volume
  addMesh(THREE, pelvis, new THREE.SphereGeometry(0.3, 14, 12), shirt, [0, 0.22, 0.1], {
    scale: [1.08, 0.78, 0.78],
    roughness: 0.72,
    castShadow: false
  });
  // Rounded collar
  addMesh(THREE, pelvis, new THREE.TorusGeometry(0.2, 0.045, 8, 16), lightenColor(shirt, 0.12), [0, 0.68, 0.06], {
    roughness: 0.6,
    castShadow: false
  }).rotation.x = Math.PI / 2;
  // Belt + buckle
  const belt = addMesh(THREE, pelvis, new THREE.TorusGeometry(0.33, 0.042, 8, 18), 0x4a3426, [0, 0.02, 0], {
    roughness: 0.55,
    castShadow: false
  });
  belt.rotation.x = Math.PI / 2;
  addMesh(THREE, pelvis, new THREE.BoxGeometry(0.16, 0.12, 0.08), trim, [0, 0.02, 0.33], {
    roughness: 0.4,
    metalness: 0.25,
    castShadow: false
  });

  // Large cartoon head
  const faceMap = paintCartoonSkin(THREE, skinHex);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 18, 16),
    new THREE.MeshStandardMaterial({
      map: faceMap,
      color: 0xffffff,
      roughness: 0.4,
      metalness: 0.03,
      emissive: 0x2a140c,
      emissiveIntensity: 0.035
    })
  );
  head.position.set(0, 1.88, 0.04);
  head.scale.set(0.96, 1.08, 0.94);
  head.castShadow = true;
  group.add(head);

  // Soft cheeks
  for (const side of [-1, 1]) {
    addMesh(THREE, head, new THREE.SphereGeometry(0.12, 10, 8), skin, [side * 0.28, -0.08, 0.18], {
      scale: [0.85, 0.75, 0.7],
      ...skinOpts,
      castShadow: false
    });
  }
  // Soft nose
  addMesh(THREE, head, new THREE.SphereGeometry(0.07, 10, 8), skin, [0, -0.02, 0.36], {
    scale: [0.85, 0.7, 1.05],
    ...skinOpts,
    castShadow: false
  });
  // Ears
  for (const side of [-1, 1]) {
    addMesh(THREE, head, new THREE.SphereGeometry(0.09, 10, 8), skin, [side * 0.38, 0.02, -0.02], {
      scale: [0.55, 0.75, 0.5],
      ...skinOpts,
      castShadow: false
    });
  }
  // Brows
  for (const side of [-1, 1]) {
    const brow = addMesh(THREE, head, new THREE.CapsuleGeometry(0.018, 0.09, 4, 6), hair, [side * 0.125, 0.14, 0.34], {
      roughness: 0.75,
      castShadow: false
    });
    brow.rotation.z = side * -0.35;
    brow.rotation.x = -0.25;
  }
  // Clear cartoon mouth — readable at isometric distance
  const mouth = new THREE.Group();
  mouth.position.set(0, -0.18, 0.36);
  head.add(mouth);
  // Soft lip volume / smile shape
  const lowerLip = addMesh(THREE, mouth, new THREE.SphereGeometry(0.08, 12, 10), 0xc45f5f, [0, -0.01, 0.02], {
    scale: [1.35, 0.45, 0.7],
    roughness: 0.42,
    castShadow: false
  });
  const upperLip = addMesh(THREE, mouth, new THREE.SphereGeometry(0.07, 12, 10), 0xd46b6b, [0, 0.02, 0.025], {
    scale: [1.25, 0.32, 0.55],
    roughness: 0.4,
    castShadow: false
  });
  // Friendly open smile interior
  addMesh(THREE, mouth, new THREE.SphereGeometry(0.055, 10, 8), 0x4a1820, [0, 0.0, 0.04], {
    scale: [1.15, 0.35, 0.45],
    roughness: 0.55,
    castShadow: false
  });
  // Tiny tooth highlight for cartoon readability
  addMesh(THREE, mouth, new THREE.BoxGeometry(0.07, 0.018, 0.02), 0xfff6e8, [0, 0.012, 0.055], {
    roughness: 0.35,
    castShadow: false
  });
  // Corner dimples so the smile reads from the side
  for (const side of [-1, 1]) {
    addMesh(THREE, mouth, new THREE.SphereGeometry(0.022, 8, 6), 0xc45f5f, [side * 0.085, 0.0, 0.01], {
      scale: [0.8, 0.7, 0.7],
      roughness: 0.45,
      castShadow: false
    });
  }

  // Voluminous cartoon hair
  const hairMesh = addMesh(THREE, group, new THREE.SphereGeometry(0.44, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), hair, [0, 2.08, -0.02], {
    roughness: 0.78
  });
  hairMesh.scale.set(1.05, 0.88, 1.02);
  addMesh(THREE, group, new THREE.SphereGeometry(0.2, 12, 10), hair, [0, 2.22, -0.02], {
    scale: [1.15, 0.85, 1.05],
    roughness: 0.8,
    castShadow: false
  });
  addMesh(THREE, group, new THREE.SphereGeometry(0.18, 12, 10), hair, [-0.22, 2.05, -0.12], {
    scale: [1.1, 0.9, 1.0],
    roughness: 0.82,
    castShadow: false
  });
  addMesh(THREE, group, new THREE.SphereGeometry(0.18, 12, 10), hair, [0.22, 2.05, -0.12], {
    scale: [1.1, 0.9, 1.0],
    roughness: 0.82,
    castShadow: false
  });
  addMesh(THREE, group, new THREE.SphereGeometry(0.16, 10, 8), hair, [0, 1.95, -0.28], {
    scale: [1.35, 0.85, 0.9],
    roughness: 0.84,
    castShadow: false
  });

  // Short soft neck
  addMesh(THREE, group, new THREE.CapsuleGeometry(0.1, 0.1, 4, 8), skin, [0, 1.58, 0.03], {
    ...skinOpts,
    castShadow: false
  });

  const armGeo = new THREE.CapsuleGeometry(0.11, 0.28, 5, 10);
  const forearmGeo = new THREE.CapsuleGeometry(0.095, 0.24, 5, 9);
  const legGeo = new THREE.CapsuleGeometry(0.125, 0.26, 5, 10);
  const lowerLegGeo = new THREE.CapsuleGeometry(0.105, 0.24, 5, 9);

  function makeArm(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.48, 1.42, 0);
    group.add(pivot);
    // Puffy shoulder
    addMesh(THREE, pivot, new THREE.SphereGeometry(0.155, 12, 10), shirt, [0, 0.02, 0], {
      scale: [1.15, 0.9, 1.1],
      ...clothOpts
    });
    const upper = addMesh(THREE, pivot, armGeo.clone(), shirt, [0, -0.2, 0], clothOpts);
    const elbow = new THREE.Group();
    elbow.position.y = -0.38;
    pivot.add(elbow);
    addMesh(THREE, elbow, forearmGeo.clone(), shirt, [0, -0.14, 0], clothOpts);
    // Soft cuff
    addMesh(THREE, elbow, new THREE.TorusGeometry(0.1, 0.025, 6, 12), trim, [0, -0.26, 0], {
      roughness: 0.5,
      castShadow: false
    }).rotation.x = Math.PI / 2;
    // Mitten hand + thumb
    const hand = addMesh(THREE, elbow, new THREE.SphereGeometry(0.105, 12, 10), skin, [0, -0.34, 0.02], {
      ...skinOpts,
      castShadow: false
    });
    hand.scale.set(1.05, 0.9, 1.15);
    addMesh(THREE, elbow, new THREE.SphereGeometry(0.045, 8, 6), skin, [side * 0.07, -0.3, 0.06], {
      ...skinOpts,
      castShadow: false
    });
    const attachHand = new THREE.Group();
    attachHand.position.set(0, -0.36, 0.04);
    elbow.add(attachHand);
    return { pivot, elbow, mesh: upper, hand, attachHand };
  }

  function makeLeg(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.17, 0.78, 0);
    group.add(pivot);
    const upper = addMesh(THREE, pivot, legGeo.clone(), pants, [0, -0.16, 0], { roughness: 0.74 });
    const knee = new THREE.Group();
    knee.position.y = -0.34;
    pivot.add(knee);
    addMesh(THREE, knee, lowerLegGeo.clone(), pants, [0, -0.13, 0], { roughness: 0.76 });
    // Rounded cartoon boot
    const boot = addMesh(THREE, knee, new THREE.SphereGeometry(0.13, 12, 10), 0x2c241e, [0, -0.3, 0.06], {
      scale: [1.15, 0.72, 1.45],
      roughness: 0.86
    });
    addMesh(THREE, knee, new THREE.BoxGeometry(0.2, 0.06, 0.28), 0x1f1a16, [0, -0.36, 0.1], {
      roughness: 0.9,
      castShadow: false
    });
    const attachFoot = new THREE.Group();
    attachFoot.position.set(0, -0.32, 0.08);
    knee.add(attachFoot);
    const attachLeg = new THREE.Group();
    attachLeg.position.set(0, -0.16, 0);
    pivot.add(attachLeg);
    return { pivot, knee, mesh: upper, boot, attachFoot, attachLeg };
  }

  const armLeft = makeArm(-1), armRight = makeArm(1);
  const legLeft = makeLeg(-1), legRight = makeLeg(1);
  const armL = armLeft.mesh, armR = armRight.mesh, legL = legLeft.mesh, legR = legRight.mesh;

  // Big cartoon eyes
  const eyeLeft = makeCartoonEye(THREE, -1);
  const eyeRight = makeCartoonEye(THREE, 1);
  head.add(eyeLeft.root);
  head.add(eyeRight.root);
  const eyeL = eyeLeft.root, eyeR = eyeRight.root;

  // Attachment anchors
  const attachHead = new THREE.Group();
  attachHead.position.set(0, 0.18, 0);
  head.add(attachHead);
  const attachChest = new THREE.Group();
  attachChest.position.set(0, 0.34, 0.04);
  pelvis.add(attachChest);
  const attachBack = new THREE.Group();
  attachBack.position.set(0, 1.18, -0.34);
  group.add(attachBack);
  const attachMainHand = armRight.attachHand;
  const attachOffHand = armLeft.attachHand;

  if (pack) {
    addMesh(THREE, attachBack, new THREE.SphereGeometry(0.28, 12, 10), 0x5c4934, [0, 0.05, -0.02], {
      scale: [1.15, 1.35, 0.7],
      roughness: 0.78
    });
    for (const x of [-0.16, 0.16]) {
      addMesh(THREE, attachBack, new THREE.CapsuleGeometry(0.03, 0.42, 4, 6), 0x302820, [x, 0.08, 0.12], {
        castShadow: false,
        roughness: 0.7
      });
    }
  }

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.48, 18),
    new THREE.MeshBasicMaterial({ color: 0x152018, transparent: true, opacity: 0.28, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  group.add(shadow);

  group.userData.pixel = {
    kind: 'humanoid',
    feature: true,
    stylized: true,
    cartoon: true,
    pack: Boolean(pack),
    eyeL,
    eyeR,
    mouth,
    lowerLip,
    upperLip,
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
    mouth,
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

function lightenColor(hex, amount) {
  const n = Number(hex) || 0;
  const r = Math.min(255, ((n >> 16) & 255) + Math.round(255 * amount));
  const g = Math.min(255, ((n >> 8) & 255) + Math.round(255 * amount));
  const b = Math.min(255, (n & 255) + Math.round(255 * amount));
  return (r << 16) | (g << 8) | b;
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
  const walk = moving ? Math.sin(t * 0.013 * speed) * 0.62 : 0;
  const breathe = Math.sin(t * 0.0026) * 0.018;
  const bounce = moving ? Math.abs(Math.sin(t * 0.013 * speed)) : 0;

  if (!gatherPose) {
    const stride = moving && attack <= 0 ? walk : 0;
    if (rig.legLPivot) rig.legLPivot.rotation.x = stride;
    if (rig.legRPivot) rig.legRPivot.rotation.x = -stride;
    if (rig.kneeL) rig.kneeL.rotation.x = moving ? Math.max(0, -stride) * 1.05 : 0;
    if (rig.kneeR) rig.kneeR.rotation.x = moving ? Math.max(0, stride) * 1.05 : 0;

    if (attack > 0) {
      if (rig.armRPivot) {
        rig.armRPivot.rotation.x = -0.4 - attack * 1.05;
        rig.armRPivot.rotation.z = -0.18 * attack;
      }
      if (rig.armLPivot) {
        rig.armLPivot.rotation.x = -0.6 - attack * 0.4;
        rig.armLPivot.rotation.z = 0.4 * attack;
      }
      if (rig.elbowR) rig.elbowR.rotation.x = 0.25 + attack * 0.9;
      if (rig.elbowL) rig.elbowL.rotation.x = 0.18 + attack * 0.3;
    } else {
      if (rig.armLPivot) {
        rig.armLPivot.rotation.x = -stride * 0.8;
        rig.armLPivot.rotation.z = moving ? Math.sin(t * 0.01) * 0.04 : Math.sin(t * 0.0018) * 0.05;
      }
      if (rig.armRPivot) {
        rig.armRPivot.rotation.x = stride * 0.8;
        rig.armRPivot.rotation.z = moving ? Math.sin(t * 0.01 + 1) * 0.04 : Math.sin(t * 0.0018 + 1) * 0.05;
      }
      if (rig.elbowL) rig.elbowL.rotation.x = moving ? 0.15 + Math.max(0, stride) * 0.4 : 0.12;
      if (rig.elbowR) rig.elbowR.rotation.x = moving ? 0.15 + Math.max(0, -stride) * 0.4 : 0.12;
    }

    rig.legL.rotation.x = stride * 0.08;
    rig.legR.rotation.x = -stride * 0.08;
    if (attack <= 0) {
      rig.armL.rotation.x = -stride * 0.08;
      rig.armR.rotation.x = stride * 0.08;
    }
  }

  // Soft squash/stretch cartoon bounce
  rig.torso.rotation.z = moving ? Math.sin(t * 0.026 * speed) * 0.035 : Math.sin(t * 0.0018) * 0.018;
  if (attack > 0) rig.torso.rotation.z += attack * 0.05;
  rig.torso.position.y = rig.torsoBaseY + (moving ? bounce * 0.045 : breathe);
  if (rig.torso.scale?.set) rig.torso.scale.set(1 + bounce * 0.02, 1 - bounce * 0.03, 1 + bounce * 0.02);
  rig.head.position.y = rig.headBaseY + (moving ? bounce * 0.035 : breathe * 0.7);
  if (attack > 0) rig.head.rotation.x = -0.1 * attack;
  else rig.head.rotation.x = moving ? -0.04 : Math.sin(t * 0.0012) * 0.04;
  rig.hairMesh.position.y = rig.hairBaseY + (rig.head.position.y - rig.headBaseY);
  rig.head.rotation.y = moving || attack > 0 ? Math.sin(t * 0.008) * 0.05 : Math.sin(t * 0.0015) * 0.12;
  if (rig.pelvis) rig.pelvis.position.y = 0.82 + (moving ? bounce * 0.03 : breathe * 0.45);

  // Occasional blink on the whole eye group
  if (pixel?.eyeL?.scale && pixel?.eyeR?.scale) {
    const cycle = (t * 0.001) % 3.6;
    const blink = cycle > 3.35 ? Math.max(0.08, 1 - (cycle - 3.35) * 10) : 1;
    pixel.eyeL.scale.y = blink;
    pixel.eyeR.scale.y = blink;
  }
  // Soft idle mouth smile pulse
  if (pixel?.mouth?.scale) {
    const smile = 1 + Math.sin(t * 0.002) * 0.04;
    pixel.mouth.scale.x = smile;
    pixel.mouth.scale.y = 0.95 + Math.sin(t * 0.0022) * 0.06;
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
