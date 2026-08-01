import { describe, expect, it } from 'vitest';
import { isPositionClear, moveWithCollisions, validateSpawn } from '../src/game/Collision.js';

const bounds = { minX: -5, maxX: 5, minZ: -5, maxZ: 5 };
const colliders = [
  { type: 'rect', x: 1, z: 0, width: 1, depth: 4, id: 'stall' },
  { type: 'circle', x: -2, z: -2, radius: 0.8, id: 'tree' },
];

describe('world collision', () => {
  it('rejects non-finite positions, map edges, rectangles, and circles', () => {
    expect(isPositionClear({ x: Number.NaN, z: 0 }, 0.35, bounds, colliders)).toBe(false);
    expect(isPositionClear({ x: 4.8, z: 0 }, 0.35, bounds, colliders)).toBe(false);
    expect(isPositionClear({ x: 1, z: 0 }, 0.35, bounds, colliders)).toBe(false);
    expect(isPositionClear({ x: -2.9, z: -2 }, 0.35, bounds, colliders)).toBe(false);
    expect(isPositionClear({ x: 0, z: 3 }, 0.35, bounds, colliders)).toBe(true);
  });

  it('prevents a large movement step from tunnelling through a thin blocker', () => {
    const result = moveWithCollisions({ x: -2, z: 0 }, { x: 6, z: 0 }, 0.35, bounds, colliders);
    expect(result.x).toBeLessThan(0.16);
    expect(result.x).toBeGreaterThan(-2);
    expect(result.z).toBe(0);
    expect(result.collided).toBe(true);
  });

  it('slides along a wall when diagonal movement is blocked on one axis', () => {
    const result = moveWithCollisions({ x: 0, z: -1 }, { x: 2, z: 2 }, 0.35, bounds, colliders);
    expect(result.x).toBeLessThan(0.16);
    expect(result.z).toBeGreaterThan(0.8);
    expect(result.collided).toBe(true);
  });

  it('returns the requested spawn or finds a nearby clear exit', () => {
    expect(validateSpawn({ x: 0, z: 3 }, 0.35, bounds, colliders)).toEqual({ x: 0, z: 3 });
    const recovered = validateSpawn({ x: 1, z: 0 }, 0.35, bounds, colliders);
    expect(isPositionClear(recovered, 0.35, bounds, colliders)).toBe(true);
  });
});
