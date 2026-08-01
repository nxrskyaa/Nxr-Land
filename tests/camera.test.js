import { describe, expect, it } from 'vitest';
import { clampCameraTarget, smoothCameraTarget } from '../src/game/Camera.js';

describe('camera follow logic', () => {
  const bounds = { minX: -17, maxX: 17, minZ: -13, maxZ: 13 };

  it('clamps the follow target to framing constraints', () => {
    expect(clampCameraTarget({ x: 30, z: -30 }, bounds, { x: 8, z: 6 })).toEqual({ x: 9, z: -7 });
    expect(clampCameraTarget({ x: 2, z: 3 }, bounds, { x: 8, z: 6 })).toEqual({ x: 2, z: 3 });
  });

  it('smoothly approaches the target without overshooting and guards delta', () => {
    const next = smoothCameraTarget({ x: 0, z: 0 }, { x: 8, z: 4 }, 0.1, 6);
    expect(next.x).toBeGreaterThan(0);
    expect(next.x).toBeLessThan(8);
    expect(next.z).toBeGreaterThan(0);
    expect(smoothCameraTarget(next, { x: 8, z: 4 }, Number.NaN, 6)).toEqual(next);
  });
});
