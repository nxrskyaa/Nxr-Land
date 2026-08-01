import { describe, expect, it } from 'vitest';
import { stepMotion } from '../src/entities/Player.js';

describe('player motion', () => {
  it('accelerates a simulated held-right player and changes authoritative x', () => {
    let motion = { position: { x: 0, z: 4 }, velocity: { x: 0, z: 0 } };
    for (let frame = 0; frame < 60; frame += 1) {
      motion = stepMotion(motion, { x: 1, z: 0 }, 1 / 60);
    }
    expect(motion.position.x).toBeGreaterThan(2);
    expect(motion.position.z).toBe(4);
    expect(motion.velocity.x).toBeGreaterThan(0);
    expect(motion.velocity.x).toBeLessThanOrEqual(4.2);
  });

  it('uses friction to stop and guards invalid or huge deltas', () => {
    const moving = { position: { x: 1, z: 2 }, velocity: { x: 3, z: 0 } };
    expect(stepMotion(moving, { x: 1, z: 0 }, Number.NaN)).toEqual(moving);
    const stopped = stepMotion(moving, { x: 0, z: 0 }, 1);
    expect(stopped.velocity.x).toBeLessThan(3);
    expect(stopped.position.x).toBeLessThan(1.3);
  });
});
