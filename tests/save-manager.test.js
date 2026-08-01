import { describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../src/game/createState.js';
import {
  BACKUP_SAVE_KEY,
  PRIMARY_SAVE_KEY,
  SaveManager,
} from '../src/game/SaveManager.js';

function createStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    values,
  };
}

function createManager(storage) {
  return new SaveManager({ storage, createInitialState });
}

describe('SaveManager', () => {
  it('exports the exact stable storage key strings', () => {
    expect(PRIMARY_SAVE_KEY).toBe('nxr-land-save-v1');
    expect(BACKUP_SAVE_KEY).toBe('nxr-land-save-v1-backup');
  });

  it('saves schema-version-1 state through an injected storage adapter', () => {
    const storage = createStorage();
    const manager = createManager(storage);
    const state = createInitialState();
    state.economy.coin = 275;

    expect(manager.save(state)).toBe(true);
    expect(JSON.parse(storage.getItem(PRIMARY_SAVE_KEY))).toEqual(state);
    expect(storage.getItem(BACKUP_SAVE_KEY)).toBeNull();
  });

  it('rejects invalid, incomplete, or non-JSON-safe state without changing storage', () => {
    const original = JSON.stringify(createInitialState());
    const storage = createStorage({ [PRIMARY_SAVE_KEY]: original });
    const manager = createManager(storage);
    const incomplete = createInitialState();
    delete incomplete.quests;
    const unsafe = createInitialState();
    unsafe.player.badValue = undefined;

    expect(manager.save(incomplete)).toBe(false);
    expect(manager.save(unsafe)).toBe(false);
    expect(manager.save({ ...createInitialState(), schemaVersion: 2 })).toBe(false);
    expect(storage.getItem(PRIMARY_SAVE_KEY)).toBe(original);
  });

  it('rejects sparse crop plots as lossy JSON without changing storage', () => {
    const originalPrimary = JSON.stringify(createInitialState());
    const originalBackup = JSON.stringify({ ...createInitialState(), schemaVersion: 1 });
    const storage = createStorage({
      [PRIMARY_SAVE_KEY]: originalPrimary,
      [BACKUP_SAVE_KEY]: originalBackup,
    });
    const manager = createManager(storage);
    const sparse = createInitialState();
    sparse.crops.plots = Array(2);

    expect(manager.save(sparse)).toBe(false);
    expect(manager.lastStatus).toBe('invalid');
    expect(storage.getItem(PRIMARY_SAVE_KEY)).toBe(originalPrimary);
    expect(storage.getItem(BACKUP_SAVE_KEY)).toBe(originalBackup);
  });

  it('rejects arrays with enumerable non-index properties without changing storage', () => {
    const originalPrimary = JSON.stringify(createInitialState());
    const originalBackup = 'exact-backup';
    const storage = createStorage({
      [PRIMARY_SAVE_KEY]: originalPrimary,
      [BACKUP_SAVE_KEY]: originalBackup,
    });
    const manager = createManager(storage);
    const state = createInitialState();
    state.crops.plots.extraProgress = 3;

    expect(manager.save(state)).toBe(false);
    expect(manager.lastStatus).toBe('invalid');
    expect(storage.getItem(PRIMARY_SAVE_KEY)).toBe(originalPrimary);
    expect(storage.getItem(BACKUP_SAVE_KEY)).toBe(originalBackup);
  });

  it.each([
    ['player position', (state) => { state.player.position.x = Number.POSITIVE_INFINITY; }],
    ['world day', (state) => { state.world.day = 0; }],
    ['world time', (state) => { state.world.timeOfDayMs = Number.NaN; }],
    ['world weather', (state) => { state.world.weather = null; }],
    ['owned land', (state) => { state.world.ownedLand = ['home-plot', 2]; }],
    ['placed buildings', (state) => { state.world.placedBuildings = {}; }],
    ['world upgrades', (state) => { state.world.upgrades = []; }],
    ['plot id', (state) => { state.crops.plots[0].id = 1; }],
    ['plot state', (state) => { state.crops.plots[0].state = 'teleporting'; }],
    ['plot crop id', (state) => { state.crops.plots[0].cropId = 7; }],
    ['plot planted timestamp', (state) => { state.crops.plots[0].plantedAt = Number.NaN; }],
    ['plot watered timestamp', (state) => { state.crops.plots[0].wateredAt = 'today'; }],
    ['coin', (state) => { state.economy.coin = -1; }],
    ['inventory shape', (state) => { state.economy.inventory = []; }],
    ['inventory quantity', (state) => { state.economy.inventory['seed-turnip'] = 1.5; }],
    ['pets', (state) => { state.collection.pets = ['pet', null]; }],
    ['wardrobe', (state) => { state.collection.wardrobe = {}; }],
    ['equipped', (state) => { state.collection.equipped = null; }],
    ['active quest', (state) => { state.quests.activeId = 9; }],
    ['completed quests', (state) => { state.quests.completedIds = ['done', 4]; }],
    ['quest progress', (state) => { state.quests.progress.intro = -1; }],
    ['daily rewards', (state) => { state.rewards.daily = []; }],
    ['daily reward track', (state) => { state.rewards.daily.track = {}; }],
    ['playtime rewards', (state) => { state.rewards.playtime = []; }],
    ['playtime milestones', (state) => { state.rewards.playtime.milestones = {}; }],
    ['gacha pity', (state) => { state.gacha.pity.pet = -1; }],
    ['style dust', (state) => { state.gacha.styleDust = Number.POSITIVE_INFINITY; }],
    ['audio settings', (state) => { state.settings.audio = []; }],
    ['graphics settings', (state) => { state.settings.graphics = null; }],
    ['control settings', (state) => { state.settings.controls = 'touch'; }],
    ['total playtime', (state) => { state.playtime.totalMs = -1; }],
    ['daily playtime', (state) => { state.playtime.dailyActiveMs = Number.NaN; }],
    ['active date', (state) => { state.playtime.lastActiveDate = 123; }],
  ])('rejects an invalid nested %s contract', (_name, mutate) => {
    const originalPrimary = JSON.stringify(createInitialState());
    const originalBackup = 'preserved-backup';
    const storage = createStorage({
      [PRIMARY_SAVE_KEY]: originalPrimary,
      [BACKUP_SAVE_KEY]: originalBackup,
    });
    const state = createInitialState();
    mutate(state);

    expect(createManager(storage).save(state)).toBe(false);
    expect(storage.getItem(PRIMARY_SAVE_KEY)).toBe(originalPrimary);
    expect(storage.getItem(BACKUP_SAVE_KEY)).toBe(originalBackup);
  });

  it.each([
    ['player name', (state) => { state.player.name = ''; }],
    ['player appearance shape', (state) => { state.player.appearance = []; }],
    ['player skin tone', (state) => { state.player.appearance.skinTone = ''; }],
    ['player hair style', (state) => { state.player.appearance.hairStyle = 4; }],
    ['player hair color', (state) => { state.player.appearance.hairColor = ''; }],
    ['placed building shape', (state) => { state.world.placedBuildings = [null]; }],
    ['placed building identity', (state) => { state.world.placedBuildings = [{ x: 1, z: 2 }]; }],
    ['placed building x', (state) => { state.world.placedBuildings = [{ id: 'shed', x: NaN, z: 2 }]; }],
    ['placed building z', (state) => { state.world.placedBuildings = [{ buildingId: 'shed', x: 1, z: Infinity }]; }],
    ['placed building rotation', (state) => { state.world.placedBuildings = [{ id: 'shed', x: 1, z: 2, rotation: 'north' }]; }],
    ['house upgrade level', (state) => { state.world.upgrades.houseLevel = 0; }],
    ['empty pet id', (state) => { state.collection.pets = ['']; }],
    ['empty wardrobe id', (state) => { state.collection.wardrobe = ['']; }],
    ['equipped pet id', (state) => { state.collection.equipped.petId = 3; }],
    ['equipped wardrobe shape', (state) => { state.collection.equipped.wardrobe = []; }],
    ['missing equipped wardrobe slot', (state) => { delete state.collection.equipped.wardrobe.hair; }],
    ['equipped wardrobe slot value', (state) => { state.collection.equipped.wardrobe.top = ''; }],
    ['quest chapter', (state) => { state.quests.chapter = 1.5; }],
    ['quest progress value', (state) => { state.quests.progress.intro = Infinity; }],
    ['daily reward streak', (state) => { state.rewards.daily.streak = 1.5; }],
    ['daily claimed day', (state) => { state.rewards.daily.claimedDays = [true]; }],
    ['daily reward day', (state) => { state.rewards.daily.track[0].day = 0; }],
    ['daily reward shape', (state) => { state.rewards.daily.track[0].reward = []; }],
    ['unknown reward field', (state) => { state.rewards.daily.track[0].reward.xp = 10; }],
    ['negative reward coin', (state) => { state.rewards.daily.track[0].reward.coin = -1; }],
    ['fractional reward item quantity', (state) => { state.rewards.daily.track[0].reward.items = { seed: 0.5 }; }],
    ['playtime milestone minutes', (state) => { state.rewards.playtime.milestones[0].minutes = 0; }],
    ['playtime milestone claimed flag', (state) => { state.rewards.playtime.milestones[0].claimed = 1; }],
    ['pet pity count', (state) => { state.gacha.pity.pet = 0.5; }],
    ['wardrobe pity count', (state) => { state.gacha.pity.wardrobe = -1; }],
    ['audio master volume', (state) => { state.settings.audio.master = 1.01; }],
    ['audio music volume', (state) => { state.settings.audio.music = -0.01; }],
    ['audio effects volume', (state) => { state.settings.audio.effects = NaN; }],
    ['graphics shadows', (state) => { state.settings.graphics.shadows = 'yes'; }],
    ['graphics quality', (state) => { state.settings.graphics.quality = 2; }],
    ['touch controls', (state) => { state.settings.controls.touch = null; }],
    ['reduced motion', (state) => { state.settings.controls.reducedMotion = 0; }],
    ['empty inventory id', (state) => { state.economy.inventory[''] = 1; }],
  ])('rejects malformed authoritative %s fields without touching storage', (_name, mutate) => {
    const originalPrimary = JSON.stringify(createInitialState());
    const originalBackup = 'preserved-backup';
    const storage = createStorage({
      [PRIMARY_SAVE_KEY]: originalPrimary,
      [BACKUP_SAVE_KEY]: originalBackup,
    });
    const state = createInitialState();
    mutate(state);

    const manager = createManager(storage);
    expect(manager.save(state)).toBe(false);
    expect(manager.lastStatus).toBe('invalid');
    expect(storage.getItem(PRIMARY_SAVE_KEY)).toBe(originalPrimary);
    expect(storage.getItem(BACKUP_SAVE_KEY)).toBe(originalBackup);
  });

  it('accepts the valid baseline, building identity variants, claimed-day forms, and safe future fields', () => {
    const storage = createStorage();
    const manager = createManager(storage);
    const state = createInitialState();
    state.world.placedBuildings = [
      { id: 'shed-instance', x: 1, z: 2 },
      { buildingId: 'barn', x: -3, z: 4, rotation: 1.5 },
    ];
    state.rewards.daily.claimedDays = [1, '2026-08-01'];
    state.player.futureField = { enabled: true };

    expect(manager.save(state)).toBe(true);
    expect(manager.load()).toEqual(state);
  });

  it.each([
    ['enumerable toJSON', (state) => { state.player.toJSON = () => null; }],
    ['non-enumerable toJSON', (state) => {
      Object.defineProperty(state.player, 'toJSON', { value: () => null });
    }],
    ['nested non-enumerable field', (state) => {
      Object.defineProperty(state.player, 'hidden', { value: 'lost' });
    }],
    ['negative zero', (state) => { state.player.position.x = -0; }],
  ])('rejects lossy serialization from %s without touching storage', (_name, mutate) => {
    const originalPrimary = JSON.stringify(createInitialState());
    const originalBackup = 'preserved-backup';
    const storage = createStorage({
      [PRIMARY_SAVE_KEY]: originalPrimary,
      [BACKUP_SAVE_KEY]: originalBackup,
    });
    const state = createInitialState();
    mutate(state);

    const manager = createManager(storage);
    expect(manager.save(state)).toBe(false);
    expect(storage.getItem(PRIMARY_SAVE_KEY)).toBe(originalPrimary);
    expect(storage.getItem(BACKUP_SAVE_KEY)).toBe(originalBackup);
  });

  it('contains throwing accessors as save errors without reading or changing storage', () => {
    const originalPrimary = JSON.stringify(createInitialState());
    const originalBackup = 'preserved-backup';
    const storage = createStorage({
      [PRIMARY_SAVE_KEY]: originalPrimary,
      [BACKUP_SAVE_KEY]: originalBackup,
    });
    const state = createInitialState();
    Object.defineProperty(state.player, 'name', {
      enumerable: true,
      get() { throw new Error('hostile getter'); },
    });

    const manager = createManager(storage);
    expect(() => manager.save(state)).not.toThrow();
    expect(manager.lastStatus).toBe('error');
    expect(storage.getItem(PRIMARY_SAVE_KEY)).toBe(originalPrimary);
    expect(storage.getItem(BACKUP_SAVE_KEY)).toBe(originalBackup);
  });

  it('rejects dangerous object keys during save and migration without prototype mutation', () => {
    const storage = createStorage();
    const manager = createManager(storage);
    const state = createInitialState();
    Object.defineProperty(state.economy.inventory, '__proto__', {
      value: { polluted: true },
      enumerable: true,
    });

    expect(manager.save(state)).toBe(false);
    expect({}.polluted).toBeUndefined();

    const legacy = JSON.parse('{"schemaVersion":0,"player":{"name":"Legacy","constructor":{"prototype":{"polluted":true}}}}');
    storage.setItem(PRIMARY_SAVE_KEY, JSON.stringify(legacy));

    expect(manager.load()).toEqual(createInitialState());
    expect(manager.lastStatus).toBe('fresh');
    expect({}.polluted).toBeUndefined();
  });

  it('copies the exact prior valid primary to backup before replacement', () => {
    const priorState = createInitialState();
    priorState.economy.coin = 111;
    const exactPrior = `${JSON.stringify(priorState, null, 2)}\n`;
    const storage = createStorage({ [PRIMARY_SAVE_KEY]: exactPrior });
    const manager = createManager(storage);
    const nextState = createInitialState();
    nextState.economy.coin = 222;

    manager.save(nextState);

    expect(storage.getItem(BACKUP_SAVE_KEY)).toBe(exactPrior);
    expect(JSON.parse(storage.getItem(PRIMARY_SAVE_KEY)).economy.coin).toBe(222);
  });

  it('does not overwrite a valid backup when the primary is corrupt', () => {
    const backup = JSON.stringify({ ...createInitialState(), economy: { coin: 808, inventory: {} } });
    const storage = createStorage({
      [PRIMARY_SAVE_KEY]: '{broken',
      [BACKUP_SAVE_KEY]: backup,
    });
    const manager = createManager(storage);

    manager.save(createInitialState());

    expect(storage.getItem(BACKUP_SAVE_KEY)).toBe(backup);
  });

  it('leaves exact primary and backup values unchanged when backup writing fails', () => {
    const prior = JSON.stringify(createInitialState(), null, 2);
    const backup = 'exact old backup';
    const storage = createStorage({ [PRIMARY_SAVE_KEY]: prior, [BACKUP_SAVE_KEY]: backup });
    const setItem = storage.setItem;
    let failed = false;
    storage.setItem = vi.fn((key, value) => {
      const result = setItem(key, value);
      if (key === BACKUP_SAVE_KEY && !failed) {
        failed = true;
        throw new Error('backup unavailable');
      }
      return result;
    });
    const manager = createManager(storage);

    expect(manager.save({ ...createInitialState(), economy: { coin: 99, inventory: {} } })).toBe(false);
    expect(manager.lastStatus).toBe('error');
    expect(storage.getItem(PRIMARY_SAVE_KEY)).toBe(prior);
    expect(storage.getItem(BACKUP_SAVE_KEY)).toBe(backup);
  });

  it.each([
    ['an existing backup', 'exact old backup'],
    ['no backup', undefined],
  ])('restores %s when primary writing fails after backup replacement', (_name, oldBackup) => {
    const prior = `${JSON.stringify(createInitialState())}\n`;
    const entries = { [PRIMARY_SAVE_KEY]: prior };
    if (oldBackup !== undefined) entries[BACKUP_SAVE_KEY] = oldBackup;
    const storage = createStorage(entries);
    const setItem = storage.setItem;
    let failed = false;
    storage.setItem = vi.fn((key, value) => {
      const result = setItem(key, value);
      if (key === PRIMARY_SAVE_KEY && !failed) {
        failed = true;
        throw new Error('primary unavailable');
      }
      return result;
    });
    const manager = createManager(storage);

    expect(manager.save({ ...createInitialState(), economy: { coin: 99, inventory: {} } })).toBe(false);
    expect(manager.lastStatus).toBe('error');
    expect(storage.getItem(PRIMARY_SAVE_KEY)).toBe(prior);
    expect(storage.getItem(BACKUP_SAVE_KEY)).toBe(oldBackup ?? null);
  });

  it('loads valid primary state as a fresh deep-independent parse each time', () => {
    const saved = createInitialState();
    saved.player.name = 'Mira';
    const storage = createStorage({ [PRIMARY_SAVE_KEY]: JSON.stringify(saved) });
    const manager = createManager(storage);

    const first = manager.load();
    first.player.name = 'Changed';
    first.crops.plots[0].state = 'growing';
    const second = manager.load();

    expect(second.player.name).toBe('Mira');
    expect(second.crops.plots[0].state).toBe('empty');
    expect(manager.lastStatus).toBe('loaded');
  });

  it('recovers from a valid backup without replacing the corrupt primary', () => {
    const backupState = createInitialState();
    backupState.economy.coin = 909;
    const corruptPrimary = '{not-json';
    const storage = createStorage({
      [PRIMARY_SAVE_KEY]: corruptPrimary,
      [BACKUP_SAVE_KEY]: JSON.stringify(backupState),
    });
    const manager = createManager(storage);

    const loaded = manager.load();

    expect(loaded.economy.coin).toBe(909);
    expect(manager.lastStatus).toBe('recovered');
    expect(storage.getItem(PRIMARY_SAVE_KEY)).toBe(corruptPrimary);
  });

  it('falls back to backup when reading primary throws', () => {
    const backupState = createInitialState();
    backupState.economy.coin = 404;
    const storage = createStorage({ [BACKUP_SAVE_KEY]: JSON.stringify(backupState) });
    const getItem = storage.getItem;
    storage.getItem = (key) => {
      if (key === PRIMARY_SAVE_KEY) throw new Error('primary read failed');
      return getItem(key);
    };
    const manager = createManager(storage);

    expect(manager.load().economy.coin).toBe(404);
    expect(manager.lastStatus).toBe('recovered');
  });

  it('returns fresh state when both storage reads throw', () => {
    const storage = createStorage();
    storage.getItem = () => { throw new Error('storage unavailable'); };
    const manager = createManager(storage);

    expect(manager.load()).toEqual(createInitialState());
    expect(manager.lastStatus).toBe('fresh');
  });

  it('returns independent fresh state and preserves invalid strings when no save is usable', () => {
    const invalidPrimary = JSON.stringify({ schemaVersion: 1, player: {} });
    const invalidBackup = 'null';
    const storage = createStorage({
      [PRIMARY_SAVE_KEY]: invalidPrimary,
      [BACKUP_SAVE_KEY]: invalidBackup,
    });
    const manager = createManager(storage);

    const first = manager.load();
    first.economy.coin = 0;
    const second = manager.load();

    expect(second).toEqual(createInitialState());
    expect(second.economy.coin).toBe(50);
    expect(manager.lastStatus).toBe('fresh');
    expect(storage.getItem(PRIMARY_SAVE_KEY)).toBe(invalidPrimary);
    expect(storage.getItem(BACKUP_SAVE_KEY)).toBe(invalidBackup);
  });

  it('migrates schema version 0 while preserving progress and filling defaults', () => {
    const defaults = createInitialState();
    const legacyPlots = [{ id: 'legacy-plot', state: 'ready', cropId: 'pumpkin' }];
    const legacy = {
      schemaVersion: 0,
      player: { name: 'Legacy Gardener' },
      world: { day: 37, plots: legacyPlots },
      economy: { coin: 1234, inventory: { 'seed-pumpkin': 9 } },
      collections: { pets: ['pet-moss-fox'], wardrobe: ['legacy-hat'] },
      quests: { chapter: 1, completedIds: ['chapter-1-arrive'] },
      rewards: {
        playtime: {
          activeMs: 4567,
          date: '2026-07-31',
          totalMs: 9876,
          milestones: [{ minutes: 5, claimed: true, reward: { coin: 20 } }],
        },
      },
      gacha: { pity: { pet: 7 } },
      playtime: { totalMs: 12000 },
    };
    const storage = createStorage({ [PRIMARY_SAVE_KEY]: JSON.stringify(legacy) });
    const manager = createManager(storage);

    const migrated = manager.load();

    expect(migrated.schemaVersion).toBe(1);
    expect(migrated.player).toEqual(expect.objectContaining({
      name: 'Legacy Gardener',
      appearance: defaults.player.appearance,
    }));
    expect(migrated.world.day).toBe(37);
    expect(migrated.world).not.toHaveProperty('plots');
    expect(migrated.crops.plots).toEqual(legacyPlots);
    expect(migrated.economy).toEqual(expect.objectContaining({
      coin: 1234,
      inventory: expect.objectContaining({ 'seed-pumpkin': 9 }),
    }));
    expect(migrated.collection.pets).toEqual(['pet-moss-fox']);
    expect(migrated).not.toHaveProperty('collections');
    expect(migrated.quests.completedIds).toEqual(['chapter-1-arrive']);
    expect(migrated.quests.activeId).toBe(defaults.quests.activeId);
    expect(migrated.gacha.pity).toEqual({ pet: 7, wardrobe: 0 });
    expect(migrated.playtime).toEqual({
      totalMs: 12000,
      dailyActiveMs: 4567,
      lastActiveDate: '2026-07-31',
    });
    expect(migrated.rewards.playtime.milestones).toEqual(legacy.rewards.playtime.milestones);
    expect(migrated.rewards.playtime).not.toHaveProperty('activeMs');
    expect(migrated.rewards.playtime).not.toHaveProperty('date');
    expect(migrated.rewards.playtime).not.toHaveProperty('totalMs');
    expect(migrated.settings).toEqual(defaults.settings);
    expect(manager.lastStatus).toBe('migrated');
  });

  it('clear removes only primary by default and can explicitly include backup', () => {
    const storage = createStorage({
      [PRIMARY_SAVE_KEY]: JSON.stringify(createInitialState()),
      [BACKUP_SAVE_KEY]: JSON.stringify(createInitialState()),
    });
    const manager = createManager(storage);

    manager.clear();
    expect(storage.getItem(PRIMARY_SAVE_KEY)).toBeNull();
    expect(storage.getItem(BACKUP_SAVE_KEY)).not.toBeNull();

    manager.clear({ includeBackup: true });
    expect(storage.getItem(BACKUP_SAVE_KEY)).toBeNull();
  });

  it('reports partial clear failure without claiming rollback', () => {
    const backup = JSON.stringify(createInitialState());
    const storage = createStorage({
      [PRIMARY_SAVE_KEY]: JSON.stringify(createInitialState()),
      [BACKUP_SAVE_KEY]: backup,
    });
    const removeItem = storage.removeItem;
    storage.removeItem = (key) => {
      if (key === BACKUP_SAVE_KEY) throw new Error('backup removal failed');
      return removeItem(key);
    };
    const manager = createManager(storage);

    expect(manager.clear({ includeBackup: true })).toBe(false);
    expect(manager.lastStatus).toBe('error');
    expect(storage.getItem(PRIMARY_SAVE_KEY)).toBeNull();
    expect(storage.getItem(BACKUP_SAVE_KEY)).toBe(backup);
  });

  it('reset explicitly persists and returns independent initial state while retaining prior save as backup', () => {
    const prior = createInitialState();
    prior.economy.coin = 500;
    const priorSerialized = JSON.stringify(prior);
    const storage = createStorage({ [PRIMARY_SAVE_KEY]: priorSerialized });
    const manager = createManager(storage);

    const result = manager.reset();
    result.state.economy.coin = 0;

    expect(result.ok).toBe(true);
    expect(JSON.parse(storage.getItem(PRIMARY_SAVE_KEY))).toEqual(createInitialState());
    expect(storage.getItem(BACKUP_SAVE_KEY)).toBe(priorSerialized);
    expect(manager.lastStatus).toBe('reset');
  });

  it('returns an unambiguous failed reset result and retains error status', () => {
    const storage = createStorage();
    storage.setItem = () => { throw new Error('storage full'); };
    const manager = createManager(storage);

    const result = manager.reset();

    expect(result).toEqual({ ok: false, state: createInitialState() });
    expect(manager.lastStatus).toBe('error');
  });
});
