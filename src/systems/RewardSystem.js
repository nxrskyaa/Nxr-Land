const DAY_MS = 86_400_000;
const PERSIST_INTERVAL_MS = 15_000;

function asDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError('RewardSystem clock must return a valid date');
  return date;
}

export function localDayKey(value = new Date()) {
  const date = asDate(value);
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dayOrdinal(key) {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [year, month, day] = key.split('-').map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return timestamp / DAY_MS;
}

function defaultPresence() {
  const doc = globalThis.document;
  const view = globalThis.window;
  return {
    isVisible: () => !doc || doc.visibilityState !== 'hidden',
    isFocused: () => !doc?.hasFocus || doc.hasFocus(),
    subscribe(listener) {
      if (!doc?.addEventListener || !view?.addEventListener) return () => {};
      doc.addEventListener('visibilitychange', listener);
      view.addEventListener('focus', listener);
      view.addEventListener('blur', listener);
      return () => {
        doc.removeEventListener('visibilitychange', listener);
        view.removeEventListener('focus', listener);
        view.removeEventListener('blur', listener);
      };
    },
  };
}

function rewardLabel(reward = {}) {
  const parts = [];
  if (reward.coin) parts.push(`${reward.coin} coin`);
  for (const [itemId, quantity] of Object.entries(reward.items ?? {})) parts.push(`${quantity}× ${itemId}`);
  for (const wardrobeId of reward.wardrobe ?? []) parts.push(wardrobeId);
  return parts.join(' · ');
}

export class RewardSystem {
  constructor({ state, eventBus, saveManager, clock, presence } = {}) {
    if (!state?.rewards?.daily || !state?.rewards?.playtime || !state?.playtime) {
      throw new Error('RewardSystem requires reward-enabled state');
    }
    this.state = state;
    this.eventBus = eventBus;
    this.saveManager = saveManager;
    this.clock = clock ?? { now: () => new Date() };
    this.presence = presence ?? defaultPresence();
    this.claimLocks = new Set();
    this.disposed = false;
    this.lastSample = this.#now();
    this.unsavedActiveMs = 0;
    this.lastEmittedSecond = Math.floor(this.state.playtime.dailyActiveMs / 1000);
    this.unsubscribePresence = this.presence.subscribe?.(() => {
      this.update();
      this.lastSample = this.#now();
    });
  }

  #now() {
    const value = typeof this.clock === 'function' ? this.clock() : this.clock.now();
    return asDate(value);
  }

  #isActive() {
    return this.presence.isVisible?.() !== false && this.presence.isFocused?.() !== false;
  }

  #save() {
    return this.saveManager?.save?.(this.state) !== false;
  }

  #transaction(type, payload, mutate) {
    if (this.eventBus?.transact) {
      return this.eventBus.transact(type, payload, {
        state: this.state,
        mutate,
        save: () => this.#save(),
      });
    }
    const snapshot = structuredClone(this.state);
    try {
      mutate();
      if (!this.#save()) throw new Error('save failed');
    } catch {
      for (const key of Object.keys(this.state)) delete this.state[key];
      Object.assign(this.state, snapshot);
      return { ok: false, code: 'save-failed' };
    }
    return { ok: true, payload: typeof payload === 'function' ? payload() : payload };
  }

  #applyReward(reward) {
    const coin = reward.coin ?? 0;
    if (!Number.isSafeInteger(coin) || coin < 0) throw new TypeError('Invalid reward coin');
    const nextCoin = this.state.economy.coin + coin;
    if (!Number.isSafeInteger(nextCoin)) throw new RangeError('Reward coin total is unsafe');
    this.state.economy.coin = nextCoin;

    for (const [itemId, quantity] of Object.entries(reward.items ?? {})) {
      if (!itemId || !Number.isSafeInteger(quantity) || quantity < 0) throw new TypeError('Invalid reward item');
      const nextQuantity = (this.state.economy.inventory[itemId] ?? 0) + quantity;
      if (!Number.isSafeInteger(nextQuantity)) throw new RangeError('Reward item total is unsafe');
      this.state.economy.inventory[itemId] = nextQuantity;
    }
    for (const wardrobeId of reward.wardrobe ?? []) {
      if (typeof wardrobeId !== 'string' || !wardrobeId) throw new TypeError('Invalid wardrobe reward');
      if (!this.state.collection.wardrobe.includes(wardrobeId)) this.state.collection.wardrobe.push(wardrobeId);
    }
  }

  getDailyStatus() {
    const today = localDayKey(this.#now());
    const daily = this.state.rewards.daily;
    const claimed = daily.lastClaimDate === today || daily.claimedDays.includes(today);
    const previous = dayOrdinal(daily.lastClaimDate);
    const current = dayOrdinal(today);
    const consecutive = previous !== null && current - previous === 1;
    const nextDay = claimed ? daily.streak : consecutive ? (daily.streak % daily.track.length) + 1 : 1;
    return { available: !claimed, claimed, date: today, nextDay, streak: daily.streak };
  }

  claimDaily() {
    const lock = 'daily';
    if (this.claimLocks.has(lock)) return { ok: false, code: 'claim-locked', message: 'Daily reward claim is already running' };
    const status = this.getDailyStatus();
    if (!status.available) return { ok: false, code: 'already-claimed', message: 'Today’s reward is already claimed' };
    const entry = this.state.rewards.daily.track.find(({ day }) => day === status.nextDay);
    if (!entry) return { ok: false, code: 'invalid-track', message: 'Daily reward track is unavailable' };

    this.claimLocks.add(lock);
    try {
      const payload = () => ({
        date: status.date,
        day: entry.day,
        reward: structuredClone(entry.reward),
        label: rewardLabel(entry.reward),
      });
      const result = this.#transaction('reward:daily-claimed', payload, () => {
        this.#applyReward(entry.reward);
        const daily = this.state.rewards.daily;
        daily.lastClaimDate = status.date;
        daily.streak = entry.day;
        if (!daily.claimedDays.includes(status.date)) daily.claimedDays.push(status.date);
      });
      return result.ok ? { ok: true, ...result.payload } : result;
    } finally {
      this.claimLocks.delete(lock);
    }
  }

  update() {
    if (this.disposed) return { activeMs: 0 };
    const now = this.#now();
    const elapsed = Math.max(0, now.getTime() - this.lastSample.getTime());
    const today = localDayKey(now);
    const previousDate = this.state.playtime.lastActiveDate;
    let activeMs = 0;
    let dayChanged = previousDate !== null && previousDate !== today;

    if (this.#isActive() && elapsed > 0) {
      activeMs = elapsed;
      this.state.playtime.totalMs += elapsed;
      if (localDayKey(this.lastSample) === today && !dayChanged) {
        this.state.playtime.dailyActiveMs += elapsed;
      } else {
        const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        this.state.playtime.dailyActiveMs = Math.min(elapsed, Math.max(0, now.getTime() - midnight));
      }
      this.state.playtime.lastActiveDate = today;
      this.unsavedActiveMs += elapsed;
    } else if (dayChanged) {
      this.state.playtime.dailyActiveMs = 0;
      this.state.playtime.lastActiveDate = today;
    } else if (previousDate === null && this.#isActive()) {
      this.state.playtime.lastActiveDate = today;
    }
    this.lastSample = now;

    const currentSecond = Math.floor(this.state.playtime.dailyActiveMs / 1000);
    const crossedMilestone = this.state.rewards.playtime.milestones.some(({ minutes, claimed }) => (
      !claimed && this.state.playtime.dailyActiveMs >= minutes * 60_000
        && this.state.playtime.dailyActiveMs - activeMs < minutes * 60_000
    ));
    if (activeMs > 0 && (currentSecond !== this.lastEmittedSecond || crossedMilestone || dayChanged)) {
      this.lastEmittedSecond = currentSecond;
      this.eventBus?.emitSafe?.('reward:playtime-updated', {
        dailyActiveMs: this.state.playtime.dailyActiveMs,
        totalMs: this.state.playtime.totalMs,
        date: today,
      });
    }
    if (this.unsavedActiveMs >= PERSIST_INTERVAL_MS || crossedMilestone || dayChanged) {
      try {
        if (this.#save()) this.unsavedActiveMs = 0;
      } catch {
        // Keep accumulated state dirty so a later tick or disposal can retry.
      }
    }
    return { activeMs, dayChanged };
  }

  getMilestones() {
    return this.state.rewards.playtime.milestones.map((entry) => ({
      ...entry,
      reward: structuredClone(entry.reward),
      claimable: !entry.claimed && this.state.playtime.dailyActiveMs >= entry.minutes * 60_000,
      progress: Math.min(1, this.state.playtime.dailyActiveMs / (entry.minutes * 60_000)),
    }));
  }

  claimMilestone(minutes) {
    const entry = this.state.rewards.playtime.milestones.find((milestone) => milestone.minutes === minutes);
    if (!entry) return { ok: false, code: 'unknown-milestone', message: 'Unknown playtime milestone' };
    const lock = `milestone:${minutes}`;
    if (this.claimLocks.has(lock)) return { ok: false, code: 'claim-locked', message: 'Milestone claim is already running' };
    if (entry.claimed) return { ok: false, code: 'already-claimed', message: 'Milestone is already claimed' };
    if (this.state.playtime.dailyActiveMs < entry.minutes * 60_000) {
      return { ok: false, code: 'not-ready', message: 'Keep playing in the foreground to unlock this reward' };
    }

    this.claimLocks.add(lock);
    try {
      const payload = () => ({ minutes: entry.minutes, reward: structuredClone(entry.reward), label: rewardLabel(entry.reward) });
      const result = this.#transaction('reward:milestone-claimed', payload, () => {
        this.#applyReward(entry.reward);
        entry.claimed = true;
      });
      return result.ok ? { ok: true, ...result.payload } : result;
    } finally {
      this.claimLocks.delete(lock);
    }
  }

  dispose() {
    if (this.disposed) return;
    this.update();
    this.disposed = true;
    this.unsubscribePresence?.();
    this.unsubscribePresence = null;
  }
}
