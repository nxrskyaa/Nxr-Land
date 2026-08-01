import { describe, expect, it } from 'vitest';
import { clampDelta, getRenderMetrics } from '../src/game/Game.js';

describe('Game pure rendering helpers', () => {
  it('guards negative, invalid, and long-frame delta spikes', () => {
    expect(clampDelta(-1)).toBe(0);
    expect(clampDelta(Number.NaN)).toBe(0);
    expect(clampDelta(0.016)).toBe(0.016);
    expect(clampDelta(2)).toBe(0.05);
  });

  it('uses safe dimensions and caps device pixel ratio at two', () => {
    expect(getRenderMetrics({ width: 0, height: 0 }, 4)).toEqual({
      width: 1,
      height: 1,
      pixelRatio: 2,
      aspect: 1,
    });
    expect(getRenderMetrics({ width: 1200, height: 800 }, 1.5)).toEqual({
      width: 1200,
      height: 800,
      pixelRatio: 1.5,
      aspect: 1.5,
    });
  });
});
