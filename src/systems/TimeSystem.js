export const DAY_MS = 86_400_000;
export const DEFAULT_MAX_FRAME_DELTA_MS = 100;
export const MAX_EXPLICIT_ADVANCE_MS = DAY_MS * 365;

function result(ok, code, extra = {}) {
  return { ok, code, ...extra };
}

export class TimeSystem {
  constructor({ state, eventBus, maxFrameDeltaMs = DEFAULT_MAX_FRAME_DELTA_MS } = {}) {
    if (!state?.world) throw new Error('TimeSystem requires world state');
    this.state = state;
    this.eventBus = eventBus;
    this.maxFrameDeltaMs = Number.isFinite(maxFrameDeltaMs) && maxFrameDeltaMs > 0
      ? maxFrameDeltaMs
      : DEFAULT_MAX_FRAME_DELTA_MS;
    if (!Number.isFinite(this.state.world.elapsedMs) || this.state.world.elapsedMs < 0) {
      this.state.world.elapsedMs = 0;
    }
    this.state.world.timeOfDayMs = this.#normalizeTime(this.state.world.timeOfDayMs);
    if (!Number.isInteger(this.state.world.day) || this.state.world.day < 1) this.state.world.day = 1;
  }

  #normalizeTime(value) {
    if (!Number.isFinite(value) || value < 0) return 0;
    return value % DAY_MS;
  }

  update(deltaSeconds) {
    if (deltaSeconds === 0) return result(true, 'no-change', { advancedMs: 0, daysAdvanced: 0, clamped: false });
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) return result(false, 'invalid-delta', { advancedMs: 0 });
    const requestedMs = deltaSeconds * 1000;
    const advancedMs = Math.min(requestedMs, this.maxFrameDeltaMs);
    return this.#advance(advancedMs, advancedMs !== requestedMs);
  }

  advanceExplicit(deltaMs) {
    if (deltaMs === 0) return result(true, 'no-change', { advancedMs: 0, daysAdvanced: 0, clamped: false });
    if (!Number.isFinite(deltaMs) || deltaMs < 0) return result(false, 'invalid-delta', { advancedMs: 0 });
    const advancedMs = Math.min(deltaMs, MAX_EXPLICIT_ADVANCE_MS);
    return this.#advance(advancedMs, advancedMs !== deltaMs);
  }

  #advance(advancedMs, clamped) {
    const previousDay = this.state.world.day;
    const totalTime = this.state.world.timeOfDayMs + advancedMs;
    const daysAdvanced = Math.floor(totalTime / DAY_MS);
    this.state.world.timeOfDayMs = totalTime % DAY_MS;
    this.state.world.elapsedMs += advancedMs;
    this.state.world.day += daysAdvanced;

    const payload = Object.freeze({
      day: this.state.world.day,
      timeOfDayMs: this.state.world.timeOfDayMs,
      elapsedMs: this.state.world.elapsedMs,
      advancedMs,
    });
    this.eventBus?.emit?.('time:advanced', payload);
    for (let day = previousDay + 1; day <= this.state.world.day; day += 1) {
      this.eventBus?.emit?.('day:changed', Object.freeze({ day, elapsedMs: this.state.world.elapsedMs }));
    }
    return result(true, 'advanced', { advancedMs, daysAdvanced, clamped });
  }
}
