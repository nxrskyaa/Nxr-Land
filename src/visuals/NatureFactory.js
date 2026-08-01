import * as THREE from 'three';
import { setSoftShadows } from './materials.js';

const GEO = {
  trunk: new THREE.CylinderGeometry(0.18, 0.28, 1.35, 7),
  crown: new THREE.IcosahedronGeometry(0.8, 1),
  crownSmall: new THREE.IcosahedronGeometry(0.58, 1),
  rock: new THREE.DodecahedronGeometry(0.45, 0),
  shrub: new THREE.IcosahedronGeometry(0.38, 1),
  grass: new THREE.ConeGeometry(0.12, 0.45, 4),
  petal: new THREE.SphereGeometry(0.1, 7, 5),
};

export class NatureFactory {
  constructor(materials) {
    this.materials = materials;
    this.swayables = [];
  }

  tree(x, z, scale = 1, tint = false) {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(GEO.trunk, this.materials.woodDark);
    trunk.position.y = 0.68;
    const foliage = new THREE.Group();
    const crown = new THREE.Mesh(GEO.crown, tint ? this.materials.leafLight : this.materials.leaf);
    crown.scale.set(1, 0.92, 1);
    const crown2 = new THREE.Mesh(GEO.crownSmall, this.materials.leafLight);
    crown2.position.set(0.45, 0.12, 0.1);
    foliage.add(crown, crown2);
    foliage.position.y = 1.75;
    group.add(trunk, foliage);
    group.position.set(x, 0, z);
    group.scale.setScalar(scale);
    group.userData.phase = x * 0.37 + z * 0.19;
    this.swayables.push(foliage);
    return setSoftShadows(group);
  }

  rock(x, z, scale = 1) {
    const rock = new THREE.Mesh(GEO.rock, this.materials.stone);
    rock.position.set(x, 0.28 * scale, z);
    rock.scale.set(scale, scale * 0.62, scale * 0.85);
    rock.rotation.set(0.1, x + z, -0.08);
    rock.castShadow = true;
    rock.receiveShadow = true;
    return rock;
  }

  shrub(x, z, scale = 1) {
    const shrub = new THREE.Mesh(GEO.shrub, this.materials.grassDark);
    shrub.position.set(x, 0.3 * scale, z);
    shrub.scale.set(scale, scale * 0.72, scale);
    shrub.castShadow = true;
    return shrub;
  }

  createGrassInstances(points) {
    const mesh = new THREE.InstancedMesh(GEO.grass, this.materials.grassDark, points.length);
    const dummy = new THREE.Object3D();
    points.forEach(([x, z, scale = 1], index) => {
      dummy.position.set(x, 0.18 * scale, z);
      dummy.rotation.y = index * 2.17;
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.castShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }

  createFlowerInstances(points, material = this.materials.flower) {
    const mesh = new THREE.InstancedMesh(GEO.petal, material, points.length);
    const dummy = new THREE.Object3D();
    points.forEach(([x, z, scale = 1], index) => {
      dummy.position.set(x, 0.28 + (index % 3) * 0.025, z);
      dummy.scale.set(scale * 1.4, scale * 0.55, scale);
      dummy.rotation.y = index;
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.castShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }

  update(elapsed) {
    this.swayables.forEach((foliage, index) => {
      foliage.rotation.z = Math.sin(elapsed * 1.05 + index * 0.73) * 0.025;
      foliage.rotation.x = Math.cos(elapsed * 0.8 + index) * 0.012;
    });
  }

  dispose() {
    Object.values(GEO).forEach((geometry) => geometry.dispose());
    this.swayables.length = 0;
  }
}
