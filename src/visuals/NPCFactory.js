import * as THREE from 'three';

const LOOKS = Object.freeze({
  mira: { silhouette: 'wide-hat-apron', hair: 0x594037, outfit: 0xd97768, accent: 0xf6d88b },
  tomo: { silhouette: 'tall-cap-satchel', hair: 0x313f4a, outfit: 0x5f91a2, accent: 0xf2ae63 },
  lumi: { silhouette: 'round-hood-glow', hair: 0xe5ddd0, outfit: 0x8a77b8, accent: 0x9ce0c8 },
});

function mesh(geometry, material, { x = 0, y = 0, z = 0 } = {}) {
  const result = new THREE.Mesh(geometry, material);
  result.position.set(x, y, z);
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

function createLabel(definition) {
  if (typeof document === 'undefined' || document.defaultView?.navigator?.userAgent?.includes('jsdom')) return null;
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 112;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.fillStyle = 'rgba(54, 67, 58, .88)';
  context.beginPath();
  context.roundRect(8, 8, 368, 96, 28);
  context.fill();
  context.textAlign = 'center';
  context.fillStyle = '#fff9e9';
  context.font = '700 32px system-ui';
  context.fillText(definition.name, 192, 47);
  context.fillStyle = '#f3cf82';
  context.font = '600 19px system-ui';
  context.fillText(definition.role ?? 'Villager', 192, 79);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const surface = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const label = new THREE.Sprite(surface);
  label.position.y = 3.25;
  label.scale.set(2.75, 0.8, 1);
  label.userData.ownedTexture = texture;
  label.userData.ownedMaterial = surface;
  return label;
}

export class NPCFactory {
  constructor() {
    this.geometries = new Set();
    this.materials = new Set();
    this.textures = new Set();
    this.spriteMaterials = new Set();
    this.disposed = false;
  }

  #geometry(geometry) {
    this.geometries.add(geometry);
    return geometry;
  }

  #material(color, options = {}) {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.82, ...options });
    this.materials.add(material);
    return material;
  }

  create(definition = {}) {
    const look = LOOKS[definition.id] ?? LOOKS.mira;
    const root = new THREE.Group();
    root.name = `NPC ${definition.name ?? definition.id}`;
    root.userData.npcId = definition.id;
    root.userData.silhouette = look.silhouette;
    const skin = this.#material(0xdca47e);
    const hair = this.#material(look.hair);
    const outfit = this.#material(look.outfit);
    const accent = this.#material(look.accent, definition.id === 'lumi' ? { emissive: look.accent, emissiveIntensity: 0.28 } : {});
    const dark = this.#material(0x4d514d);

    root.add(mesh(this.#geometry(new THREE.CylinderGeometry(0.48, 0.62, 1.2, 10)), outfit, { y: 1.05 }));
    root.add(mesh(this.#geometry(new THREE.SphereGeometry(0.48, 12, 8)), skin, { y: 1.9 }));
    const hairCap = mesh(this.#geometry(new THREE.SphereGeometry(0.51, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.62)), hair, { y: 2.03 });
    root.add(hairCap);
    for (const x of [-0.25, 0.25]) root.add(mesh(this.#geometry(new THREE.CapsuleGeometry(0.12, 0.46, 4, 7)), dark, { x, y: 0.33 }));

    if (definition.id === 'mira') {
      root.add(mesh(this.#geometry(new THREE.CylinderGeometry(0.75, 0.75, 0.12, 18)), accent, { y: 2.38 }));
      root.add(mesh(this.#geometry(new THREE.ConeGeometry(0.42, 0.48, 12)), accent, { y: 2.65 }));
      root.add(mesh(this.#geometry(new THREE.BoxGeometry(0.72, 0.72, 0.08)), accent, { y: 1.03, z: 0.58 }));
    } else if (definition.id === 'tomo') {
      root.add(mesh(this.#geometry(new THREE.CylinderGeometry(0.46, 0.5, 0.28, 12)), accent, { y: 2.38 }));
      const satchel = mesh(this.#geometry(new THREE.BoxGeometry(0.55, 0.62, 0.28)), accent, { x: 0.58, y: 1.02 });
      satchel.rotation.z = -0.12;
      root.add(satchel);
      root.scale.y = 1.08;
    } else {
      root.add(mesh(this.#geometry(new THREE.TorusGeometry(0.5, 0.13, 7, 16)), accent, { y: 2.05 }));
      const seed = mesh(this.#geometry(new THREE.IcosahedronGeometry(0.23, 1)), accent, { x: 0.62, y: 1.35 });
      seed.userData.floatSeed = true;
      root.add(seed);
    }

    const label = createLabel(definition);
    if (label) {
      this.textures.add(label.userData.ownedTexture);
      this.spriteMaterials.add(label.userData.ownedMaterial);
      root.add(label);
    }
    const marker = mesh(this.#geometry(new THREE.OctahedronGeometry(0.2, 0)), accent, { y: 3.75 });
    marker.name = 'NPC quest marker';
    marker.visible = false;
    root.userData.questMarker = marker;
    root.add(marker);
    root.scale.setScalar(0.92);
    return root;
  }

  update(root, elapsed = 0) {
    if (!root) return;
    root.position.y = Math.sin(elapsed * 1.8 + (root.userData.npcId?.length ?? 0)) * 0.035;
    root.traverse((child) => {
      if (child.userData.floatSeed) child.position.y = 1.35 + Math.sin(elapsed * 2.4) * 0.1;
    });
    const marker = root.userData.questMarker;
    if (marker) {
      marker.visible = Boolean(root.userData.questRelevant);
      marker.rotation.y = elapsed * 1.8;
      marker.position.y = 3.75 + Math.sin(elapsed * 2.8) * 0.08;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.geometries.forEach((geometry) => geometry.dispose());
    this.materials.forEach((material) => material.dispose());
    this.textures.forEach((texture) => texture.dispose());
    this.spriteMaterials.forEach((material) => material.dispose());
    this.geometries.clear();
    this.materials.clear();
    this.textures.clear();
    this.spriteMaterials.clear();
  }
}
