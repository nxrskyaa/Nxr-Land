import * as THREE from 'three';

export const CHARACTER_OPTIONS = Object.freeze({
  skinTones: [
    { value: '#f3c6a5', label: 'Peach' },
    { value: '#d99b72', label: 'Honey' },
    { value: '#aa6f50', label: 'Amber' },
    { value: '#704534', label: 'Cocoa' },
  ],
  hairStyles: [
    { value: 'meadow-bob', label: 'Meadow bob' },
    { value: 'soft-curls', label: 'Soft curls' },
    { value: 'leafy-pixie', label: 'Leafy pixie' },
    { value: 'twin-buns', label: 'Twin buns' },
  ],
  hairColors: [
    { value: '#49352f', label: 'Chestnut' },
    { value: '#7b4d35', label: 'Auburn' },
    { value: '#e1b978', label: 'Golden' },
    { value: '#364357', label: 'Midnight' },
    { value: '#8f6688', label: 'Lavender' },
  ],
  tops: [
    { value: '#dc786b', label: 'Coral tee' },
    { value: '#6ca7a5', label: 'Pond blue' },
    { value: '#e2ad55', label: 'Sunflower' },
    { value: '#806e9d', label: 'Berry knit' },
  ],
  bottoms: [
    { value: '#536f72', label: 'Garden shorts' },
    { value: '#765c76', label: 'Plum skirt' },
    { value: '#8d684d', label: 'Work trousers' },
    { value: '#547d62', label: 'Fern overalls' },
  ],
  shoes: [
    { value: '#5a4038', label: 'Cocoa boots' },
    { value: '#31586b', label: 'Rain boots' },
    { value: '#8b4f55', label: 'Berry shoes' },
    { value: '#65734b', label: 'Moss clogs' },
  ],
  accessories: [
    { value: 'none', label: 'None' },
    { value: 'leaf-pin', label: 'Leaf pin' },
    { value: 'flower-clip', label: 'Flower clip' },
    { value: 'round-glasses', label: 'Round glasses' },
  ],
});

export const DEFAULT_APPEARANCE = Object.freeze({
  skinTone: '#d99b72',
  hairStyle: 'meadow-bob',
  hairColor: '#49352f',
  top: '#dc786b',
  bottom: '#536f72',
  shoes: '#5a4038',
  accessory: 'leaf-pin',
});

const OPTION_KEYS = Object.freeze({
  skinTone: 'skinTones',
  hairStyle: 'hairStyles',
  hairColor: 'hairColors',
  top: 'tops',
  bottom: 'bottoms',
  shoes: 'shoes',
  accessory: 'accessories',
});

function catalogValue(key, value) {
  const options = CHARACTER_OPTIONS[OPTION_KEYS[key]];
  return options.some((option) => option.value === value) ? value : DEFAULT_APPEARANCE[key];
}

function normalizeStyle(style = '') {
  const clean = String(style).replace('wardrobe-hair-', '');
  return catalogValue('hairStyle', clean);
}

export function normalizeAppearance(appearance = {}) {
  return {
    skinTone: catalogValue('skinTone', appearance.skinTone),
    hairStyle: normalizeStyle(appearance.hairStyle),
    hairColor: catalogValue('hairColor', appearance.hairColor),
    top: catalogValue('top', appearance.top),
    bottom: catalogValue('bottom', appearance.bottom),
    shoes: catalogValue('shoes', appearance.shoes),
    accessory: catalogValue('accessory', appearance.accessory),
  };
}

export class CharacterFactory {
  constructor() {
    this.materials = new Map();
    this.geometries = {
      head: new THREE.SphereGeometry(0.63, 18, 14),
      body: new THREE.CapsuleGeometry(0.38, 0.52, 5, 12),
      limb: new THREE.CapsuleGeometry(0.105, 0.48, 4, 8),
      leg: new THREE.CapsuleGeometry(0.13, 0.43, 4, 8),
      shoe: new THREE.SphereGeometry(0.18, 10, 7),
      eye: new THREE.SphereGeometry(0.045, 8, 6),
      hairCap: new THREE.SphereGeometry(0.665, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.64),
      curl: new THREE.SphereGeometry(0.19, 10, 8),
      bun: new THREE.SphereGeometry(0.27, 12, 9),
      leaf: new THREE.ConeGeometry(0.11, 0.28, 5),
      collar: new THREE.TorusGeometry(0.28, 0.035, 6, 16, Math.PI),
      glassesRim: new THREE.TorusGeometry(0.16, 0.025, 6, 18),
      glassesBridge: new THREE.BoxGeometry(0.16, 0.025, 0.025),
    };
    this.characters = new Set();
    this.disposed = false;
  }

  #material(color, roughness = 0.82) {
    const key = `${color}:${roughness}`;
    if (!this.materials.has(key)) {
      this.materials.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, flatShading: true }));
    }
    return this.materials.get(key);
  }

  #mesh(geometry, material, name) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.receiveShadow = true;
    return mesh;
  }

  create(appearance = {}) {
    if (this.disposed) throw new Error('CharacterFactory has been disposed');
    const character = new THREE.Group();
    character.name = 'Player character';
    character.userData.character = true;
    this.characters.add(character);
    this.updateAppearance(character, appearance);
    return character;
  }

  updateAppearance(character, appearance = {}) {
    if (!character || this.disposed) return;
    character.clear();
    const look = normalizeAppearance(appearance);
    character.userData.appearance = look;
    const skin = this.#material(look.skinTone);
    const hair = this.#material(look.hairColor);
    const top = this.#material(look.top);
    const bottom = this.#material(look.bottom);
    const shoes = this.#material(look.shoes);
    const dark = this.#material('#3c3438', 0.65);
    const blush = this.#material('#d97f78');
    const leaf = this.#material('#6f9b68');

    const body = this.#mesh(this.geometries.body, top, 'Body');
    body.position.y = 1.05;
    body.scale.set(1, 0.95, 0.92);
    body.castShadow = true;

    const head = this.#mesh(this.geometries.head, skin, 'Head');
    head.position.y = 1.93;
    head.scale.set(1, 1.04, 0.96);
    head.castShadow = true;

    const collar = this.#mesh(this.geometries.collar, this.#material('#fff1d2'), 'Collar');
    collar.position.set(0, 1.42, 0.28);
    collar.rotation.set(Math.PI / 2, 0, Math.PI);

    const eyes = [-0.21, 0.21].map((x) => {
      const eye = this.#mesh(this.geometries.eye, dark, 'Eye');
      eye.position.set(x, 2, 0.565);
      eye.scale.set(0.85, 1.2, 0.55);
      return eye;
    });
    const cheeks = [-0.34, 0.34].map((x) => {
      const cheek = this.#mesh(this.geometries.eye, blush, 'Cheek');
      cheek.position.set(x, 1.84, 0.55);
      cheek.scale.set(1.25, 0.48, 0.3);
      return cheek;
    });

    const leftArm = this.#limbPivot(-0.47, 1.2, skin, top, 'Left arm');
    const rightArm = this.#limbPivot(0.47, 1.2, skin, top, 'Right arm');
    const leftLeg = this.#legPivot(-0.2, 0.62, bottom, shoes, 'Left leg');
    const rightLeg = this.#legPivot(0.2, 0.62, bottom, shoes, 'Right leg');

    const hairGroup = this.#hair(look.hairStyle, hair);
    hairGroup.position.y = 1.93;
    hairGroup.name = 'Hair';
    hairGroup.children[0].castShadow = true;

    character.add(body, head, collar, ...eyes, ...cheeks, leftArm, rightArm, leftLeg, rightLeg, hairGroup);
    this.#accessory(look.accessory, character, { dark, leaf });
    character.userData.parts = { body, head, leftArm, rightArm, leftLeg, rightLeg };
  }

  #accessory(accessory, character, { dark, leaf }) {
    if (accessory === 'leaf-pin') {
      const pin = this.#mesh(this.geometries.leaf, leaf, 'Leaf pin');
      pin.position.set(0.38, 2.32, 0.45);
      pin.rotation.set(1.2, 0.25, -0.7);
      character.add(pin);
    } else if (accessory === 'flower-clip') {
      const petals = this.#material('#e9878a');
      const center = this.#mesh(this.geometries.eye, this.#material('#f4c85f'), 'Flower center');
      center.position.set(0.43, 2.35, 0.5);
      center.scale.setScalar(1.3);
      character.add(center);
      for (let index = 0; index < 5; index += 1) {
        const angle = (index / 5) * Math.PI * 2;
        const petal = this.#mesh(this.geometries.curl, petals, index === 0 ? 'Flower clip' : 'Flower petal');
        petal.position.set(0.43 + Math.cos(angle) * 0.12, 2.35 + Math.sin(angle) * 0.12, 0.475);
        petal.scale.set(0.48, 0.72, 0.28);
        character.add(petal);
      }
    } else if (accessory === 'round-glasses') {
      [-0.21, 0.21].forEach((x, index) => {
        const rim = this.#mesh(this.geometries.glassesRim, dark, index === 0 ? 'Left glasses rim' : 'Right glasses rim');
        rim.position.set(x, 2, 0.61);
        character.add(rim);
      });
      const bridge = this.#mesh(this.geometries.glassesBridge, dark, 'Glasses bridge');
      bridge.position.set(0, 2, 0.61);
      character.add(bridge);
    }
  }

  #limbPivot(x, y, skin, sleeve, name) {
    const pivot = new THREE.Group();
    pivot.name = name;
    pivot.position.set(x, y, 0);
    const arm = this.#mesh(this.geometries.limb, skin, `${name} skin`);
    arm.position.y = -0.3;
    const cap = this.#mesh(this.geometries.shoe, sleeve, `${name} sleeve`);
    cap.position.y = -0.02;
    cap.scale.set(0.9, 0.75, 0.9);
    pivot.add(arm, cap);
    return pivot;
  }

  #legPivot(x, y, bottom, shoes, name) {
    const pivot = new THREE.Group();
    pivot.name = name;
    pivot.position.set(x, y, 0);
    const leg = this.#mesh(this.geometries.leg, bottom, `${name} fabric`);
    leg.position.y = -0.28;
    const shoe = this.#mesh(this.geometries.shoe, shoes, `${name} shoe`);
    shoe.position.set(0, -0.59, 0.08);
    shoe.scale.set(1, 0.65, 1.35);
    pivot.add(leg, shoe);
    return pivot;
  }

  #hair(style, material) {
    const group = new THREE.Group();
    const cap = this.#mesh(this.geometries.hairCap, material, 'Hair cap');
    cap.rotation.x = -0.08;
    group.add(cap);
    if (style === 'soft-curls') {
      [-0.52, -0.31, 0.31, 0.52].forEach((x, index) => {
        const curl = this.#mesh(this.geometries.curl, material, 'Curl');
        curl.position.set(x, 0.05 - (index % 2) * 0.2, index % 2 ? 0.22 : 0.05);
        group.add(curl);
      });
    } else if (style === 'leafy-pixie') {
      [-0.38, -0.14, 0.12, 0.36].forEach((x, index) => {
        const tuft = this.#mesh(this.geometries.leaf, material, 'Pixie tuft');
        tuft.position.set(x, 0.48 + (index % 2) * 0.09, 0.2);
        tuft.rotation.z = (index - 1.5) * 0.35;
        group.add(tuft);
      });
    } else if (style === 'twin-buns') {
      [-0.55, 0.55].forEach((x) => {
        const bun = this.#mesh(this.geometries.bun, material, 'Hair bun');
        bun.position.set(x, 0.35, 0);
        group.add(bun);
      });
    } else {
      [-0.52, 0.52].forEach((x) => {
        const side = this.#mesh(this.geometries.curl, material, 'Bob side');
        side.position.set(x, -0.08, 0.08);
        side.scale.set(0.85, 1.55, 0.9);
        group.add(side);
      });
    }
    return group;
  }

  animate(character, elapsed, speed = 0) {
    const parts = character?.userData?.parts;
    if (!parts) return;
    const moving = Math.min(1, Math.max(0, Number.isFinite(speed) ? speed / 3 : 0));
    const phase = elapsed * (4 + moving * 7);
    const stride = Math.sin(phase) * 0.62 * moving;
    parts.leftLeg.rotation.x = stride;
    parts.rightLeg.rotation.x = -stride;
    parts.leftArm.rotation.x = -stride * 0.72;
    parts.rightArm.rotation.x = stride * 0.72;
    parts.body.scale.y = 0.95 + Math.sin(elapsed * 2.2) * 0.012 + Math.abs(Math.sin(phase)) * 0.025 * moving;
    parts.head.position.y = 1.93 + Math.sin(elapsed * 2.2) * 0.012 + Math.abs(Math.sin(phase)) * 0.035 * moving;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.characters.forEach((character) => character.clear());
    this.characters.clear();
    Object.values(this.geometries).forEach((geometry) => geometry.dispose());
    this.materials.forEach((material) => material.dispose());
    this.materials.clear();
  }
}
