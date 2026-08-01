import * as THREE from 'three';
import { CROP_BY_ID } from '../data/crops.js';
import { Crop } from '../entities/Crop.js';

const DRY_SOIL = '#76523b';
const MOIST_SOIL = '#493b35';

export class CropFactory {
  constructor({ scene, reducedMotion = false } = {}) {
    this.scene = scene;
    this.reducedMotion = Boolean(reducedMotion);
    this.colors = { drySoil: DRY_SOIL, moistSoil: MOIST_SOIL };
    this.geometries = new Map();
    this.materials = new Map();
    this.crops = new Set();
    this.bursts = new Set();
    this.effectsRoot = new THREE.Group();
    this.effectsRoot.name = 'Farming harvest effects';
    scene?.add(this.effectsRoot);
    this.disposed = false;
  }

  #geometry(key, create) {
    if (!this.geometries.has(key)) this.geometries.set(key, create());
    return this.geometries.get(key);
  }

  #material(color, options = {}) {
    const key = `${color}:${options.emissive ?? ''}:${options.transparent ?? false}`;
    if (!this.materials.has(key)) {
      this.materials.set(key, new THREE.MeshStandardMaterial({
        color,
        roughness: 0.82,
        flatShading: true,
        transparent: options.transparent ?? false,
        opacity: options.opacity ?? 1,
        emissive: options.emissive ?? 0x000000,
        emissiveIntensity: options.emissiveIntensity ?? 0,
      }));
    }
    return this.materials.get(key);
  }

  #mesh(geometry, material, name) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  create({ plotId, cropId = null, stageIndex = -1, state = 'empty', position = {} } = {}) {
    if (this.disposed) throw new Error('CropFactory has been disposed');
    const root = new THREE.Group();
    root.name = `Garden plot ${plotId}`;
    root.position.set(position.x ?? 0, position.y ?? 0.25, position.z ?? 0);
    const soil = this.#mesh(
      this.#geometry('soil', () => new THREE.BoxGeometry(1.35, 0.18, 1.25)),
      this.#material(this.#isMoist(state) ? MOIST_SOIL : DRY_SOIL),
      'Plot soil',
    );
    const plant = new THREE.Group();
    plant.name = 'Crop plant';
    root.add(soil, plant);
    const crop = new Crop({ root, soil, plant, plotId, cropId });
    this.crops.add(crop);
    this.sync(crop, { cropId, stageIndex, state });
    this.scene?.add(root);
    return crop;
  }

  #isMoist(state) {
    return ['watered', 'growing', 'harvestable'].includes(state);
  }

  sync(crop, { cropId = null, stageIndex = -1, state = 'empty' } = {}) {
    if (!crop?.root || this.disposed) return crop;
    crop.cropId = cropId;
    crop.root.userData.cropId = cropId;
    crop.root.userData.state = state;
    crop.root.userData.stageIndex = stageIndex;
    crop.soil.material = this.#material(this.#isMoist(state) ? MOIST_SOIL : DRY_SOIL);
    crop.plant.clear();
    const definition = CROP_BY_ID[cropId];
    if (!definition || stageIndex < 0 || !['planted', 'watered', 'growing', 'harvestable'].includes(state)) {
      crop.root.userData.form = null;
      return crop;
    }
    crop.root.userData.form = definition.form.crop;
    this.#buildPlant(crop.plant, definition, Math.min(stageIndex, definition.stages.length - 1));
    return crop;
  }

  #buildPlant(group, crop, stageIndex) {
    const maturity = (stageIndex + 1) / crop.stages.length;
    const stemHeight = Math.max(0.08, crop.form.height * maturity);
    const leafMaterial = this.#material(crop.colors.leaf);
    const accentMaterial = this.#material(crop.colors.accent);
    const cropMaterial = this.#material(crop.colors.crop, crop.id === 'sunflower' ? {
      emissive: crop.colors.crop, emissiveIntensity: 0.12,
    } : {});
    const stem = this.#mesh(
      this.#geometry('stem', () => new THREE.CylinderGeometry(0.045, 0.065, 1, 6)),
      leafMaterial,
      'Stem',
    );
    stem.scale.y = stemHeight;
    stem.position.y = 0.14 + stemHeight / 2;
    group.add(stem);

    const leafCount = Math.max(1, Math.min(crop.form.leaves ?? 3, 2 + stageIndex));
    for (let index = 0; index < leafCount; index += 1) {
      const leaf = this.#mesh(
        this.#geometry('leaf', () => new THREE.SphereGeometry(0.16, 7, 5)),
        leafMaterial,
        'Leaf',
      );
      const angle = (index / leafCount) * Math.PI * 2;
      leaf.scale.set(1.35 * maturity, 0.32, 0.65 * maturity);
      leaf.rotation.y = angle;
      leaf.rotation.z = 0.25;
      leaf.position.set(Math.cos(angle) * 0.14 * maturity, 0.2 + index * 0.06, Math.sin(angle) * 0.14 * maturity);
      group.add(leaf);
    }
    if (stageIndex < crop.stages.length - 1) return;

    const top = 0.18 + stemHeight;
    if (crop.form.crop === 'round') {
      const fruit = this.#mesh(this.#geometry('round', () => new THREE.SphereGeometry(0.27, 10, 7)), cropMaterial, 'Ripe turnip');
      fruit.scale.y = 0.9; fruit.position.y = 0.18; group.add(fruit);
    } else if (crop.form.crop === 'tapered') {
      const fruit = this.#mesh(this.#geometry('tapered', () => new THREE.ConeGeometry(0.2, 0.55, 9)), cropMaterial, 'Ripe carrot');
      fruit.rotation.z = Math.PI; fruit.position.y = 0.04; group.add(fruit);
    } else if (crop.form.crop === 'cluster') {
      for (let index = 0; index < (crop.form.fruitCount ?? 3); index += 1) {
        const fruit = this.#mesh(this.#geometry('berry', () => new THREE.SphereGeometry(0.14, 8, 6)), cropMaterial, 'Tomato fruit');
        fruit.position.set((index - 1) * 0.22, top - 0.18 - (index % 2) * 0.13, 0.08 + (index % 2) * 0.1); group.add(fruit);
      }
    } else if (crop.form.crop === 'heart') {
      [-0.13, 0.13].forEach((x) => {
        const lobe = this.#mesh(this.#geometry('heart-lobe', () => new THREE.SphereGeometry(0.17, 8, 6)), cropMaterial, 'Strawberry lobe');
        lobe.position.set(x, top - 0.12, 0); lobe.scale.y = 1.2; group.add(lobe);
      });
      const tip = this.#mesh(this.#geometry('heart-tip', () => new THREE.ConeGeometry(0.25, 0.34, 8)), cropMaterial, 'Strawberry tip');
      tip.rotation.z = Math.PI; tip.position.y = top - 0.35; group.add(tip);
    } else if (crop.form.crop === 'ribbed') {
      for (let index = 0; index < 3; index += 1) {
        const rib = this.#mesh(this.#geometry('pumpkin-rib', () => new THREE.SphereGeometry(0.28, 9, 6)), cropMaterial, 'Pumpkin rib');
        rib.position.set((index - 1) * 0.18, 0.25, 0); rib.scale.set(0.8, 0.75, 1); group.add(rib);
      }
    } else if (crop.form.crop === 'flower') {
      const center = this.#mesh(this.#geometry('flower-center', () => new THREE.SphereGeometry(0.2, 9, 6)), accentMaterial, 'Sunflower center');
      center.position.set(0, top, 0.05); group.add(center);
      for (let index = 0; index < (crop.form.petals ?? 12); index += 1) {
        const angle = (index / crop.form.petals) * Math.PI * 2;
        const petal = this.#mesh(this.#geometry('petal', () => new THREE.SphereGeometry(0.14, 7, 5)), cropMaterial, 'Sunflower petal');
        petal.scale.set(1.45, 0.46, 0.35); petal.position.set(Math.cos(angle) * 0.3, top + Math.sin(angle) * 0.3, 0);
        petal.rotation.z = angle; group.add(petal);
      }
    }
  }

  burstHarvest(position = {}, color = '#f6c84f') {
    if (this.disposed) return null;
    const burst = new THREE.Group();
    burst.name = 'Harvest particle burst';
    burst.position.set(position.x ?? 0, (position.y ?? 0) + 0.35, position.z ?? 0);
    burst.userData.age = 0;
    const count = this.reducedMotion ? 4 : 10;
    for (let index = 0; index < count; index += 1) {
      const particle = this.#mesh(
        this.#geometry('particle', () => new THREE.SphereGeometry(0.055, 5, 4)),
        this.#material(color),
        'Harvest sparkle',
      );
      const angle = (index / count) * Math.PI * 2;
      particle.userData.velocity = new THREE.Vector3(Math.cos(angle) * 0.75, 0.65 + (index % 3) * 0.18, Math.sin(angle) * 0.75);
      burst.add(particle);
    }
    this.effectsRoot.add(burst);
    this.bursts.add(burst);
    return burst;
  }

  update(delta, elapsed) {
    if (this.disposed) return;
    if (!this.reducedMotion) {
      this.crops.forEach((crop) => {
        if (crop.plant) crop.plant.rotation.z = Math.sin(elapsed * 1.9 + crop.root.position.x) * 0.035;
      });
    }
    for (const burst of [...this.bursts]) {
      burst.userData.age += Math.max(0, Number.isFinite(delta) ? delta : 0);
      burst.children.forEach((particle) => {
        particle.position.addScaledVector(particle.userData.velocity, delta);
        particle.userData.velocity.y -= delta * 1.8;
        particle.scale.setScalar(Math.max(0.01, 1 - burst.userData.age));
      });
      if (burst.userData.age >= 0.8) {
        burst.removeFromParent();
        this.bursts.delete(burst);
      }
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.crops.forEach((crop) => crop.dispose());
    this.crops.clear();
    this.bursts.forEach((burst) => burst.removeFromParent());
    this.bursts.clear();
    this.effectsRoot.removeFromParent();
    this.effectsRoot.clear();
    this.geometries.forEach((geometry) => geometry.dispose());
    this.materials.forEach((material) => material.dispose());
    this.geometries.clear();
    this.materials.clear();
  }
}
