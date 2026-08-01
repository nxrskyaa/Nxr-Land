import * as THREE from 'three';
import { setSoftShadows } from './materials.js';

const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);

function createGeometryLibrary() {
  return {
    wall: box(3.4, 2.25, 2.8), roof: new THREE.ConeGeometry(2.72, 1.95, 4),
    roofCap: new THREE.SphereGeometry(0.26, 10, 8),
    door: box(0.72, 1.25, 0.16), window: box(0.58, 0.58, 0.12),
    post: new THREE.CylinderGeometry(0.1, 0.13, 1.5, 8), plank: box(1.5, 0.14, 0.13),
    stallTop: box(2.3, 0.18, 1.45), stallCounter: box(2, 0.2, 0.7),
    archPost: box(0.35, 2.2, 0.35), archTop: box(3.15, 0.45, 0.55),
    benchSeat: box(1.55, 0.18, 0.55), benchBack: box(1.55, 0.65, 0.15),
    awningRib: new THREE.CylinderGeometry(0.05, 0.05, 1.5, 6),
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
    // Warm wainscot base band for a two-tone cottage look.
    const skirt = mesh(box(3.5, 0.55, 2.9), this.materials.creamShade, [0, 0.42, 0]);
    skirt.scale.set(1, 1, 0.95);
    const roof = mesh(this.geometry.roof, this.materials.roof, [0, 2.85, 0]);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.04, 0.72, 0.86);
    // Rounded ridge cap softens the peak — cozy, hand-modeled feel.
    const ridge = mesh(this.geometry.roofCap, this.materials.roofWarm, [0, 3.82, 0]);
    // Overhanging eave trim under the roofline.
    const eave = mesh(box(3.7, 0.16, 3.05), this.materials.woodWarm, [0, 2.28, 0]);
    eave.scale.set(1, 1, 0.95);
    const door = mesh(this.geometry.door, this.materials.woodWarm, [0, 0.68, 1.38]);
    const doorArch = mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.16, 12, 1, false, 0, Math.PI), this.materials.woodWarm, [0, 1.3, 1.38]);
    doorArch.rotation.z = Math.PI;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), this.materials.yellow);
    knob.position.set(0.22, 0.72, 1.49);
    const windows = [-1.05, 1.05].map((wx) => mesh(this.geometry.window, this.materials.blue, [wx, 1.4, 1.43]));
    const shutters = [];
    [-1.05, 1.05].forEach((wx) => {
      [-0.42, 0.42].forEach((off) => {
        const shutter = mesh(box(0.16, 0.62, 0.1), this.materials.coral, [wx + off, 1.4, 1.45]);
        shutters.push(shutter);
      });
    });
    // Flower box under each window.
    const boxes = [-1.05, 1.05].map((wx) => mesh(box(0.7, 0.16, 0.22), this.materials.woodDark, [wx, 1.0, 1.5]));
    const blooms = [];
    [-1.05, 1.05].forEach((wx) => {
      [-0.2, 0, 0.2].forEach((off, i) => {
        const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), i === 1 ? this.materials.yellow : this.materials.flowerWarm);
        bloom.position.set(wx + off, 1.14, 1.52);
        blooms.push(bloom);
      });
    });
    const chimney = mesh(box(0.45, 1.2, 0.48), this.materials.coral, [1.05, 2.75, -0.45]);
    const chimneyCap = mesh(box(0.58, 0.16, 0.6), this.materials.woodDark, [1.05, 3.4, -0.45]);
    group.add(wall, skirt, eave, roof, ridge, door, doorArch, knob, chimney, chimneyCap, ...windows, ...shutters, ...boxes, ...blooms);
    group.position.set(x, 0, z);
    return setSoftShadows(group);
  }

  marketStall(x, z, color = this.materials.coral) {
    const group = new THREE.Group();
    [-0.85, 0.85].forEach((px) => group.add(mesh(this.geometry.post, this.materials.woodDark, [px, 0.78, -0.45])));
    group.add(mesh(this.geometry.stallCounter, this.materials.woodWarm, [0, 0.8, 0]), mesh(this.geometry.stallTop, color, [0, 1.7, -0.05]));
    // Scalloped striped awning — alternating color + cream ribs for a fair-day feel.
    const valance = mesh(box(2.35, 0.4, 0.18), this.materials.cream, [0, 1.52, 0.64]);
    group.add(valance);
    for (let i = -2; i <= 2; i += 1) {
      const scallop = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.18, 12, 1, false, 0, Math.PI), i % 2 ? color : this.materials.cream);
      scallop.rotation.set(Math.PI / 2, 0, 0);
      scallop.position.set(i * 0.46, 1.34, 0.66);
      group.add(scallop);
    }
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
    [-0.65, 0.65].forEach((px) => {
      const post = mesh(this.geometry.post, this.materials.woodWarm, [px * length / 1.5, 0.5, 0]);
      group.add(post);
      // Rounded post cap.
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), this.materials.woodDark);
      cap.position.set(px * length / 1.5, 1.24, 0);
      group.add(cap);
    });
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
    // Rounded lantern-style caps on the posts.
    [-1.35, 1.35].forEach((px) => {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), this.materials.woodWarm);
      cap.position.set(px, 2.28, 0);
      group.add(cap);
    });
    const top = mesh(this.geometry.archTop, labelColor, [0, 2.15, 0]);
    top.rotation.z = -0.03;
    group.add(top);
    // A gentle rounded crest above the arch.
    const crest = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.5, 16, 1, false, 0, Math.PI), labelColor);
    crest.rotation.set(Math.PI / 2, 0, 0);
    crest.position.set(0, 2.4, 0);
    group.add(crest);
    const lock = mesh(box(0.5, 0.48, 0.22), this.materials.yellow, [0, 1.95, 0.34]);
    group.add(lock);
    group.position.set(x, 0, z);
    return setSoftShadows(group);
  }

  bridge(x, z) {
    const group = new THREE.Group();
    for (let i = -4; i <= 4; i += 1) {
      const plank = mesh(box(0.55, 0.16, 2.5), this.materials.woodWarm, [i * 0.48, 0.42 + Math.cos(i * 0.32) * 0.15, 0]);
      plank.rotation.z = -Math.sin(i * 0.32) * 0.08;
      group.add(plank);
    }
    [-1.15, 1.15].forEach((pz) => {
      const rail = mesh(box(4.6, 0.12, 0.12), this.materials.cream, [0, 0.95, pz]);
      group.add(rail);
      // Rounded end posts on the rails.
      [-2.1, 2.1].forEach((rx) => {
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), this.materials.woodDark);
        knob.position.set(rx, 1.02, pz);
        group.add(knob);
        const support = mesh(this.geometry.post, this.materials.woodDark, [rx, 0.7, pz]);
        support.scale.y = 0.7;
        group.add(support);
      });
    });
    group.position.set(x, 0, z);
    return setSoftShadows(group, false);
  }

  bench(x, z, rotation = 0) {
    const group = new THREE.Group();
    group.add(mesh(this.geometry.benchSeat, this.materials.woodWarm, [0, 0.52, 0]), mesh(this.geometry.benchBack, this.materials.woodWarm, [0, 0.84, -0.25]));
    [-0.55, 0.55].forEach((px) => group.add(mesh(this.geometry.post, this.materials.woodDark, [px, 0.26, 0])));
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    return setSoftShadows(group, false);
  }

  lamp(x, z) {
    const group = new THREE.Group();
    group.add(mesh(new THREE.CylinderGeometry(0.08, 0.13, 1.75, 8), this.materials.woodDark, [0, 0.88, 0]));
    // Little warm lantern housing with a soft glowing core.
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.42, 8), this.materials.woodWarm);
    housing.position.set(0, 1.7, 0);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.24, 8), this.materials.roof);
    cap.position.set(0, 1.98, 0);
    const light = mesh(new THREE.SphereGeometry(0.2, 10, 8), this.materials.lantern, [0, 1.7, 0]);
    group.add(housing, cap, light);
    group.position.set(x, 0, z);
    return group;
  }

  sign(x, z, rotation = 0) {
    const group = new THREE.Group();
    group.add(mesh(this.geometry.post, this.materials.woodDark, [0, 0.7, 0]), mesh(box(1.35, 0.65, 0.18), this.materials.woodWarm, [0, 1.2, 0]));
    // Board face plate for a friendlier painted-wood look.
    const face = mesh(box(1.15, 0.45, 0.08), this.materials.cream, [0, 1.2, 0.12]);
    group.add(face);
    const arrow = mesh(new THREE.ConeGeometry(0.22, 0.5, 3), this.materials.coral, [0.42, 1.2, 0.16]);
    arrow.rotation.z = -Math.PI / 2;
    group.add(arrow);
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    return setSoftShadows(group, false);
  }
}
