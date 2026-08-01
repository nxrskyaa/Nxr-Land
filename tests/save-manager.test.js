import { describe, expect, it } from 'vitest';
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

  it('reset explicitly persists and returns independent initial state while retaining prior save as backup', () => {
    const prior = createInitialState();
    prior.economy.coin = 500;
    const priorSerialized = JSON.stringify(prior);
    const storage = createStorage({ [PRIMARY_SAVE_KEY]: priorSerialized });
    const manager = createManager(storage);

    const resetState = manager.reset();
    resetState.economy.coin = 0;

    expect(JSON.parse(storage.getItem(PRIMARY_SAVE_KEY))).toEqual(createInitialState());
    expect(storage.getItem(BACKUP_SAVE_KEY)).toBe(priorSerialized);
    expect(manager.lastStatus).toBe('reset');
  });
});
