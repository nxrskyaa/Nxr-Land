export const PRIMARY_SAVE_KEY = 'nxr-land-save-v1';
export const BACKUP_SAVE_KEY = 'nxr-land-save-v1-backup';

const REQUIRED_SECTIONS = [
  'player',
  'world',
  'crops',
  'economy',
  'collection',
  'quests',
  'rewards',
  'gacha',
  'settings',
  'playtime',
];

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const PLOT_STATES = new Set(['empty', 'planted', 'growing', 'ready', 'withered']);

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isArrayIndex(key, length) {
  if (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key)) return false;
  const index = Number(key);
  return Number.isSafeInteger(index) && index < length;
}

function isJsonSafe(value, ancestors = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object') return false;
  if (!Array.isArray(value) && !isPlainObject(value)) return false;
  if (ancestors.has(value)) return false;

  const enumerableKeys = Reflect.ownKeys(value)
    .filter((key) => Object.prototype.propertyIsEnumerable.call(value, key));
  if (Array.isArray(value)) {
    if (enumerableKeys.length !== value.length
      || enumerableKeys.some((key) => !isArrayIndex(key, value.length))) return false;
  } else if (enumerableKeys.some((key) => typeof key !== 'string' || DANGEROUS_KEYS.has(key))) {
    return false;
  }

  ancestors.add(value);
  const safe = enumerableKeys.every((key) => isJsonSafe(value[key], ancestors));
  ancestors.delete(value);
  return safe;
}

function isFiniteNonnegative(value) {
  return Number.isFinite(value) && value >= 0;
}

function isNonnegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function isNullableString(value) {
  return value === null || typeof value === 'string';
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isQuantityMap(value, integer = true) {
  return isPlainObject(value) && Object.values(value).every((quantity) => (
    integer ? isNonnegativeInteger(quantity) : isFiniteNonnegative(quantity)
  ));
}

function isValidPlot(plot) {
  return isPlainObject(plot)
    && typeof plot.id === 'string'
    && PLOT_STATES.has(plot.state)
    && isNullableString(plot.cropId)
    && (plot.plantedAt === undefined || plot.plantedAt === null || Number.isFinite(plot.plantedAt))
    && (plot.wateredAt === undefined || plot.wateredAt === null || Number.isFinite(plot.wateredAt));
}

function isValidReward(reward) {
  return isPlainObject(reward)
    && (reward.coin === undefined || isFiniteNonnegative(reward.coin))
    && (reward.items === undefined || isQuantityMap(reward.items));
}

function isValidDailyRewardEntry(entry) {
  return isPlainObject(entry)
    && Number.isInteger(entry.day)
    && entry.day > 0
    && isValidReward(entry.reward);
}

function isValidPlaytimeRewardEntry(entry) {
  return isPlainObject(entry)
    && isFiniteNonnegative(entry.minutes)
    && typeof entry.claimed === 'boolean'
    && isValidReward(entry.reward);
}

function isValidState(state) {
  if (!isPlainObject(state)
    || state.schemaVersion !== 1
    || !REQUIRED_SECTIONS.every((section) => isPlainObject(state[section]))
    || !isJsonSafe(state)) return false;

  const { player, world, crops, economy, collection, quests, rewards, gacha, settings, playtime } = state;
  return isPlainObject(player.position)
    && ['x', 'y', 'z'].every((axis) => Number.isFinite(player.position[axis]))
    && Number.isInteger(world.day) && world.day > 0
    && Number.isFinite(world.timeOfDayMs)
    && typeof world.weather === 'string'
    && isStringArray(world.ownedLand)
    && Array.isArray(world.placedBuildings)
    && isPlainObject(world.upgrades)
    && Array.isArray(crops.plots) && crops.plots.every(isValidPlot)
    && isFiniteNonnegative(economy.coin)
    && isQuantityMap(economy.inventory)
    && isStringArray(collection.pets)
    && isStringArray(collection.wardrobe)
    && isPlainObject(collection.equipped)
    && isNullableString(quests.activeId)
    && isStringArray(quests.completedIds)
    && isQuantityMap(quests.progress, false)
    && isPlainObject(rewards.daily)
    && isNullableString(rewards.daily.lastClaimDate)
    && isFiniteNonnegative(rewards.daily.streak)
    && Array.isArray(rewards.daily.claimedDays)
    && Array.isArray(rewards.daily.track)
    && rewards.daily.track.every(isValidDailyRewardEntry)
    && isPlainObject(rewards.playtime)
    && Array.isArray(rewards.playtime.milestones)
    && rewards.playtime.milestones.every(isValidPlaytimeRewardEntry)
    && isPlainObject(gacha.pity)
    && Object.values(gacha.pity).every(isFiniteNonnegative)
    && isFiniteNonnegative(gacha.styleDust)
    && isPlainObject(settings.audio)
    && isPlainObject(settings.graphics)
    && isPlainObject(settings.controls)
    && isFiniteNonnegative(playtime.totalMs)
    && isFiniteNonnegative(playtime.dailyActiveMs)
    && isNullableString(playtime.lastActiveDate);
}

function mergeDefaults(defaultValue, savedValue) {
  if (!isPlainObject(defaultValue) || !isPlainObject(savedValue)) {
    return savedValue === undefined ? defaultValue : savedValue;
  }

  const merged = { ...defaultValue };
  for (const [key, value] of Object.entries(savedValue)) {
    if (DANGEROUS_KEYS.has(key)) continue;
    merged[key] = Object.hasOwn(defaultValue, key)
      ? mergeDefaults(defaultValue[key], value)
      : value;
  }
  return merged;
}

function migrateVersionZero(legacy, createInitialState) {
  const defaults = createInitialState();
  const {
    collections,
    collection: currentCollection,
    world: legacyWorld = {},
    crops: legacyCrops = {},
    rewards: legacyRewards = {},
    playtime: legacyPlaytime = {},
    ...remaining
  } = legacy;
  const { plots: worldPlots, ...world } = legacyWorld;
  const collection = currentCollection ?? collections;
  const rewardPlaytime = isPlainObject(legacyRewards.playtime)
    ? legacyRewards.playtime
    : {};
  const {
    activeMs,
    date,
    totalMs: rewardTotalMs,
    ...cleanRewardPlaytime
  } = rewardPlaytime;
  const crops = {
    ...legacyCrops,
    ...(legacyCrops.plots === undefined && worldPlots !== undefined
      ? { plots: worldPlots }
      : {}),
  };
  const playtime = {
    ...legacyPlaytime,
    totalMs: legacyPlaytime.totalMs ?? rewardTotalMs ?? defaults.playtime.totalMs,
    dailyActiveMs: legacyPlaytime.dailyActiveMs ?? activeMs ?? defaults.playtime.dailyActiveMs,
    lastActiveDate: legacyPlaytime.lastActiveDate ?? date ?? defaults.playtime.lastActiveDate,
  };
  const normalized = {
    ...remaining,
    world,
    crops,
    ...(collection === undefined ? {} : { collection }),
    rewards: { ...legacyRewards, playtime: cleanRewardPlaytime },
    playtime,
    schemaVersion: 1,
  };

  return mergeDefaults(defaults, normalized);
}

function decode(serialized, createInitialState) {
  if (typeof serialized !== 'string') return null;

  try {
    const parsed = JSON.parse(serialized);
    if (isValidState(parsed)) return { state: parsed, migrated: false };
    if (!isPlainObject(parsed) || parsed.schemaVersion !== 0 || !isJsonSafe(parsed)) return null;

    const migrated = migrateVersionZero(parsed, createInitialState);
    return isValidState(migrated) ? { state: migrated, migrated: true } : null;
  } catch {
    return null;
  }
}

export class SaveManager {
  constructor({ storage, createInitialState }) {
    this.storage = storage;
    this.createInitialState = createInitialState;
    this.lastStatus = null;
  }

  save(state) {
    if (!isValidState(state)) {
      this.lastStatus = 'invalid';
      return false;
    }

    let priorSerialized = null;
    let priorBackup = null;
    let backupAttempted = false;
    let primaryAttempted = false;

    try {
      const serialized = JSON.stringify(state);
      priorSerialized = this.storage.getItem(PRIMARY_SAVE_KEY);
      if (decode(priorSerialized, this.createInitialState)) {
        priorBackup = this.storage.getItem(BACKUP_SAVE_KEY);
        backupAttempted = true;
        this.storage.setItem(BACKUP_SAVE_KEY, priorSerialized);
      }
      primaryAttempted = true;
      this.storage.setItem(PRIMARY_SAVE_KEY, serialized);
      this.lastStatus = 'saved';
      return true;
    } catch {
      if (primaryAttempted) this.#restore(PRIMARY_SAVE_KEY, priorSerialized);
      if (backupAttempted) this.#restore(BACKUP_SAVE_KEY, priorBackup);
      this.lastStatus = 'error';
      return false;
    }
  }

  #restore(key, serialized) {
    try {
      if (serialized === null) this.storage.removeItem(key);
      else this.storage.setItem(key, serialized);
    } catch {
      // Storage adapters cannot guarantee rollback; preserve the original failure status.
    }
  }

  load() {
    let primary = null;
    let backup = null;

    try {
      primary = decode(this.storage.getItem(PRIMARY_SAVE_KEY), this.createInitialState);
    } catch {
      // Continue to backup recovery.
    }
    if (primary) {
      this.lastStatus = primary.migrated ? 'migrated' : 'loaded';
      return primary.state;
    }

    try {
      backup = decode(this.storage.getItem(BACKUP_SAVE_KEY), this.createInitialState);
    } catch {
      // Fall through to a fresh state.
    }
    if (backup) {
      this.lastStatus = 'recovered';
      return backup.state;
    }

    this.lastStatus = 'fresh';
    return this.createInitialState();
  }

  clear({ includeBackup = false } = {}) {
    try {
      this.storage.removeItem(PRIMARY_SAVE_KEY);
      if (includeBackup) this.storage.removeItem(BACKUP_SAVE_KEY);
      this.lastStatus = 'cleared';
      return true;
    } catch {
      this.lastStatus = 'error';
      return false;
    }
  }

  reset() {
    const state = this.createInitialState();
    const ok = this.save(state);
    if (ok) this.lastStatus = 'reset';
    return { ok, state };
  }
}
