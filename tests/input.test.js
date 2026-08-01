import { describe, expect, it } from 'vitest';
import { normalizeInputVector, joystickVector } from '../src/game/Input.js';

describe('input vectors', () => {
  it('normalizes diagonal digital input without accelerating it', () => {
    expect(normalizeInputVector(1, 0)).toEqual({ x: 1, z: 0 });
    const diagonal = normalizeInputVector(1, 1);
    expect(Math.hypot(diagonal.x, diagonal.z)).toBeCloseTo(1);
    expect(diagonal.x).toBeCloseTo(Math.SQRT1_2);
  });

  it('guards invalid values and applies a joystick dead zone', () => {
    expect(normalizeInputVector(Number.NaN, 2)).toEqual({ x: 0, z: 1 });
    expect(joystickVector(0.5, 0.5, 5, 0.2)).toEqual({ x: 0, z: 0 });
    const analog = joystickVector(10, 0, 20, 0.2);
    expect(analog.x).toBeCloseTo(0.375);
    expect(analog.z).toBe(0);
    expect(Math.hypot(...Object.values(joystickVector(40, 40, 20)))).toBeCloseTo(1);
  });
});
