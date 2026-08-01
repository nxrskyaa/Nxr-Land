const DEFAULT_BOUNDS = Object.freeze({ minX: -17, maxX: 17, minZ: -13, maxZ: 13 });
const EPSILON = 1e-6;

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
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

export function validateSpawn(spawn, radius = 0.35, bounds = DEFAULT_BOUNDS, colliders = []) {
  const requested = { x: finite(spawn?.x), z: finite(spawn?.z, 4) };
  if (isPositionClear(requested, radius, bounds, colliders)) return requested;
  for (let ring = 1; ring <= 24; ring += 1) {
    const distance = ring * 0.5;
    const samples = Math.max(8, ring * 6);
    for (let index = 0; index < samples; index += 1) {
      const angle = index / samples * Math.PI * 2;
      const candidate = {
        x: requested.x + Math.cos(angle) * distance,
        z: requested.z + Math.sin(angle) * distance,
      };
      if (isPositionClear(candidate, radius, bounds, colliders)) return candidate;
    }
  }
  return { x: 0, z: 4 };
}

export { DEFAULT_BOUNDS as MAP_BOUNDS };
