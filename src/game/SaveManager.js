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
const PLOT_STATES = new Set(['empty', 'tilled', 'planted', 'watered', 'growing', 'harvestable']);
const WARDROBE_SLOTS = ['hair', 'top', 'bottom', 'shoes', 'accessory'];
const REWARD_KEYS = new Set(['coin', 'items']);
const QUEST_PHASES = new Set(['offered', 'accepted', 'ready', 'complete']);

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

  const descriptors = Object.getOwnPropertyDescriptors(value);
  const ownKeys = Reflect.ownKeys(descriptors);
  if (ownKeys.some((key) => {
    if (Array.isArray(value) && key === 'length') return false;
    const descriptor = descriptors[key];
    if (descriptor.get || descriptor.set) {
      throw new TypeError('Accessor properties are not serializable save data');
    }
    return typeof key !== 'string'
      || key === 'toJSON'
      || !descriptor.enumerable;
  })) return false;

  const enumerableKeys = ownKeys.filter((key) => key !== 'length');
  if (Array.isArray(value)) {
    if (enumerableKeys.length !== value.length
      || enumerableKeys.some((key) => !isArrayIndex(key, value.length))) return false;
  } else if (enumerableKeys.some((key) => DANGEROUS_KEYS.has(key))) {
    return false;
  }

  ancestors.add(value);
  const safe = enumerableKeys.every((key) => isJsonSafe(descriptors[key].value, ancestors));
  ancestors.delete(value);
  return safe;
}

function isFiniteNonnegative(value) {
  return Number.isFinite(value) && value >= 0;
}

function isNonnegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function isNullableString(value) {
  return value === null || typeof value === 'string';
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function isNullableNonEmptyString(value) {
  return value === null || isNonEmptyString(value);
}

function isStringArray(value, nonEmpty = false) {
  return Array.isArray(value) && value.every((entry) => (
    nonEmpty ? isNonEmptyString(entry) : typeof entry === 'string'
  ));
}

function isQuantityMap(value, integer = true, nonEmptyKeys = false) {
  return isPlainObject(value) && Object.entries(value).every(([key, quantity]) => (
    (!nonEmptyKeys || isNonEmptyString(key))
    && (integer ? isNonnegativeInteger(quantity) : isFiniteNonnegative(quantity))
  ));
}

function isUnitInterval(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function isValidPlacedBuilding(building) {
  return isPlainObject(building)
    && (isNonEmptyString(building.id) || isNonEmptyString(building.buildingId))
    && Number.isFinite(building.x)
    && Number.isFinite(building.z)
    && (building.rotation === undefined || Number.isFinite(building.rotation));
}

function isValidEquipped(equipped) {
  return isPlainObject(equipped)
    && isNullableString(equipped.petId)
    && isPlainObject(equipped.wardrobe)
    && WARDROBE_SLOTS.every((slot) => isNullableNonEmptyString(equipped.wardrobe[slot]));
}

function isValidPlot(plot) {
  return isPlainObject(plot)
    && typeof plot.id === 'string'
    && PLOT_STATES.has(plot.state)
    && isNullableString(plot.cropId)
    && (plot.plantedAt === undefined || plot.plantedAt === null || Number.isFinite(plot.plantedAt))
    && (plot.wateredAt === undefined || plot.wateredAt === null || Number.isFinite(plot.wateredAt))
    && (plot.growthStartedAt === undefined || plot.growthStartedAt === null || Number.isFinite(plot.growthStartedAt));
}

function isValidReward(reward) {
  return isPlainObject(reward)
    && Object.keys(reward).every((key) => REWARD_KEYS.has(key))
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
    && Number.isFinite(entry.minutes)
    && entry.minutes > 0
    && typeof entry.claimed === 'boolean'
    && isValidReward(entry.reward);
}

function isValidState(state) {
  if (!isJsonSafe(state)
    || !isPlainObject(state)
    || state.schemaVersion !== 1
    || !REQUIRED_SECTIONS.every((section) => isPlainObject(state[section]))) return false;

  const { player, world, crops, economy, collection, quests, rewards, gacha, settings, playtime } = state;
  return isNonEmptyString(player.name)
    && (player.creatorComplete === undefined || typeof player.creatorComplete === 'boolean')
    && isPlainObject(player.appearance)
    && ['skinTone', 'hairStyle', 'hairColor'].every((key) => isNonEmptyString(player.appearance[key]))
    && isPlainObject(player.position)
    && ['x', 'y', 'z'].every((axis) => Number.isFinite(player.position[axis]))
    && Number.isInteger(world.day) && world.day > 0
    && Number.isFinite(world.timeOfDayMs)
    && (world.elapsedMs === undefined || isFiniteNonnegative(world.elapsedMs))
    && typeof world.weather === 'string'
    && isStringArray(world.ownedLand)
    && Array.isArray(world.placedBuildings)
    && world.placedBuildings.every(isValidPlacedBuilding)
    && (world.unlocks === undefined || isStringArray(world.unlocks, true))
    && isPlainObject(world.upgrades)
    && isPositiveInteger(world.upgrades.houseLevel)
    && Array.isArray(crops.plots) && crops.plots.every(isValidPlot)
    && isFiniteNonnegative(economy.coin)
    && (economy.selectedHotbarId === undefined || isNonEmptyString(economy.selectedHotbarId))
    && isQuantityMap(economy.inventory, true, true)
    && isStringArray(collection.pets, true)
    && isStringArray(collection.wardrobe, true)
    && isValidEquipped(collection.equipped)
    && isPositiveInteger(quests.chapter)
    && isNullableString(quests.activeId)
    && (quests.phase === undefined || QUEST_PHASES.has(quests.phase))
    && isStringArray(quests.completedIds)
    && (quests.interactedIds === undefined || isStringArray(quests.interactedIds, true))
    && isQuantityMap(quests.progress, false)
    && isPlainObject(rewards.daily)
    && isNullableString(rewards.daily.lastClaimDate)
    && isNonnegativeInteger(rewards.daily.streak)
    && Array.isArray(rewards.daily.claimedDays)
    && rewards.daily.claimedDays.every((day) => isPositiveInteger(day) || isNonEmptyString(day))
    && Array.isArray(rewards.daily.track)
    && rewards.daily.track.every(isValidDailyRewardEntry)
    && isPlainObject(rewards.playtime)
    && Array.isArray(rewards.playtime.milestones)
    && rewards.playtime.milestones.every(isValidPlaytimeRewardEntry)
    && isPlainObject(gacha.pity)
    && isNonnegativeInteger(gacha.pity.pet)
    && isNonnegativeInteger(gacha.pity.wardrobe)
    && isFiniteNonnegative(gacha.styleDust)
    && isPlainObject(settings.audio)
    && ['master', 'music', 'effects'].every((key) => isUnitInterval(settings.audio[key]))
    && isPlainObject(settings.graphics)
    && typeof settings.graphics.shadows === 'boolean'
    && typeof settings.graphics.quality === 'string'
    && isPlainObject(settings.controls)
    && typeof settings.controls.touch === 'string'
    && typeof settings.controls.reducedMotion === 'boolean'
    && isFiniteNonnegative(playtime.totalMs)
    && isFiniteNonnegative(playtime.dailyActiveMs)
    && isNullableString(playtime.lastActiveDate);
}

function isStructurallyEqual(left, right) {
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') {
    return Object.is(left, right);
  }
  if (Array.isArray(left) !== Array.isArray(right)) return false;

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key) => Object.hasOwn(right, key)
      && isStructurallyEqual(left[key], right[key]));
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

function normalizeQuestLifecycle(state, createInitialState, wasMissing = false) {
  if (!wasMissing) return state;
  const defaults = createInitialState();
  if (state.quests.activeId === null) {
    state.quests.phase = 'complete';
    return state;
  }
  const pristine = state.quests.activeId === defaults.quests.activeId
    && state.quests.completedIds.length === 0
    && (state.quests.progress[state.quests.activeId] ?? 0) === 0;
  state.quests.phase = pristine ? 'offered' : 'accepted';
  return state;
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
  const migratedPlots = (legacyCrops.plots ?? worldPlots)?.map?.((plot) => ({
    ...plot,
    state: plot.state === 'ready' ? 'harvestable'
      : plot.state === 'withered' ? 'empty'
        : plot.state,
    ...(plot.state === 'withered' ? {
      cropId: null, plantedAt: null, wateredAt: null, growthStartedAt: null,
    } : {}),
  }));
  const crops = {
    ...legacyCrops,
    ...(migratedPlots === undefined ? {} : { plots: migratedPlots }),
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
    if (isValidState(parsed)) {
      const phaseMissing = !Object.hasOwn(parsed.quests, 'phase');
      const merged = mergeDefaults(createInitialState(), parsed);
      return {
        state: normalizeQuestLifecycle(merged, createInitialState, phaseMissing),
        migrated: false,
      };
    }
    if (!isPlainObject(parsed) || parsed.schemaVersion !== 0 || !isJsonSafe(parsed)) return null;

    const migrated = normalizeQuestLifecycle(
      migrateVersionZero(parsed, createInitialState),
      createInitialState,
      !Object.hasOwn(parsed.quests ?? {}, 'phase'),
    );
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
    let priorSerialized = null;
    let priorBackup = null;
    let backupAttempted = false;
    let primaryAttempted = false;

    try {
      if (!isValidState(state)) {
        this.lastStatus = 'invalid';
        return false;
      }

      const serialized = JSON.stringify(state);
      const roundTripped = JSON.parse(serialized);
      if (!isValidState(roundTripped) || !isStructurallyEqual(state, roundTripped)) {
        this.lastStatus = 'invalid';
        return false;
      }

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
