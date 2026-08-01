import { describe, expect, it, vi } from 'vitest';
import { clampDelta, getOrthographicBounds, getRenderMetrics, saveBeforeDispose } from '../src/game/Game.js';

describe('Game pure rendering helpers', () => {
  it('persists authoritative foreground time before teardown', () => {
    const state = { world: { elapsedMs: 12_345 } };
    const saveManager = { save: vi.fn(() => true) };

    expect(saveBeforeDispose(saveManager, state)).toBe(true);
    expect(saveManager.save).toHaveBeenCalledWith(state);
  });

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

  it('fits the complete 40 by 30 world with margin at desktop and portrait aspect ratios', () => {
    const desktop = getOrthographicBounds(1280 / 720);
    const mobile = getOrthographicBounds(320 / 577);

    expect(desktop.top - desktop.bottom).toBeCloseTo(32.4);
    expect(desktop.right - desktop.left).toBeGreaterThanOrEqual(43.2);
    expect(mobile.right - mobile.left).toBeCloseTo(43.2);
    expect(mobile.top - mobile.bottom).toBeGreaterThanOrEqual(32.4);
  });

  it('keeps wide screens height-fitted instead of adding excess vertical sky', () => {
    const wide = getOrthographicBounds(21 / 9);

    expect(wide.top).toBeCloseTo(16.2);
    expect(wide.bottom).toBeCloseTo(-16.2);
  });
});
