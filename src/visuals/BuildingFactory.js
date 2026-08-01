import * as THREE from 'three';
import { setSoftShadows } from './materials.js';

const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);

function createGeometryLibrary() {
  return {
    wall: box(3.4, 2.25, 2.8), roof: new THREE.ConeGeometry(2.65, 1.85, 4),
    door: box(0.72, 1.25, 0.16), window: box(0.58, 0.58, 0.12),
    post: new THREE.CylinderGeometry(0.1, 0.13, 1.5, 7), plank: box(1.5, 0.14, 0.13),
    stallTop: box(2.3, 0.18, 1.45), stallCounter: box(2, 0.2, 0.7),
    archPost: box(0.35, 2.2, 0.35), archTop: box(3.15, 0.45, 0.55),
    benchSeat: box(1.55, 0.18, 0.55), benchBack: box(1.55, 0.65, 0.15),
  };
}

function mesh(geometry, material, position) {
  const value = new THREE.Mesh(geometry, material);
  value.position.set(...position);
  return value;
}

export class BuildingFactory {
  constructor(materials) {
    this.materials = materials;
    this.geometry = createGeometryLibrary();
  }

  starterHouse(x, z) {
    const group = new THREE.Group();
    const wall = mesh(this.geometry.wall, this.materials.cream, [0, 1.15, 0]);
    wall.scale.set(1, 1, 0.95);
    const roof = mesh(this.geometry.roof, this.materials.roof, [0, 2.8, 0]);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1, 0.7, 0.82);
    const door = mesh(this.geometry.door, this.materials.peach, [0, 0.68, 1.38]);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), this.materials.yellow);
    knob.position.set(0.22, 0.72, 1.49);
    const windows = [-1.05, 1.05].map((wx) => mesh(this.geometry.window, this.materials.blue, [wx, 1.35, 1.43]));
    const chimney = mesh(box(0.45, 1.2, 0.48), this.materials.coral, [1.05, 2.7, -0.45]);
    group.add(wall, roof, door, knob, chimney, ...windows);
    group.position.set(x, 0, z);
    return setSoftShadows(group);
  }

  marketStall(x, z, color = this.materials.coral) {
    const group = new THREE.Group();
    [-0.85, 0.85].forEach((px) => group.add(mesh(this.geometry.post, this.materials.woodDark, [px, 0.78, -0.45])));
    group.add(mesh(this.geometry.stallCounter, this.materials.wood, [0, 0.8, 0]), mesh(this.geometry.stallTop, color, [0, 1.7, -0.05]));
    const valance = mesh(box(2.35, 0.38, 0.18), this.materials.cream, [0, 1.52, 0.64]);
    group.add(valance);
    for (let i = -2; i <= 2; i += 1) {
      const produce = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), i % 2 ? this.materials.yellow : this.materials.leafLight);
      produce.position.set(i * 0.32, 1.01, 0.1 + Math.abs(i) * 0.03);
      group.add(produce);
    }
    group.position.set(x, 0, z);
    setSoftShadows(group, false);
    group.children[3].castShadow = true;
    return group;
  }

  fenceSegment(x, z, rotation = 0, length = 1.5) {
    const group = new THREE.Group();
    [-0.65, 0.65].forEach((px) => group.add(mesh(this.geometry.post, this.materials.wood, [px * length / 1.5, 0.5, 0])));
    [0.38, 0.78].forEach((y) => {
      const plank = mesh(this.geometry.plank, this.materials.cream, [0, y, 0]);
      plank.scale.x = length / 1.5;
      group.add(plank);
    });
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    return setSoftShadows(group, false);
  }

  expansionGate(x, z, labelColor = this.materials.gate) {
    const group = new THREE.Group();
    group.add(mesh(this.geometry.archPost, this.materials.gate, [-1.35, 1.1, 0]), mesh(this.geometry.archPost, this.materials.gate, [1.35, 1.1, 0]));
    const top = mesh(this.geometry.archTop, labelColor, [0, 2.15, 0]);
    top.rotation.z = -0.03;
    group.add(top);
    const lock = mesh(box(0.5, 0.48, 0.22), this.materials.yellow, [0, 1.95, 0.34]);
    group.add(lock);
    group.position.set(x, 0, z);
    return setSoftShadows(group);
  }

  bridge(x, z) {
    const group = new THREE.Group();
    for (let i = -4; i <= 4; i += 1) {
      const plank = mesh(box(0.55, 0.16, 2.5), this.materials.wood, [i * 0.48, 0.42 + Math.cos(i * 0.32) * 0.15, 0]);
      plank.rotation.z = -Math.sin(i * 0.32) * 0.08;
      group.add(plank);
    }
    [-1.15, 1.15].forEach((pz) => {
      const rail = mesh(box(4.6, 0.12, 0.12), this.materials.cream, [0, 0.95, pz]);
      group.add(rail);
    });
    group.position.set(x, 0, z);
    return setSoftShadows(group, false);
  }

  bench(x, z, rotation = 0) {
    const group = new THREE.Group();
    group.add(mesh(this.geometry.benchSeat, this.materials.wood, [0, 0.52, 0]), mesh(this.geometry.benchBack, this.materials.wood, [0, 0.84, -0.25]));
    [-0.55, 0.55].forEach((px) => group.add(mesh(this.geometry.post, this.materials.woodDark, [px, 0.26, 0])));
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    return setSoftShadows(group, false);
  }

  lamp(x, z) {
    const group = new THREE.Group();
    group.add(mesh(new THREE.CylinderGeometry(0.08, 0.13, 1.75, 8), this.materials.woodDark, [0, 0.88, 0]));
    const light = mesh(new THREE.SphereGeometry(0.24, 10, 8), this.materials.glow, [0, 1.78, 0]);
    group.add(light);
    group.position.set(x, 0, z);
    return group;
  }

  sign(x, z, rotation = 0) {
    const group = new THREE.Group();
    group.add(mesh(this.geometry.post, this.materials.woodDark, [0, 0.7, 0]), mesh(box(1.35, 0.65, 0.18), this.materials.yellow, [0, 1.2, 0]));
    const arrow = mesh(new THREE.ConeGeometry(0.22, 0.5, 3), this.materials.coral, [0.42, 1.2, 0.12]);
    arrow.rotation.z = -Math.PI / 2;
    group.add(arrow);
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    return setSoftShadows(group, false);
  }
}
