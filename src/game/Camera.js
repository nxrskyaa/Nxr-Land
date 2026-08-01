import * as THREE from 'three';

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

export function clampCameraTarget(target, bounds, framing = { x: 8, z: 6 }) {
  const minX = finite(bounds?.minX, -17) + Math.max(0, finite(framing?.x));
  const maxX = finite(bounds?.maxX, 17) - Math.max(0, finite(framing?.x));
  const minZ = finite(bounds?.minZ, -13) + Math.max(0, finite(framing?.z));
  const maxZ = finite(bounds?.maxZ, 13) - Math.max(0, finite(framing?.z));
  return {
    x: Math.max(Math.min(minX, maxX), Math.min(Math.max(minX, maxX), finite(target?.x))),
    z: Math.max(Math.min(minZ, maxZ), Math.min(Math.max(minZ, maxZ), finite(target?.z))),
  };
}

export function smoothCameraTarget(current, target, delta, responsiveness = 4) {
  if (!Number.isFinite(delta) || delta <= 0) return { x: finite(current?.x), z: finite(current?.z) };
  const alpha = 1 - Math.exp(-Math.max(0, finite(responsiveness, 4)) * Math.min(delta, 0.1));
  return {
    x: finite(current?.x) + (finite(target?.x) - finite(current?.x)) * alpha,
    z: finite(current?.z) + (finite(target?.z) - finite(current?.z)) * alpha,
  };
}

export class CameraController {
  constructor(camera, { bounds, target, framing } = {}) {
    this.camera = camera;
    this.bounds = bounds;
    this.target = target;
    this.framing = framing ?? { x: 8, z: 6 };
    this.offset = camera.position.clone();
    this.look = new THREE.Vector3(0, 0, 0);
    this.current = { x: 0, z: 0 };
  }

  update(delta) {
    if (!this.camera || !this.target) return;
    const desired = clampCameraTarget(this.target, this.bounds, this.framing);
    this.current = smoothCameraTarget(this.current, desired, delta, 3.8);
    this.camera.position.set(
      this.offset.x + this.current.x,
      this.offset.y,
      this.offset.z + this.current.z,
    );
    this.look.set(this.current.x, 0, this.current.z);
    this.camera.lookAt(this.look);
  }

  setFraming(framing) { this.framing = framing; }

  dispose() {
    this.camera = null;
    this.target = null;
  }
}
