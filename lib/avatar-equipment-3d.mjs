// Equipment meshes attach to the stylized humanoid's animated attachment anchors.
// Only player rigs receive these. Procedural geometry only — no remote assets.
import {CHARACTER_LAYER} from './retro-visuals.mjs';

const colorFor = (key) =>
  /iron|steel|plate|mail|armor|armour/.test(key)
    ? 0x8b979c
    : /leather|hide|fur/.test(key)
      ? 0x765039
      : /royal|gold/.test(key)
        ? 0xb39b59
        : /cloth|robe|tunic|shirt/.test(key)
          ? 0x566e80
          : 0x65705a;

function markOnCharacterLayer(root) {
  root?.traverse?.(obj => {
    if (obj?.layers?.set) obj.layers.set(CHARACTER_LAYER);
  });
}

function mesh(T, parent, geometry, color, position, options = {}) {
  const m = new T.Mesh(
    geometry,
    new T.MeshStandardMaterial({
      color,
      roughness: options.metal ? 0.4 : 0.72,
      metalness: options.metal ? 0.68 : 0.04,
      side: T.DoubleSide
    })
  );
  m.position.set(...position);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function clearAttachments(character) {
  const prior = character.userData.avatarAttachments || [];
  for (const { node, meshStart } of prior) {
    if (!node?.children) continue;
    const objects = node.children.slice(meshStart);
    for (const object of objects) {
      node.remove(object);
      object.traverse?.(part => {
        if (part.isMesh) {
          part.geometry?.dispose?.();
          part.material?.dispose?.();
        }
      });
    }
  }
  character.userData.avatarAttachments = [];
}

function wearable(T, root, slot, key, rig, attachments) {
  const c = colorFor(key);
  const metal = /iron|steel|plate|mail/.test(key);
  const attach = attachments || {};

  if (slot === 'head') {
    const parent = attach.head || rig.head;
    const g = new T.Group();
    parent.add(g);
    // Soft cartoon helmet that hugs the oversized head
    mesh(T, g, new T.SphereGeometry(0.44, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), c, [0, 0.02, 0], { metal });
    mesh(T, g, new T.TorusGeometry(0.38, 0.04, 7, 18), c, [0, -0.02, 0.02], { metal }).rotation.x = Math.PI / 2;
    return;
  }
  if (slot === 'chest') {
    const parent = attach.chest || rig.pelvis;
    // Soft rounded tunic/plate — keep it snug so the cartoon face stays readable
    mesh(T, parent, new T.SphereGeometry(0.36, 14, 12), c, [0, 0.0, 0.03], { metal }).scale.set(1.02, 1.05, 0.82);
    for (const side of [-1, 1]) {
      const arm = side < 0 ? rig.armLPivot : rig.armRPivot;
      mesh(T, arm, new T.SphereGeometry(0.15, 10, 8), c, [0, -0.02, 0], { metal }).scale.set(1.2, 0.82, 1.1);
    }
    return;
  }
  if (slot === 'legs') {
    const left = attach.legsL || rig.legLPivot;
    const right = attach.legsR || rig.legRPivot;
    for (const pivot of [left, right]) {
      mesh(T, pivot, new T.CapsuleGeometry(0.12, 0.26, 5, 10), c, [0, 0, 0], { metal });
    }
    return;
  }
  if (slot === 'feet') {
    const left = attach.feetL || rig.legLPivot;
    const right = attach.feetR || rig.legRPivot;
    const useLegacy = !attach.feetL;
    for (const foot of [left, right]) {
      mesh(
        T,
        foot,
        new T.BoxGeometry(0.28, 0.18, 0.38),
        c,
        useLegacy ? [0, -0.72, 0.09] : [0, 0, 0],
        { metal }
      );
    }
    return;
  }
  if (slot === 'back') {
    const parent = attach.back || root;
    if (/cloak|cape/.test(key)) {
      const cloth = mesh(T, parent, new T.ConeGeometry(0.45, 1.25, 9, 1, true), c, attach.back ? [0, -0.2, 0.05] : [0, 1.03, -0.24]);
      cloth.rotation.x = Math.PI;
      cloth.scale.z = 0.42;
    } else {
      // Traveler backpack / satchel
      mesh(T, parent, new T.BoxGeometry(0.58, 0.7, 0.28), c, attach.back ? [0, 0, 0] : [0, 1.32, -0.42]);
      for (const x of [-0.2, 0.2]) {
        mesh(T, parent, new T.BoxGeometry(0.07, 0.58, 0.055), 0x392d24, attach.back ? [x, 0.02, 0.14] : [x, 1.34, -0.24]);
      }
    }
    return;
  }

  const left = slot === 'offHand';
  const handAnchor = left ? attach.offHand || null : attach.mainHand || null;
  const elbow = left ? rig.elbowL : rig.elbowR;
  const hand = handAnchor || new T.Group();
  if (!handAnchor) {
    hand.position.set(0, -0.37, 0.02);
    elbow.add(hand);
  }

  if (/shield|buckler/.test(key)) {
    const shield = mesh(T, hand, new T.SphereGeometry(0.36, 10, 8), c, [0, -0.12, 0.14], { metal });
    shield.scale.set(0.83, 1.2, 0.22);
    mesh(T, hand, new T.SphereGeometry(0.11, 10, 8), 0xbca16d, [0, -0.12, 0.27], { metal: true });
    return;
  }
  if (/bow|crossbow/.test(key)) {
    if (T.CatmullRomCurve3 && T.TubeGeometry && T.Vector3) {
      const curve = new T.CatmullRomCurve3([
        new T.Vector3(0, -0.52, 0),
        new T.Vector3(0.16, -0.25, 0),
        new T.Vector3(0.18, 0, 0),
        new T.Vector3(0.16, 0.25, 0),
        new T.Vector3(0, 0.52, 0)
      ]);
      mesh(T, hand, new T.TubeGeometry(curve, 18, 0.035, 6, false), 0x86552f, [0, 0, 0]);
    } else {
      const wood = mesh(T, hand, new T.TorusGeometry(0.42, 0.035, 6, 20, Math.PI), 0x86552f, [0, 0, 0]);
      wood.rotation.z = Math.PI / 2;
    }
    mesh(T, hand, new T.CylinderGeometry(0.007, 0.007, 1.04, 5), 0xe5d8b1, [0, 0, 0]);
    return;
  }

  const axe = /axe|hatchet/.test(key);
  const hammer = /hammer|mace/.test(key);
  const spear = /spear|staff/.test(key);
  const blade = /sword|knife|dagger/.test(key);
  const length = spear ? 1.35 : blade ? 1.02 : 0.8;
  mesh(
    T,
    hand,
    new T.CylinderGeometry(0.034, 0.04, length, 8),
    axe || hammer ? 0x60442b : blade ? 0x9b9d9b : 0x6d5237,
    [0, -length * 0.16, 0],
    { metal: blade }
  );
  if (axe) mesh(T, hand, new T.BoxGeometry(0.3, 0.23, 0.075), 0x879197, [0.15, -length * 0.47, 0], { metal: true });
  else if (hammer) mesh(T, hand, new T.BoxGeometry(0.3, 0.15, 0.16), 0x9b9c99, [0, -length * 0.5, 0], { metal: true });
  else if (blade) mesh(T, hand, new T.BoxGeometry(0.11, 0.42, 0.034), 0xc3c6c7, [0, -length * 0.6, 0], { metal: true });
  else if (spear) mesh(T, hand, new T.ConeGeometry(0.085, 0.26, 6), 0xadb0ad, [0, -length * 0.6, 0], { metal: true }).rotation.z = Math.PI;
}

export function applyAvatarEquipment(T, character, payload) {
  const rig = character?.userData?.rig;
  if (!rig || !payload?.slots || !Array.isArray(payload.items)) return;
  clearAttachments(character);

  const attachments = character.userData.attachments || {};
  const roots = [
    character,
    rig.head,
    rig.pelvis,
    rig.armLPivot,
    rig.armRPivot,
    rig.legLPivot,
    rig.legRPivot,
    rig.elbowL,
    rig.elbowR,
    attachments.head,
    attachments.chest,
    attachments.back,
    attachments.mainHand,
    attachments.offHand,
    attachments.feetL,
    attachments.feetR,
    attachments.legsL,
    attachments.legsR
  ].filter(Boolean);

  // Hide default pack mesh when a back item is equipped to avoid duplicates.
  const backId = payload.slots.back;
  if (attachments.back && character.userData.pixel?.pack) {
    for (const child of attachments.back.children.slice()) {
      // Leave only equipment-applied children; baseline pack was added at create time.
      // When equipping, we clear from meshStart — baseline pack stays unless we hide it.
    }
  }

  const baseline = roots.map(node => ({ node, meshStart: node.children.length }));
  const owned = new Map(payload.items.filter(item => !item.placed).map(item => [String(item.id), item]));

  // If a backpack is equipped onto attachBack that already has the default pack, remove default pack meshes first.
  if (backId && attachments.back) {
    const defaults = attachments.back.children.slice();
    for (const object of defaults) {
      attachments.back.remove(object);
      object.traverse?.(part => {
        if (part.isMesh) {
          part.geometry?.dispose?.();
          part.material?.dispose?.();
        }
      });
    }
    // Reset baseline for attachBack after clearing default pack
    const idx = baseline.findIndex(entry => entry.node === attachments.back);
    if (idx >= 0) baseline[idx] = { node: attachments.back, meshStart: 0 };
  }

  for (const [slot, id] of Object.entries(payload.slots)) {
    const item = owned.get(String(id));
    if (item) wearable(T, character, slot, String(item.key || ''), rig, attachments);
  }
  // Newly attached gear must share the character overlay layer or it vanishes
  // in the hybrid public/private renderer (environment=0, characters=1).
  for (const { node, meshStart } of baseline) {
    for (const object of node.children.slice(meshStart)) markOnCharacterLayer(object);
  }
  character.userData.avatarAttachments = baseline;
  character.userData.avatarEquipmentLoaded = true;
}
