import * as THREE from 'three';
import { setSoftShadows } from './materials.js';

function createGeometryLibrary() {
  return {
    trunk: new THREE.CylinderGeometry(0.16, 0.3, 1.35, 8),
    crown: new THREE.IcosahedronGeometry(0.82, 1),
    crownMid: new THREE.IcosahedronGeometry(0.66, 1),
    crownSmall: new THREE.IcosahedronGeometry(0.5, 1),
    rock: new THREE.DodecahedronGeometry(0.45, 0),
    pebble: new THREE.DodecahedronGeometry(0.2, 0),
    shrub: new THREE.IcosahedronGeometry(0.4, 1),
    shrubSmall: new THREE.IcosahedronGeometry(0.26, 1),
    grass: new THREE.ConeGeometry(0.11, 0.5, 4),
    petal: new THREE.SphereGeometry(0.1, 7, 5),
    bloom: new THREE.IcosahedronGeometry(0.12, 0),
  };
}

export class NatureFactory {
  constructor(materials) {
    this.materials = materials;
    this.geometry = createGeometryLibrary();
    this.swayables = [];
  }

  tree(x, z, scale = 1, tint = false) {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(this.geometry.trunk, this.materials.woodDark);
    trunk.position.y = 0.68;
    trunk.rotation.z = (x % 2 === 0 ? 1 : -1) * 0.04;
    const foliage = new THREE.Group();
    // Layered rounded canopy — three overlapping lobes for a fuller, cozier silhouette.
    const base = tint ? this.materials.leafLight : this.materials.leaf;
    const crown = new THREE.Mesh(this.geometry.crown, base);
    crown.scale.set(1.05, 0.9, 1.05);
    const crown2 = new THREE.Mesh(this.geometry.crownMid, this.materials.leafLight);
    crown2.position.set(0.42, 0.2, 0.12);
    const crown3 = new THREE.Mesh(this.geometry.crownSmall, this.materials.leafDark);
    crown3.position.set(-0.32, -0.02, -0.28);
    const cap = new THREE.Mesh(this.geometry.crownSmall, tint ? this.materials.leafGold : this.materials.leafLight);
    cap.position.set(0.05, 0.5, 0.02);
    cap.scale.setScalar(0.85);
    foliage.add(crown, crown2, crown3, cap);
    // A scatter of blossoms on tinted trees for gentle color pops.
    if (tint) {
      for (let i = 0; i < 5; i += 1) {
        const angle = (i / 5) * Math.PI * 2 + x;
        const bloom = new THREE.Mesh(this.geometry.bloom, this.materials.blossom);
        bloom.position.set(Math.cos(angle) * 0.75, 0.15 + Math.sin(angle * 1.7) * 0.35, Math.sin(angle) * 0.75);
        foliage.add(bloom);
      }
    }
    foliage.position.y = 1.78;
    group.add(trunk, foliage);
    group.position.set(x, 0, z);
    group.scale.setScalar(scale);
    group.userData.phase = x * 0.37 + z * 0.19;
    this.swayables.push(foliage);
    return setSoftShadows(group);
  }

  rock(x, z, scale = 1) {
    const group = new THREE.Group();
    const rock = new THREE.Mesh(this.geometry.rock, this.materials.stone);
    rock.position.y = 0.28 * scale;
    rock.scale.set(scale, scale * 0.66, scale * 0.9);
    rock.rotation.set(0.12, x + z, -0.08);
    rock.receiveShadow = true;
    group.add(rock);
    // A mossy cap and a little companion pebble for a settled, natural cluster.
    const moss = new THREE.Mesh(this.geometry.pebble, this.materials.grassDark);
    moss.position.set(0.08 * scale, 0.44 * scale, -0.02 * scale);
    moss.scale.set(scale * 1.1, scale * 0.55, scale * 1.1);
    moss.receiveShadow = true;
    const pebble = new THREE.Mesh(this.geometry.pebble, this.materials.stoneWarm);
    pebble.position.set(0.52 * scale, 0.12 * scale, 0.34 * scale);
    pebble.scale.setScalar(scale * 0.7);
    pebble.rotation.set(0.3, x, 0.2);
    pebble.receiveShadow = true;
    group.add(moss, pebble);
    group.position.set(x, 0, z);
    return group;
  }

  shrub(x, z, scale = 1) {
    const group = new THREE.Group();
    const shrub = new THREE.Mesh(this.geometry.shrub, this.materials.grassDark);
    shrub.position.y = 0.3 * scale;
    shrub.scale.set(scale, scale * 0.74, scale);
    const bump = new THREE.Mesh(this.geometry.shrubSmall, this.materials.grass);
    bump.position.set(0.24 * scale, 0.4 * scale, 0.1 * scale);
    bump.scale.setScalar(scale);
    group.add(shrub, bump);
    // Occasional berries for warmth.
    if ((Math.round(x + z)) % 2 === 0) {
      for (let i = 0; i < 3; i += 1) {
        const berry = new THREE.Mesh(this.geometry.bloom, this.materials.flowerWarm);
        berry.position.set((i - 1) * 0.18 * scale, 0.42 * scale, 0.28 * scale);
        berry.scale.setScalar(scale * 0.6);
        group.add(berry);
      }
    }
    group.position.set(x, 0, z);
    setSoftShadows(group, false);
    return group;
  }

  createGrassInstances(points) {
    const mesh = new THREE.InstancedMesh(this.geometry.grass, this.materials.grassDark, points.length);
    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();
    points.forEach(([x, z, scale = 1], index) => {
      dummy.position.set(x, 0.2 * scale, z);
      dummy.rotation.set((index % 3) * 0.05, index * 2.17, (index % 2 ? 1 : -1) * 0.06);
      dummy.scale.set(scale, scale * (1 + (index % 4) * 0.12), scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      // Gentle per-blade color variety between fresh green and gold.
      const blend = (index % 5) / 5;
      tint.setHex(0x5a9153).lerp(new THREE.Color(0xcbd06a), blend * 0.6);
      mesh.setColorAt(index, tint);
    });
    mesh.castShadow = false;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return mesh;
  }

  createFlowerInstances(points, material = this.materials.flower) {
    const mesh = new THREE.InstancedMesh(this.geometry.petal, material, points.length);
    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();
    const palette = [0xf9c1cc, 0xfad06a, 0xc7a6e6, 0xf7a0a6, 0xffffff];
    points.forEach(([x, z, scale = 1], index) => {
      dummy.position.set(x, 0.3 + (index % 3) * 0.03, z);
      dummy.scale.set(scale * 1.5, scale * 0.6, scale * 1.5);
      dummy.rotation.set(0.15, index, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      tint.setHex(palette[index % palette.length]);
      mesh.setColorAt(index, tint);
    });
    mesh.castShadow = false;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return mesh;
  }

  update(elapsed) {
    this.swayables.forEach((foliage, index) => {
      foliage.rotation.z = Math.sin(elapsed * 1.05 + index * 0.73) * 0.03;
      foliage.rotation.x = Math.cos(elapsed * 0.8 + index) * 0.015;
    });
  }

  dispose() {
    this.swayables.length = 0;
  }
}
