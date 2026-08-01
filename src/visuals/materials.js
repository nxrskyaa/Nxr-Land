import * as THREE from 'three';

// Warm, hand-painted diorama palette — Stardew / Animal Crossing / Pokopia cozy.
// Greens lean warm and saturated, walls are creamy, roofs terracotta-plum,
// paths sun-baked, water a soft tropical teal.
export const PALETTE = Object.freeze({
  sky: 0xcdeee0,
  fog: 0xdcefdf,
  grass: 0x86c06a,
  grassLight: 0xbfe08a,
  grassDark: 0x5a9153,
  grassGold: 0xd7dd7f,
  path: 0xf0d79f,
  pathEdge: 0xd7ac74,
  soil: 0x9a6647,
  soilDark: 0x744a35,
  wood: 0xb27a51,
  woodDark: 0x7c5238,
  woodWarm: 0xc98f5c,
  cream: 0xfff1d2,
  creamShade: 0xf3dcb0,
  peach: 0xf0a072,
  coral: 0xe57062,
  roof: 0x9b5f74,
  roofWarm: 0xc27466,
  roofBlue: 0x6f9fb8,
  blue: 0x74bcc6,
  water: 0x5fc7cf,
  waterLight: 0xa9ecdc,
  leaf: 0x5aa05f,
  leafLight: 0x8bc972,
  leafDark: 0x3f7a4c,
  leafGold: 0xcbd06a,
  blossom: 0xf7b8cf,
  flower: 0xf9c1cc,
  flowerWarm: 0xf7a0a6,
  flowerViolet: 0xc7a6e6,
  yellow: 0xfad06a,
  stone: 0xb2afa2,
  stoneWarm: 0xc6b8a0,
  gate: 0x7a6484,
  glow: 0xffe28a,
  lantern: 0xffcf87,
});

export function createMaterialLibrary() {
  const cache = new Map();
  let disposed = false;
  const standard = (name, color, options = {}) => {
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.88,
      metalness: 0,
      flatShading: true,
      ...options,
    });
    cache.set(name, material);
    return material;
  };
  const glow = new THREE.MeshBasicMaterial({ color: PALETTE.glow, toneMapped: false });
  cache.set('glow', glow);
  const lantern = new THREE.MeshBasicMaterial({ color: PALETTE.lantern, toneMapped: false });
  cache.set('lantern', lantern);

  const materials = {
    grass: standard('grass', PALETTE.grass, { roughness: 0.95 }),
    grassLight: standard('grassLight', PALETTE.grassLight, { roughness: 0.95 }),
    grassDark: standard('grassDark', PALETTE.grassDark, { roughness: 0.96 }),
    grassGold: standard('grassGold', PALETTE.grassGold, { roughness: 0.95 }),
    path: standard('path', PALETTE.path, { roughness: 0.98 }),
    pathEdge: standard('pathEdge', PALETTE.pathEdge, { roughness: 0.98 }),
    soil: standard('soil', PALETTE.soil, { roughness: 1 }),
    soilDark: standard('soilDark', PALETTE.soilDark, { roughness: 1 }),
    wood: standard('wood', PALETTE.wood, { roughness: 0.9 }),
    woodDark: standard('woodDark', PALETTE.woodDark, { roughness: 0.9 }),
    woodWarm: standard('woodWarm', PALETTE.woodWarm, { roughness: 0.88 }),
    cream: standard('cream', PALETTE.cream, { roughness: 0.85 }),
    creamShade: standard('creamShade', PALETTE.creamShade, { roughness: 0.87 }),
    peach: standard('peach', PALETTE.peach, { roughness: 0.8 }),
    coral: standard('coral', PALETTE.coral, { roughness: 0.78 }),
    roof: standard('roof', PALETTE.roof, { roughness: 0.82 }),
    roofWarm: standard('roofWarm', PALETTE.roofWarm, { roughness: 0.82 }),
    roofBlue: standard('roofBlue', PALETTE.roofBlue, { roughness: 0.82 }),
    blue: standard('blue', PALETTE.blue, { roughness: 0.7 }),
    water: standard('water', PALETTE.water, { roughness: 0.22, transparent: true, opacity: 0.9, flatShading: false }),
    waterLight: standard('waterLight', PALETTE.waterLight, { roughness: 0.16, transparent: true, opacity: 0.72, flatShading: false }),
    leaf: standard('leaf', PALETTE.leaf, { roughness: 0.94 }),
    leafLight: standard('leafLight', PALETTE.leafLight, { roughness: 0.94 }),
    leafDark: standard('leafDark', PALETTE.leafDark, { roughness: 0.95 }),
    leafGold: standard('leafGold', PALETTE.leafGold, { roughness: 0.94 }),
    blossom: standard('blossom', PALETTE.blossom, { roughness: 0.8 }),
    flower: standard('flower', PALETTE.flower, { roughness: 0.8 }),
    flowerWarm: standard('flowerWarm', PALETTE.flowerWarm, { roughness: 0.8 }),
    flowerViolet: standard('flowerViolet', PALETTE.flowerViolet, { roughness: 0.8 }),
    yellow: standard('yellow', PALETTE.yellow, { roughness: 0.72 }),
    stone: standard('stone', PALETTE.stone, { roughness: 0.95 }),
    stoneWarm: standard('stoneWarm', PALETTE.stoneWarm, { roughness: 0.95 }),
    gate: standard('gate', PALETTE.gate, { roughness: 0.85 }),
    dark: standard('dark', 0x4a3f48),
    white: standard('white', 0xfff8df),
    glow,
    lantern,
  };

  return {
    ...materials,
    get(name) { return cache.get(name); },
    dispose() {
      if (disposed) return;
      disposed = true;
      cache.forEach((material) => material.dispose());
    },
  };
}

export function setSoftShadows(object, castShadow = true) {
  object.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = castShadow;
      child.receiveShadow = true;
    }
  });
  return object;
}
