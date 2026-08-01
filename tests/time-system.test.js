import { describe, expect, it, vi } from 'vitest';
import { TimeSystem, DAY_MS } from '../src/systems/TimeSystem.js';
import { createInitialState } from '../src/game/createState.js';

function setup(options = {}) {
  const state = createInitialState();
  const events = [];
  const eventBus = { emit: vi.fn((type, payload) => events.push([type, payload])) };
  const system = new TimeSystem({ state, eventBus, ...options });
  return { state, events, eventBus, system };
}

describe('TimeSystem', () => {
  it('advances deterministic foreground game time without consulting Date', () => {
    const { state, system, events } = setup({ maxFrameDeltaMs: 100 });
    const before = state.world.timeOfDayMs;
    expect(system.update(0.05)).toMatchObject({ ok: true, advancedMs: 50 });
    expect(state.world.timeOfDayMs).toBe(before + 50);
    expect(state.world.elapsedMs).toBe(50);
    expect(events[0]).toEqual(['time:advanced', expect.objectContaining({ day: 1, advancedMs: 50, elapsedMs: 50 })]);
  });

  it('rejects non-finite and non-positive values and clamps foreground spikes', () => {
    const { state, system, eventBus } = setup({ maxFrameDeltaMs: 80 });
    const before = structuredClone(state.world);
    expect(system.update(Number.NaN)).toMatchObject({ ok: false, code: 'invalid-delta' });
    expect(system.update(-1)).toMatchObject({ ok: false, code: 'invalid-delta' });
    expect(state.world).toEqual(before);
    expect(eventBus.emit).not.toHaveBeenCalled();
    expect(system.update(5)).toMatchObject({ ok: true, advancedMs: 80, clamped: true });
  });

  it('supports explicit compressed advancement and rolls over multiple days in event order', () => {
    const { state, system, events } = setup();
    state.world.timeOfDayMs = DAY_MS - 10;
    const result = system.advanceExplicit(DAY_MS * 2 + 25);
    expect(result).toMatchObject({ ok: true, advancedMs: DAY_MS * 2 + 25, daysAdvanced: 3 });
    expect(state.world.day).toBe(4);
    expect(state.world.timeOfDayMs).toBe(15);
    expect(state.world.elapsedMs).toBe(DAY_MS * 2 + 25);
    expect(events.map(([type]) => type)).toEqual(['time:advanced', 'day:changed', 'day:changed', 'day:changed']);
    expect(events.slice(1).map(([, payload]) => payload.day)).toEqual([2, 3, 4]);
  });

  it('is pause-safe because no implicit wall-clock passage occurs', () => {
    const { state, system } = setup();
    const snapshot = structuredClone(state.world);
    expect(system.update(0)).toMatchObject({ ok: true, advancedMs: 0 });
    expect(state.world).toEqual(snapshot);
  });
});
