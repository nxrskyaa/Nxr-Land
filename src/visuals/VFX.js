import * as THREE from 'three';

export class VFX {
  constructor(scene, materials) {
    this.scene = scene;
    this.materials = materials;
    this.clouds = new THREE.Group();
    this.butterflies = new THREE.Group();
    this.fireflies = new THREE.Group();
    this.waterMeshes = [];
    this.waterMaterials = new Map();
    this.#createClouds();
    this.#createButterflies();
    this.#createFireflies();
    scene.add(this.clouds, this.butterflies, this.fireflies);
  }

  #createClouds() {
    const geometry = new THREE.SphereGeometry(1, 10, 7);
    for (let i = 0; i < 5; i += 1) {
      const cloud = new THREE.Group();
      for (let puff = 0; puff < 4; puff += 1) {
        const part = new THREE.Mesh(geometry, this.materials.white);
        part.scale.set(1.1 + puff * 0.1, 0.45 + (puff % 2) * 0.16, 0.65);
        part.position.set(puff * 0.9, (puff % 2) * 0.28, 0);
        part.castShadow = false;
        cloud.add(part);
      }
      cloud.position.set(-16 + i * 8, 8 + (i % 2) * 1.5, -9 - i * 1.2);
      cloud.scale.setScalar(0.75 + i * 0.05);
      this.clouds.add(cloud);
    }
  }

  #createButterflies() {
    const wing = new THREE.CircleGeometry(0.13, 8, 0, Math.PI);
    for (let i = 0; i < 9; i += 1) {
      const butterfly = new THREE.Group();
      const left = new THREE.Mesh(wing, i % 2 ? this.materials.yellow : this.materials.flower);
      const right = left.clone();
      left.position.x = -0.08;
      right.position.x = 0.08;
      right.rotation.y = Math.PI;
      butterfly.add(left, right);
      butterfly.position.set(-8 + (i * 3.7) % 17, 1.3 + (i % 3) * 0.3, -5 + (i * 2.9) % 13);
      butterfly.userData.base = butterfly.position.clone();
      butterfly.userData.phase = i * 0.77;
      this.butterflies.add(butterfly);
    }
  }

  #createFireflies() {
    const geometry = new THREE.SphereGeometry(0.055, 6, 5);
    for (let i = 0; i < 18; i += 1) {
      const firefly = new THREE.Mesh(geometry, this.materials.glow);
      firefly.position.set(-10 + (i * 4.1) % 21, 0.7 + (i % 5) * 0.33, -8 + (i * 3.3) % 17);
      firefly.userData.base = firefly.position.clone();
      firefly.userData.phase = i * 0.58;
      firefly.scale.setScalar(0.45);
      this.fireflies.add(firefly);
    }
  }

  registerWater(mesh) {
    this.waterMeshes.push(mesh);
    if (!this.waterMaterials.has(mesh.material)) {
      this.waterMaterials.set(mesh.material, {
        baseOpacity: mesh.material.opacity,
        phase: this.waterMaterials.size,
      });
    }
  }

  update(delta, elapsed) {
    this.clouds.children.forEach((cloud, index) => {
      cloud.position.x += delta * (0.22 + index * 0.025);
      if (cloud.position.x > 22) cloud.position.x = -22;
    });
    this.butterflies.children.forEach((butterfly) => {
      const { base, phase } = butterfly.userData;
      butterfly.position.x = base.x + Math.sin(elapsed * 0.65 + phase) * 0.7;
      butterfly.position.y = base.y + Math.sin(elapsed * 1.8 + phase) * 0.25;
      butterfly.rotation.z = Math.sin(elapsed * 9 + phase) * 0.35;
    });
    this.fireflies.children.forEach((firefly) => {
      const { base, phase } = firefly.userData;
      firefly.position.y = base.y + Math.sin(elapsed * 1.2 + phase) * 0.32;
      const pulse = 0.55 + Math.sin(elapsed * 2.5 + phase) * 0.3;
      firefly.scale.setScalar(pulse);
    });
    this.waterMeshes.forEach((water, index) => {
      water.position.y = water.userData.baseY + Math.sin(elapsed * 1.25 + index) * 0.035;
    });
    this.waterMaterials.forEach(({ baseOpacity, phase }, material) => {
      material.opacity = baseOpacity + Math.sin(elapsed * 0.9 + phase) * 0.045;
    });
  }

  dispose() {
    const geometries = new Set();
    [this.clouds, this.butterflies, this.fireflies].forEach((group) => {
      group.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
      });
      group.removeFromParent();
    });
    geometries.forEach((geometry) => geometry.dispose());
    this.waterMeshes.length = 0;
    this.waterMaterials.clear();
  }
}
