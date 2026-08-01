import * as THREE from 'three';
import { createMaterialLibrary, setSoftShadows } from '../visuals/materials.js';
import { NatureFactory } from '../visuals/NatureFactory.js';
import { BuildingFactory } from '../visuals/BuildingFactory.js';
import { VFX } from '../visuals/VFX.js';
import { CropFactory } from '../visuals/CropFactory.js';

export const WORLD_BOUNDS = Object.freeze({ minX: -17, maxX: 17, minZ: -13, maxZ: 13 });
export const FARM_PLOT_POSITIONS = Object.freeze({
  'home-plot-1': Object.freeze({ x: 5.45, y: 0.26, z: 2.9 }),
  'home-plot-2': Object.freeze({ x: 7, y: 0.26, z: 2.9 }),
  'home-plot-3': Object.freeze({ x: 8.55, y: 0.26, z: 2.9 }),
  'home-plot-4': Object.freeze({ x: 5.45, y: 0.26, z: 4.4 }),
  'home-plot-5': Object.freeze({ x: 7, y: 0.26, z: 4.4 }),
  'home-plot-6': Object.freeze({ x: 8.55, y: 0.26, z: 4.4 }),
});
export const WORLD_COLLIDERS = Object.freeze([
  { type: 'circle', x: 0, z: 0, radius: 1.5, id: 'plaza-fountain' },
  { type: 'rect', x: 8.8, z: 7.4, width: 4.1, depth: 3.5, id: 'starter-house' },
  { type: 'rect', x: -10, z: 0.6, width: 2.7, depth: 2, id: 'market-stall-coral' },
  { type: 'rect', x: -7.25, z: 0.1, width: 2.7, depth: 2, id: 'market-stall-blue' },
  { type: 'rect', x: -9.2, z: 4.1, width: 2.7, depth: 2, id: 'market-stall-yellow' },
  { type: 'rect', x: 0.4, z: -7.1, width: 6.4, depth: 2.7, id: 'river-west' },
  { type: 'rect', x: 9.2, z: -7.1, width: 5.1, depth: 2.7, id: 'river-east' },
  { type: 'circle', x: 10.7, z: -8.5, radius: 2.35, id: 'garden-pond' },
  { type: 'rect', x: -12.1, z: -4.6, width: 3.2, depth: 0.8, id: 'mosswood-gate' },
  { type: 'rect', x: -2.6, z: 8.6, width: 3.2, depth: 0.8, id: 'sunmeadow-gate' },
  { type: 'circle', x: -4.2, z: -7.8, radius: 1.25, id: 'heartroot' },
  ...[[-15, 4, 0.55], [-13, 8, 0.6], [-8, 10, 0.5], [3, 11, 0.55], [12, 10, 0.5], [15, 4, 0.58], [15, -3, 0.55], [-15, -1, 0.5], [-10, -9, 0.55], [1, -11, 0.58]]
    .map(([x, z, radius], index) => ({ type: 'circle', x, z, radius, id: `tree-${index + 1}` })),
]);

const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);

function roundedPatch(width, depth, material, x, z, y = 0.12) {
  const geometry = new THREE.CylinderGeometry(1, 1, 0.18, 32);
  const patch = new THREE.Mesh(geometry, material);
  patch.scale.set(width / 2, 1, depth / 2);
  patch.position.set(x, y, z);
  patch.receiveShadow = true;
  return patch;
}

function createLabel(text, accent = '#ef8f75') {
  if (typeof document === 'undefined') return new THREE.Group();
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.fillStyle = 'rgba(55, 63, 54, 0.86)';
  context.beginPath();
  context.roundRect(12, 12, 488, 104, 34);
  context.fill();
  context.fillStyle = accent;
  context.fillRect(36, 91, 80, 7);
  context.fillStyle = '#fff9e9';
  context.font = '700 43px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 256, 61);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false }));
  sprite.scale.set(4.6, 1.15, 1);
  sprite.userData.baseScale = sprite.scale.clone();
  sprite.userData.ownedTexture = texture;
  return sprite;
}

export class World {
  constructor(scene, { state } = {}) {
    this.scene = scene;
    this.state = state;
    this.disposed = false;
    this.landmarks = new Map();
    this.materials = createMaterialLibrary();
    this.nature = new NatureFactory(this.materials);
    this.buildings = new BuildingFactory(this.materials);
    this.root = new THREE.Group();
    this.root.name = 'Nxr Land village';
    scene.add(this.root);
    this.vfx = new VFX(scene, this.materials);
    this.cropFactory = new CropFactory({ scene: this.root, reducedMotion: state?.settings?.controls?.reducedMotion });
    this.plotVisuals = new Map();
    this.#buildTerrain();
    this.#buildPlaza();
    this.#buildHomePlot();
    this.#buildMarketLane();
    this.#buildRiverGarden();
    this.#buildExpansions();
    this.#buildHeartroot();
    this.#scatterDetails();
  }

  #register(name, object, labelPosition) {
    object.name = name;
    this.landmarks.set(name, object);
    this.root.add(object);
    if (labelPosition) {
      const label = createLabel(name);
      label.position.set(...labelPosition);
      label.name = `${name} label`;
      this.root.add(label);
    }
    return object;
  }

  #buildTerrain() {
    const underlay = new THREE.Mesh(new THREE.CylinderGeometry(18.8, 19.7, 2.2, 48), this.materials.pathEdge);
    underlay.position.y = -1.05;
    underlay.scale.z = 0.74;
    underlay.receiveShadow = true;
    const island = new THREE.Mesh(new THREE.CylinderGeometry(18.2, 18.6, 1.3, 48), this.materials.grass);
    island.position.y = -0.34;
    island.scale.z = 0.74;
    island.receiveShadow = true;
    this.root.add(underlay, island);

    const plazaPath = roundedPatch(7.8, 7.8, this.materials.path, 0, 0, 0.1);
    const marketPath = roundedPatch(12, 3.2, this.materials.path, -8.2, 1.8, 0.11);
    marketPath.rotation.y = -0.16;
    const homePath = roundedPatch(4.2, 10, this.materials.path, 6.2, 4.2, 0.105);
    homePath.rotation.y = 0.32;
    this.root.add(plazaPath, marketPath, homePath);
  }

  #buildPlaza() {
    const group = new THREE.Group();
    const center = roundedPatch(5.8, 5.8, this.materials.pathEdge, 0, 0, 0.18);
    group.add(center);
    const fountainBase = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.55, 0.55, 16), this.materials.stone);
    fountainBase.position.y = 0.48;
    const water = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.08, 0.08, 24), this.materials.waterLight);
    water.position.y = 0.79;
    water.userData.baseY = water.position.y;
    const fountainTop = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), this.materials.water);
    fountainTop.position.y = 1.38;
    group.add(fountainBase, water, fountainTop);
    this.vfx.registerWater(water);
    [[-2.2, 1.7, 0.55], [2.15, -1.75, -2.55]].forEach(([x, z, r]) => group.add(this.buildings.bench(x, z, r)));
    [[-2.7, -2.1], [2.6, 2.15]].forEach(([x, z]) => group.add(this.buildings.lamp(x, z)));
    this.#register('Town Plaza', setSoftShadows(group), [0, 3.1, 3.35]);
  }

  #buildHomePlot() {
    const group = new THREE.Group();
    group.add(roundedPatch(8, 8.5, this.materials.grassLight, 8, 5.8, 0.12));
    group.add(this.buildings.starterHouse(8.8, 7.4));
    for (const plot of this.state?.crops?.plots ?? []) {
      const position = FARM_PLOT_POSITIONS[plot.id];
      if (!position) continue;
      const visual = this.cropFactory.create({ plotId: plot.id, position, state: plot.state });
      visual.root.rotation.y = -0.05;
      this.plotVisuals.set(plot.id, visual);
    }
    for (let i = 0; i < 5; i += 1) group.add(this.buildings.fenceSegment(5 + i * 1.45, 1.85));
    group.add(this.buildings.sign(4.5, 5.5, Math.PI / 2));
    this.#register('Home Plot', group, [8.4, 3.8, 9.7]);
  }

  #buildMarketLane() {
    const group = new THREE.Group();
    group.add(roundedPatch(9.7, 5.8, this.materials.grassLight, -8.6, 1.7, 0.12));
    const stallA = this.buildings.marketStall(-10, 0.6, this.materials.coral);
    stallA.rotation.y = 0.18;
    const stallB = this.buildings.marketStall(-7.25, 0.1, this.materials.blue);
    stallB.rotation.y = 0.05;
    const stallC = this.buildings.marketStall(-9.2, 4.1, this.materials.yellow);
    stallC.rotation.y = Math.PI;
    group.add(stallA, stallB, stallC, this.buildings.sign(-5, 2.7, -0.2));
    const crates = [[-11.8, 2.5], [-6.2, 3.6], [-11.2, -1.1]];
    crates.forEach(([x, z], i) => {
      const crate = new THREE.Mesh(box(0.75, 0.7, 0.75), i % 2 ? this.materials.wood : this.materials.peach);
      crate.position.set(x, 0.4, z);
      crate.rotation.y = i * 0.4;
      group.add(crate);
    });
    this.#register('Market Lane', group, [-9, 3.25, 5.1]);
  }

  #buildRiverGarden() {
    const group = new THREE.Group();
    group.add(roundedPatch(11, 7, this.materials.grassLight, 5.8, -7.2, 0.12));
    const river = roundedPatch(13, 2.7, this.materials.water, 5.2, -7.1, 0.26);
    river.rotation.y = 0.12;
    river.userData.baseY = river.position.y;
    group.add(river);
    this.vfx.registerWater(river);
    const pond = roundedPatch(5.1, 4.3, this.materials.waterLight, 10.7, -8.5, 0.28);
    pond.userData.baseY = pond.position.y;
    group.add(pond);
    this.vfx.registerWater(pond);
    const bridge = this.buildings.bridge(4.9, -7.1);
    bridge.rotation.y = Math.PI / 2 + 0.1;
    group.add(bridge);
    [[8.7, -5.2], [11.9, -5.9], [11.8, -10.4], [7.7, -10.1]].forEach(([x, z], i) => group.add(this.nature.shrub(x, z, 0.9 + i * 0.06)));
    [[9.4, -7.2], [10.3, -9], [12.2, -8.3]].forEach(([x, z]) => {
      const lily = new THREE.Mesh(new THREE.CircleGeometry(0.32, 10), this.materials.leafLight);
      lily.rotation.x = -Math.PI / 2;
      lily.position.set(x, 0.39, z);
      group.add(lily);
    });
    this.#register('River Garden', group, [8.8, 3.1, -4.2]);
  }

  #buildExpansions() {
    const west = new THREE.Group();
    west.add(roundedPatch(5.8, 5.2, this.materials.grassDark, -14.2, -6.5, 0.08));
    west.add(this.buildings.expansionGate(-12.1, -4.6));
    west.children[1].rotation.y = -0.65;
    this.#register('Mosswood Gate', west, [-14, 2.9, -4.2]);
    const north = new THREE.Group();
    north.add(roundedPatch(6.2, 4.7, this.materials.grassDark, -2.5, 10.4, 0.08));
    north.add(this.buildings.expansionGate(-2.6, 8.6));
    this.#register('Sunmeadow Gate', north, [-2.6, 3, 11.3]);
  }

  #buildHeartroot() {
    const group = new THREE.Group();
    const mound = roundedPatch(5.2, 4.5, this.materials.grassLight, -4.2, -7.8, 0.18);
    group.add(mound);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.05, 4.3, 9), this.materials.woodDark);
    trunk.position.set(-4.2, 2.15, -7.8);
    trunk.rotation.z = -0.08;
    group.add(trunk);
    const heart = new THREE.Group();
    [-0.65, 0.65].forEach((x) => {
      const lobe = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, 1), this.materials.flower);
      lobe.position.set(-4.2 + x, 4.5, -7.8);
      lobe.scale.set(1, 1.05, 0.85);
      heart.add(lobe);
    });
    const crown = new THREE.Mesh(new THREE.ConeGeometry(1.65, 2.1, 6), this.materials.flower);
    crown.position.set(-4.2, 3.65, -7.8);
    crown.rotation.z = Math.PI;
    heart.add(crown);
    group.add(heart);
    for (let i = 0; i < 7; i += 1) {
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), this.materials.glow);
      const angle = (i / 7) * Math.PI * 2;
      glow.position.set(-4.2 + Math.cos(angle) * 2.05, 1.2 + (i % 3) * 0.35, -7.8 + Math.sin(angle) * 1.65);
      group.add(glow);
    }
    this.#register('Heartroot', setSoftShadows(group), [-4.2, 5.9, -7.8]);
  }

  #scatterDetails() {
    const treePoints = [[-15, 4, 1.2], [-13, 8, 1.3], [-8, 10, 1.05], [3, 11, 1.2], [12, 10, 1], [15, 4, 1.25], [15, -3, 1.15], [-15, -1, 1], [-10, -9, 1.15], [1, -11, 1.25]];
    treePoints.forEach(([x, z, s], i) => this.root.add(this.nature.tree(x, z, s, i % 3 === 0)));
    [[-3.5, 5], [3.8, 5.8], [-5, -1.8], [1.8, -4.2], [13, 1], [-12, 5.7]].forEach(([x, z], i) => this.root.add(this.nature.rock(x, z, 0.45 + (i % 3) * 0.12)));
    const grass = Array.from({ length: 58 }, (_, i) => {
      const angle = i * 2.399;
      const radius = 7 + (i % 9) * 1.05;
      return [Math.cos(angle) * radius, Math.sin(angle) * radius * 0.72, 0.65 + (i % 4) * 0.11];
    });
    this.root.add(this.nature.createGrassInstances(grass));
    const flowers = Array.from({ length: 36 }, (_, i) => [-13 + (i * 4.7) % 26, -9 + (i * 3.1) % 18, 0.7 + (i % 3) * 0.13]);
    this.root.add(this.nature.createFlowerInstances(flowers));
  }

  update(delta, elapsed) {
    this.nature.update(elapsed);
    this.vfx.update(delta, elapsed);
    this.cropFactory.update(delta, elapsed);
  }

  getPlotPositions() {
    return FARM_PLOT_POSITIONS;
  }

  syncFarmingPlots(farmingSystem) {
    for (const [plotId, visual] of this.plotVisuals) {
      const state = farmingSystem?.getVisualState?.(plotId);
      if (!state) continue;
      const data = visual.root?.userData ?? {};
      if (data.state === state.state && data.cropId === state.cropId && data.stageIndex === state.stageIndex) continue;
      this.cropFactory.sync(visual, state);
    }
  }

  burstHarvest(position, color) {
    return this.cropFactory.burstHarvest(position, color);
  }

  setLabelScale(multiplier = 1) {
    this.root.traverse((object) => {
      if (object.isSprite && object.userData.baseScale) {
        object.scale.copy(object.userData.baseScale).multiplyScalar(multiplier);
      }
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.vfx.dispose();
    this.cropFactory.dispose();
    const geometries = new Set();
    const textures = new Set();
    const spriteMaterials = new Set();
    this.root.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.userData.ownedTexture) textures.add(object.userData.ownedTexture);
      if (object.material?.map && object.isSprite) spriteMaterials.add(object.material);
    });
    geometries.forEach((geometry) => geometry.dispose());
    textures.forEach((texture) => texture.dispose());
    spriteMaterials.forEach((material) => material.dispose());
    this.nature.dispose();
    this.materials.dispose();
    this.root.removeFromParent();
    this.landmarks.clear();
    this.plotVisuals.clear();
  }
}
