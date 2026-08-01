import * as THREE from 'three';
import { PET_BY_ID } from '../data/pets.js';

export function followTarget(position, target, smoothing = 0.12, distance = 1.35) {
  const dx = position.x - target.x;
  const dz = position.z - target.z;
  const length = Math.hypot(dx, dz) || 1;
  const desired = { x: target.x + (dx / length) * distance, z: target.z + (dz / length) * distance };
  const amount = Math.min(1, Math.max(0, smoothing));
  return { x: position.x + (desired.x - position.x) * amount, y: target.y ?? 0, z: position.z + (desired.z - position.z) * amount };
}

export class Pet {
  constructor({ scene, petId, position = { x: 0, y: 0, z: 0 } } = {}) {
    const definition = PET_BY_ID[petId];
    if (!definition) throw new Error(`Unknown pet: ${petId}`);
    this.definition = definition;
    this.position = { x: position.x, y: position.y ?? 0, z: position.z };
    this.root = new THREE.Group();
    this.root.name = `Pet ${definition.name}`;
    const material = new THREE.MeshStandardMaterial({ color: definition.palette.primary, roughness: 0.8 });
    const accent = new THREE.MeshStandardMaterial({ color: definition.palette.accent, roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 8), material);
    body.scale.y = 0.8;
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), accent);
    nose.position.set(0, 0.05, 0.35);
    this.root.add(body, nose);
    this.root.position.set(this.position.x, this.position.y + 0.42, this.position.z);
    scene?.add(this.root);
  }

  update(delta, target) {
    const next = followTarget(this.position, target, Math.min(1, Math.max(0.04, delta * 5)));
    this.position = next;
    this.root.position.set(next.x, next.y + 0.42 + Math.sin((performance.now?.() ?? 0) / 300) * 0.025, next.z);
    return this.position;
  }

  dispose() {
    this.root?.traverse((child) => { child.geometry?.dispose?.(); child.material?.dispose?.(); });
    this.root?.removeFromParent();
    this.root = null;
  }
}
