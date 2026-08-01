const DEFAULT_BOUNDS = Object.freeze({ minX: -17, maxX: 17, minZ: -13, maxZ: 13 });
const EPSILON = 1e-6;

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function safeRadius(radius) {
  return Math.max(0, finite(radius));
}

function intersects(position, radius, collider) {
  if (!collider || !Number.isFinite(collider.x) || !Number.isFinite(collider.z)) return false;
  if (collider.type === 'circle') {
    const combined = safeRadius(collider.radius) + radius;
    return Math.hypot(position.x - collider.x, position.z - collider.z) < combined - EPSILON;
  }
  if (collider.type === 'rect') {
    const halfWidth = Math.max(0, finite(collider.width)) / 2;
    const halfDepth = Math.max(0, finite(collider.depth)) / 2;
    const closestX = Math.max(collider.x - halfWidth, Math.min(position.x, collider.x + halfWidth));
    const closestZ = Math.max(collider.z - halfDepth, Math.min(position.z, collider.z + halfDepth));
    return Math.hypot(position.x - closestX, position.z - closestZ) < radius - EPSILON;
  }
  return false;
}

export function isPositionClear(position, radius = 0.35, bounds = DEFAULT_BOUNDS, colliders = []) {
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return false;
  const r = safeRadius(radius);
  const safeBounds = bounds ?? DEFAULT_BOUNDS;
  if (position.x - r < finite(safeBounds.minX, DEFAULT_BOUNDS.minX)
    || position.x + r > finite(safeBounds.maxX, DEFAULT_BOUNDS.maxX)
    || position.z - r < finite(safeBounds.minZ, DEFAULT_BOUNDS.minZ)
    || position.z + r > finite(safeBounds.maxZ, DEFAULT_BOUNDS.maxZ)) return false;
  return !colliders.some((collider) => intersects(position, r, collider));
}

export function moveWithCollisions(position, movement, radius = 0.35, bounds = DEFAULT_BOUNDS, colliders = []) {
  const start = {
    x: finite(position?.x),
    z: finite(position?.z),
  };
  const dx = finite(movement?.x);
  const dz = finite(movement?.z);
  if (!dx && !dz) return { ...start, collided: false };

  const distance = Math.hypot(dx, dz);
  const stepLength = Math.max(0.08, safeRadius(radius) * 0.45);
  const steps = Math.max(1, Math.ceil(distance / stepLength));
  const stepX = dx / steps;
  const stepZ = dz / steps;
  const result = { ...start };
  let collided = false;

  for (let index = 0; index < steps; index += 1) {
    const nextX = { x: result.x + stepX, z: result.z };
    if (isPositionClear(nextX, radius, bounds, colliders)) result.x = nextX.x;
    else collided = true;

    const nextZ = { x: result.x, z: result.z + stepZ };
    if (isPositionClear(nextZ, radius, bounds, colliders)) result.z = nextZ.z;
    else collided = true;
  }
  return { ...result, collided };
}

export function validateSpawn(position, radius = 0.35, bounds = DEFAULT_BOUNDS, colliders = []) {
    const { minX, maxX, minZ, maxZ } = bounds ?? {};
    if (![minX, maxX, minZ, maxZ].every(Number.isFinite)
      || minX > maxX || minZ > maxZ) {
      throw new TypeError('Spawn bounds must contain finite, ordered min/max values');
    }
    if (!Number.isFinite(radius) || radius < 0) {
      throw new TypeError('Spawn radius must be a finite, non-negative number');
    }

    const lowX = minX + radius;
    const highX = maxX - radius;
    const lowZ = minZ + radius;
    const highZ = maxZ - radius;
    if (lowX > highX || lowZ > highZ) {
      throw new Error('No clear spawn point exists within bounds for the requested radius');
    }

    const requested = {
      x: Number.isFinite(position?.x) ? position.x : (lowX + highX) / 2,
      z: Number.isFinite(position?.z) ? position.z : (lowZ + highZ) / 2,
    };
    const origin = {
      x: clamp(requested.x, lowX, highX),
      z: clamp(requested.z, lowZ, highZ),
    };
    if (isPositionClear(origin, radius, bounds, colliders)) return origin;

    const step = Math.max(0.25, Math.min(0.75, radius || 0.25));
    const axis = (low, high) => {
      if (low === high) return [low];
      const values = [low];
      for (let value = low + step; value < high; value += step) values.push(value);
      values.push(high);
      return values;
    };
    const candidates = [];
    for (const x of axis(lowX, highX)) {
      for (const z of axis(lowZ, highZ)) candidates.push({ x, z });
    }
    candidates.sort((left, right) => {
      const leftDistance = (left.x - origin.x) ** 2 + (left.z - origin.z) ** 2;
      const rightDistance = (right.x - origin.x) ** 2 + (right.z - origin.z) ** 2;
      return leftDistance - rightDistance || left.x - right.x || left.z - right.z;
    });

    const clear = candidates.find((candidate) => isPositionClear(candidate, radius, bounds, colliders));
    if (clear) return clear;
    throw new Error('No clear spawn point exists within bounds for the requested radius');
  }

export { DEFAULT_BOUNDS as MAP_BOUNDS };
