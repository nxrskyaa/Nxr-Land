import * as THREE from 'three';

export const PALETTE = Object.freeze({
  sky: 0xbfe3dd,
  fog: 0xcde7dc,
  grass: 0x8fbd78,
  grassLight: 0xb6d88d,
  grassDark: 0x63956a,
  path: 0xe8ce9d,
  pathEdge: 0xcfaa78,
  soil: 0x91634f,
  wood: 0x9d674c,
  woodDark: 0x68473d,
  cream: 0xffedcb,
  peach: 0xe99778,
  coral: 0xd96761,
  roof: 0x855f74,
  blue: 0x67aeba,
  water: 0x6fc4c6,
  waterLight: 0xa4e1d4,
  leaf: 0x5c9968,
  leafLight: 0x83b976,
  flower: 0xf6c5c7,
  yellow: 0xf7cf70,
  stone: 0xa8a59b,
  gate: 0x66566f,
  glow: 0xffe28a,
});

export function createMaterialLibrary() {
  const cache = new Map();
  const standard = (name, color, options = {}) => {
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.82,
      metalness: 0,
      flatShading: true,
      ...options,
    });
    cache.set(name, material);
    return material;
  };
  const glow = new THREE.MeshBasicMaterial({ color: PALETTE.glow, toneMapped: false });
  cache.set('glow', glow);

  const materials = {
    grass: standard('grass', PALETTE.grass),
    grassLight: standard('grassLight', PALETTE.grassLight),
    grassDark: standard('grassDark', PALETTE.grassDark),
    path: standard('path', PALETTE.path),
    pathEdge: standard('pathEdge', PALETTE.pathEdge),
    soil: standard('soil', PALETTE.soil),
    wood: standard('wood', PALETTE.wood),
    woodDark: standard('woodDark', PALETTE.woodDark),
    cream: standard('cream', PALETTE.cream),
    peach: standard('peach', PALETTE.peach),
    coral: standard('coral', PALETTE.coral),
    roof: standard('roof', PALETTE.roof),
    blue: standard('blue', PALETTE.blue),
    water: standard('water', PALETTE.water, { roughness: 0.25, transparent: true, opacity: 0.88 }),
    waterLight: standard('waterLight', PALETTE.waterLight, { roughness: 0.2, transparent: true, opacity: 0.7 }),
    leaf: standard('leaf', PALETTE.leaf),
    leafLight: standard('leafLight', PALETTE.leafLight),
    flower: standard('flower', PALETTE.flower),
    yellow: standard('yellow', PALETTE.yellow),
    stone: standard('stone', PALETTE.stone),
    gate: standard('gate', PALETTE.gate),
    dark: standard('dark', 0x493f48),
    white: standard('white', 0xfff8df),
    glow,
  };

  return {
    ...materials,
    get(name) { return cache.get(name); },
    dispose() { cache.forEach((material) => material.dispose()); },
  };
}

export function setSoftShadows(object) {
  object.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return object;
}
