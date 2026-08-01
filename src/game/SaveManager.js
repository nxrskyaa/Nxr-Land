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

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isJsonSafe(value, ancestors = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object') return false;
  if (!Array.isArray(value) && !isPlainObject(value)) return false;
  if (ancestors.has(value)) return false;

  ancestors.add(value);
  let safe;
  if (Array.isArray(value)) {
    safe = true;
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index) || !isJsonSafe(value[index], ancestors)) {
        safe = false;
        break;
      }
    }
  } else {
    safe = Object.values(value).every((entry) => isJsonSafe(entry, ancestors));
  }
  ancestors.delete(value);
  return safe;
}

function isValidState(state) {
  return isPlainObject(state)
    && state.schemaVersion === 1
    && REQUIRED_SECTIONS.every((section) => isPlainObject(state[section]))
    && isJsonSafe(state);
}

function mergeDefaults(defaultValue, savedValue) {
  if (!isPlainObject(defaultValue) || !isPlainObject(savedValue)) {
    return savedValue === undefined ? defaultValue : savedValue;
  }

  const merged = { ...defaultValue };
  for (const [key, value] of Object.entries(savedValue)) {
    merged[key] = key in defaultValue
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

    try {
      const serialized = JSON.stringify(state);
      const priorSerialized = this.storage.getItem(PRIMARY_SAVE_KEY);
      if (decode(priorSerialized, this.createInitialState)) {
        this.storage.setItem(BACKUP_SAVE_KEY, priorSerialized);
      }
      this.storage.setItem(PRIMARY_SAVE_KEY, serialized);
      this.lastStatus = 'saved';
      return true;
    } catch {
      this.lastStatus = 'error';
      return false;
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
    if (this.save(state)) this.lastStatus = 'reset';
    return state;
  }
}
