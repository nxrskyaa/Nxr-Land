import * as THREE from 'three';

export class Crop {
  constructor({ root, soil, plant, plotId, cropId = null } = {}) {
    this.root = root ?? new THREE.Group();
    this.soil = soil ?? null;
    this.plant = plant ?? null;
    this.plotId = plotId;
    this.cropId = cropId;
    this.disposed = false;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.root?.removeFromParent();
    this.root?.clear();
    this.root = null;
    this.soil = null;
    this.plant = null;
  }
}
