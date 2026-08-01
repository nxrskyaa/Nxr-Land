import { describe, expect, it } from 'vitest';
import { CROPS } from '../src/data/crops.js';
import {
  ITEM_BY_ID,
  ITEMS,
  TOOLS,
  WARDROBE,
  WARDROBE_BY_ID,
} from '../src/data/items.js';
import { PETS, PET_BY_ID } from '../src/data/pets.js';
import { BUILDINGS, BUILDING_BY_ID } from '../src/data/buildings.js';
import { QUESTS, QUEST_BY_ID } from '../src/data/quests.js';
import { createInitialState } from '../src/game/createState.js';
import { deepFreeze } from '../src/utils/deepFreeze.js';

function expectUniqueIds(entries) {
  const ids = entries.map(({ id }) => id);
  expect(new Set(ids).size).toBe(ids.length);
}

function expectNonEmptyString(value) {
  expect(typeof value).toBe('string');
  expect(value.trim().length).toBeGreaterThan(0);
}

function expectNonEmptyValues(collection) {
  const values = Array.isArray(collection) ? collection : Object.values(collection);
  expect(values.length).toBeGreaterThan(0);
  values.forEach(expectNonEmptyString);
}

function rewardItemIds(reward) {
  return Object.keys(reward.items ?? {});
}

function expectDeepFrozen(value) {
  expect(Object.isFrozen(value)).toBe(true);

  for (const nested of Object.values(value)) {
    if (nested && typeof nested === 'object') {
      expectDeepFrozen(nested);
    }
  }
}

describe('game catalogs', () => {
  it('defines exactly six immutable crops with complete visual growth data', () => {
    expect(CROPS).toHaveLength(6);
    expect(CROPS.map(({ id }) => id)).toEqual([
      'turnip',
      'carrot',
      'tomato',
      'strawberry',
      'pumpkin',
      'sunflower',
    ]);
    expectUniqueIds(CROPS);

    for (const crop of CROPS) {
      expect(crop).toEqual(expect.objectContaining({
        id: expect.any(String),
        label: expect.any(String),
        seedPrice: expect.any(Number),
        sellPrice: expect.any(Number),
        growthMs: expect.any(Number),
        stages: expect.any(Array),
        colors: expect.any(Object),
        form: expect.any(Object),
      }));
      expect(crop.seedPrice).toBeGreaterThan(0);
      expect(crop.sellPrice).toBeGreaterThan(crop.seedPrice);
      expect(crop.growthMs).toBeGreaterThan(0);
      expect(crop.stages.length).toBeGreaterThanOrEqual(3);
      expectNonEmptyString(crop.id);
      expectNonEmptyString(crop.label);
      expectNonEmptyValues(crop.colors);
    }

    expectDeepFrozen(CROPS);
  });

  it('defines tools and seed/produce items without copying crop definitions', () => {
    expect(TOOLS.map(({ id }) => id)).toEqual([
      'tool-hoe',
      'tool-watering-can',
      'tool-axe',
    ]);
    expect(ITEMS.length).toBeGreaterThan(TOOLS.length + (CROPS.length * 2));
    expectUniqueIds(ITEMS);

    for (const crop of CROPS) {
      expect(ITEMS).toContainEqual(expect.objectContaining({
        id: `seed-${crop.id}`,
        cropId: crop.id,
        type: 'seed',
      }));
      expect(ITEMS).toContainEqual(expect.objectContaining({
        id: `produce-${crop.id}`,
        cropId: crop.id,
        type: 'produce',
      }));
    }

    for (const item of ITEMS) {
      expectNonEmptyString(item.id);
      expectNonEmptyString(item.label);
      expectNonEmptyString(item.type);
      if ('price' in item) {
        expect(item.price).toBeGreaterThan(0);
      }
    }

    for (const id of [
      'seed-pack',
      'wardrobe-ticket',
      'pet-treat',
      'gacha-ticket',
      'rare-chest',
      'spirit-seed',
    ]) {
      expect(ITEMS).toContain(ITEM_BY_ID[id]);
      expect(ITEM_BY_ID[id]).toEqual(expect.objectContaining({
        id,
        label: expect.any(String),
        type: expect.any(String),
        rarity: expect.stringMatching(/^(common|rare|epic)$/),
        colors: expect.any(Array),
      }));
      expectNonEmptyValues(ITEM_BY_ID[id].colors);
    }

    expectDeepFrozen(ITEMS);
  });

  it('defines exactly eight immutable and distinct pets', () => {
    expect(PETS).toHaveLength(8);
    expectUniqueIds(PETS);

    for (const pet of PETS) {
      expect(pet).toEqual(expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String),
        rarity: expect.stringMatching(/^(common|rare|epic)$/),
        palette: expect.any(Object),
        shape: expect.any(Object),
        accessory: expect.any(Object),
        bonus: expect.any(Object),
      }));
      expectNonEmptyString(pet.id);
      expectNonEmptyString(pet.name);
      expectNonEmptyValues(pet.palette);
    }

    expect(new Set(PETS.map(({ name }) => name)).size).toBe(8);
    expectDeepFrozen(PETS);
  });

  it('defines twenty immutable wardrobe pieces across every appearance slot', () => {
    expect(WARDROBE).toHaveLength(20);
    expectUniqueIds(WARDROBE);
    expect(new Set(WARDROBE.map(({ slot }) => slot))).toEqual(
      new Set(['hair', 'top', 'bottom', 'shoes', 'accessory']),
    );

    for (const piece of WARDROBE) {
      expect(piece).toEqual(expect.objectContaining({
        id: expect.any(String),
        label: expect.any(String),
        slot: expect.any(String),
        rarity: expect.stringMatching(/^(common|rare|epic)$/),
        colors: expect.any(Array),
        source: expect.any(String),
      }));
      expect(piece.colors.length).toBeGreaterThan(0);
      expectNonEmptyString(piece.id);
      expectNonEmptyString(piece.label);
      expectNonEmptyValues(piece.colors);
    }

    expectDeepFrozen(WARDROBE);
  });

  it('defines exactly eight immutable placeables with placement metadata', () => {
    expect(BUILDINGS).toHaveLength(8);
    expectUniqueIds(BUILDINGS);

    for (const building of BUILDINGS) {
      expect(building).toEqual(expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String),
        price: expect.any(Number),
        size: expect.objectContaining({ width: expect.any(Number), depth: expect.any(Number) }),
        type: expect.any(String),
        palette: expect.any(Object),
      }));
      expectNonEmptyString(building.id);
      expectNonEmptyString(building.name);
      expect(building.price).toBeGreaterThan(0);
      expect(building.size.width).toBeGreaterThan(0);
      expect(building.size.depth).toBeGreaterThan(0);
      expectNonEmptyValues(building.palette);
    }

    expectDeepFrozen(BUILDINGS);
  });

  it('defines the eight ordered Chapter 1 quests as event-driven objectives', () => {
    expect(QUESTS).toHaveLength(8);
    expect(QUESTS.map(({ id }) => id)).toEqual([
      'chapter-1-arrive',
      'chapter-1-clear-garden',
      'chapter-1-plant-crop',
      'chapter-1-reopen-market',
      'chapter-1-find-spirit-seed',
      'chapter-1-hatch-first-pet',
      'chapter-1-rebuild-planter',
      'chapter-1-restore-heartroot',
    ]);
    expectUniqueIds(QUESTS);

    QUESTS.forEach((quest, index) => {
      expect(quest).toEqual(expect.objectContaining({
        id: expect.any(String),
        chapter: 1,
        order: index + 1,
        title: expect.any(String),
        objective: expect.any(String),
        event: expect.objectContaining({ type: expect.any(String), target: expect.any(String) }),
        progress: expect.objectContaining({ required: expect.any(Number) }),
        reward: expect.any(Object),
        dialogue: expect.objectContaining({ start: expect.any(Array), complete: expect.any(Array) }),
      }));
      expect(quest.progress.required).toBeGreaterThan(0);
      expectNonEmptyString(quest.id);
      expectNonEmptyString(quest.title);
      expectNonEmptyString(quest.objective);
    });

    expectDeepFrozen(QUESTS);
  });

  it('keeps IDs unique across catalogs that share inventory or reward namespaces', () => {
    expectUniqueIds([...CROPS, ...ITEMS, ...WARDROBE, ...PETS, ...BUILDINGS, ...QUESTS]);
  });

  it('deep-freezes values through the neutral utility module', () => {
    const value = deepFreeze({ nested: { values: ['leaf'] } });

    expectDeepFrozen(value);
  });
});

describe('createInitialState', () => {
  it('returns the complete schema-version-1 authoritative state', () => {
    const state = createInitialState();

    expect(state.schemaVersion).toBe(1);
    expect(state.player).toEqual(expect.objectContaining({
      name: expect.any(String),
      appearance: expect.any(Object),
      position: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number), z: expect.any(Number) }),
    }));
    expect(state.world).toEqual(expect.objectContaining({
      day: expect.any(Number),
      weather: expect.any(String),
      ownedLand: expect.any(Array),
      placedBuildings: expect.any(Array),
    }));
    expect(state.world).not.toHaveProperty('plots');
    expect(state.crops).toEqual(expect.objectContaining({
      plots: expect.any(Array),
    }));
    expect(state.economy).toEqual(expect.objectContaining({
      coin: expect.any(Number),
      inventory: expect.any(Object),
    }));
    expect(state.collection).toEqual(expect.objectContaining({
      pets: expect.any(Array),
      wardrobe: expect.any(Array),
      equipped: expect.objectContaining({
        petId: null,
        wardrobe: expect.any(Object),
      }),
    }));
    expect(state).not.toHaveProperty('collections');
    expect(state.quests).toEqual(expect.objectContaining({
      activeId: QUESTS[0].id,
      completedIds: [],
      progress: expect.any(Object),
    }));
    expect(state.rewards).toEqual(expect.objectContaining({
      daily: expect.any(Object),
      playtime: expect.objectContaining({
        milestones: expect.arrayContaining([
          expect.objectContaining({ minutes: 5 }),
          expect.objectContaining({ minutes: 15 }),
          expect.objectContaining({ minutes: 30 }),
          expect.objectContaining({ minutes: 45 }),
          expect.objectContaining({ minutes: 60 }),
        ]),
      }),
    }));
    expect(state.rewards.playtime.milestones.map(({ minutes }) => minutes)).toEqual([5, 15, 30, 45, 60]);
    expect(state.rewards.playtime).not.toHaveProperty('date');
    expect(state.rewards.playtime).not.toHaveProperty('activeMs');
    expect(state.gacha).toEqual(expect.objectContaining({
      pity: expect.objectContaining({ pet: expect.any(Number), wardrobe: expect.any(Number) }),
      styleDust: expect.any(Number),
    }));
    expect(state.settings).toEqual(expect.any(Object));
    expect(state.playtime).toEqual(expect.objectContaining({
      totalMs: expect.any(Number),
      dailyActiveMs: expect.any(Number),
      lastActiveDate: null,
    }));
  });

  it('resolves every catalog-backed state and reward reference', () => {
    const state = createInitialState();

    Object.keys(state.economy.inventory).forEach((id) => expect(ITEM_BY_ID[id]).toBeDefined());
    state.collection.wardrobe.forEach((id) => expect(WARDROBE_BY_ID[id]).toBeDefined());
    state.collection.pets.forEach((id) => expect(PET_BY_ID[id]).toBeDefined());
    state.world.placedBuildings.forEach(({ buildingId }) => expect(BUILDING_BY_ID[buildingId]).toBeDefined());

    for (const [slot, id] of Object.entries(state.collection.equipped.wardrobe)) {
      expect(WARDROBE_BY_ID[id]).toEqual(expect.objectContaining({ slot }));
    }
    if (state.collection.equipped.petId) {
      expect(PET_BY_ID[state.collection.equipped.petId]).toBeDefined();
    }

    expect(QUEST_BY_ID[state.quests.activeId]).toBeDefined();
    state.quests.completedIds.forEach((id) => expect(QUEST_BY_ID[id]).toBeDefined());
    Object.keys(state.quests.progress).forEach((id) => expect(QUEST_BY_ID[id]).toBeDefined());

    const trackedRewards = [
      ...state.rewards.daily.track.map(({ reward }) => reward),
      ...state.rewards.playtime.milestones.map(({ reward }) => reward),
      ...QUESTS.map(({ reward }) => reward),
    ];
    trackedRewards.flatMap(rewardItemIds).forEach((id) => expect(ITEM_BY_ID[id]).toBeDefined());
    QUESTS.flatMap(({ reward }) => reward.wardrobe ?? [])
      .forEach((id) => expect(WARDROBE_BY_ID[id]).toBeDefined());
    QUESTS.flatMap(({ reward }) => reward.pets ?? [])
      .forEach((id) => expect(PET_BY_ID[id]).toBeDefined());
    QUESTS.flatMap(({ reward }) => reward.buildings ?? [])
      .forEach((id) => expect(BUILDING_BY_ID[id]).toBeDefined());

    const catalogEventIndexes = {
      'item:collected': ITEM_BY_ID,
      'building:placed': BUILDING_BY_ID,
    };
    for (const quest of QUESTS) {
      const index = catalogEventIndexes[quest.event.type];
      if (index) {
        expect(index[quest.event.target]).toBeDefined();
      }
    }
  });

  it('collects one Spirit Seed without awarding a duplicate Spirit Seed', () => {
    const quest = QUEST_BY_ID['chapter-1-find-spirit-seed'];

    expect(quest.event).toEqual({ type: 'item:collected', target: 'spirit-seed' });
    expect(rewardItemIds(quest.reward)).not.toContain('spirit-seed');
  });

  it('returns deeply independent mutable state on every call', () => {
    const first = createInitialState();
    const second = createInitialState();

    first.player.appearance.hairColor = '#000000';
    first.player.position.x = 999;
    first.world.ownedLand.push('expansion-west');
    first.crops.plots[0].state = 'growing';
    first.economy.inventory['seed-turnip'] = 999;
    first.collection.wardrobe.push('wardrobe-test');
    first.quests.progress[first.quests.activeId] = 99;
    first.rewards.playtime.milestones[0].claimed = true;
    first.gacha.pity.pet = 99;
    first.settings.audio.music = 0;

    expect(second).toEqual(createInitialState());
    expect(second).not.toEqual(first);
  });

  it('contains only values represented by JSON', () => {
    const pending = [createInitialState()];

    while (pending.length > 0) {
      const value = pending.pop();
      expect(['undefined', 'function', 'symbol', 'bigint']).not.toContain(typeof value);
      if (value && typeof value === 'object') {
        pending.push(...Object.values(value));
      }
    }
  });

  it('survives a JSON round trip without losing data', () => {
    const state = createInitialState();

    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
