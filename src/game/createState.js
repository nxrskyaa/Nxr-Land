import { QUESTS } from '../data/quests.js';

const PLAYTIME_REWARDS = [
  { minutes: 5, reward: { coin: 20, items: { 'seed-turnip': 2 } } },
  { minutes: 15, reward: { items: { 'wardrobe-ticket': 1 } } },
  { minutes: 30, reward: { coin: 35, items: { 'pet-treat': 1 } } },
  { minutes: 45, reward: { items: { 'gacha-ticket': 1 } } },
  { minutes: 60, reward: { items: { 'rare-chest': 1 } } },
];

const DAILY_REWARDS = [
  { day: 1, reward: { coin: 30 } },
  { day: 2, reward: { items: { 'seed-pack': 1 } } },
  { day: 3, reward: { items: { 'wardrobe-ticket': 1 } } },
  { day: 4, reward: { coin: 60 } },
  { day: 5, reward: { items: { 'pet-treat': 1 } } },
  { day: 6, reward: { items: { 'gacha-ticket': 1 } } },
  { day: 7, reward: { items: { 'rare-chest': 1 } } },
];

function createPlots() {
  return Array.from({ length: 6 }, (_, index) => ({
    id: `home-plot-${index + 1}`,
    state: 'empty',
    cropId: null,
    plantedAt: null,
    wateredAt: null,
  }));
}

export function createInitialState() {
  return {
    schemaVersion: 1,
    player: {
      name: 'New Gardener',
      appearance: {
        skinTone: '#c98f68',
        hairStyle: 'wardrobe-hair-meadow-bob',
        hairColor: '#62493d',
      },
      position: { x: 0, y: 0, z: 4 },
    },
    world: {
      day: 1,
      timeOfDayMs: 28_800_000,
      weather: 'clear',
      ownedLand: ['home-plot'],
      plots: createPlots(),
      placedBuildings: [],
      upgrades: { houseLevel: 1 },
    },
    economy: {
      coin: 50,
      inventory: {
        'tool-hoe': 1,
        'tool-watering-can': 1,
        'tool-axe': 1,
        'seed-turnip': 3,
      },
    },
    collections: {
      pets: [],
      wardrobe: [
        'wardrobe-hair-meadow-bob',
        'wardrobe-top-garden-tee',
        'wardrobe-bottom-patch-shorts',
        'wardrobe-shoes-garden-clogs',
        'wardrobe-accessory-straw-hat',
      ],
      equipped: {
        petId: null,
        wardrobe: {
          hair: 'wardrobe-hair-meadow-bob',
          top: 'wardrobe-top-garden-tee',
          bottom: 'wardrobe-bottom-patch-shorts',
          shoes: 'wardrobe-shoes-garden-clogs',
          accessory: 'wardrobe-accessory-straw-hat',
        },
      },
    },
    quests: {
      chapter: 1,
      activeId: QUESTS[0].id,
      completedIds: [],
      progress: Object.fromEntries(QUESTS.map((quest) => [quest.id, 0])),
    },
    rewards: {
      daily: {
        lastClaimDate: null,
        streak: 0,
        claimedDays: [],
        track: DAILY_REWARDS.map((entry) => ({
          ...entry,
          reward: {
            ...entry.reward,
            ...(entry.reward.items ? { items: { ...entry.reward.items } } : {}),
          },
        })),
      },
      playtime: {
        date: null,
        activeMs: 0,
        milestones: PLAYTIME_REWARDS.map((entry) => ({
          ...entry,
          claimed: false,
          reward: {
            ...entry.reward,
            ...(entry.reward.items ? { items: { ...entry.reward.items } } : {}),
          },
        })),
      },
    },
    gacha: {
      pity: { pet: 0, wardrobe: 0 },
      styleDust: 0,
    },
    settings: {
      audio: { master: 0.8, music: 0.7, effects: 0.8 },
      graphics: { shadows: true, quality: 'auto' },
      controls: { touch: 'auto', reducedMotion: false },
    },
    playtime: {
      totalMs: 0,
      dailyActiveMs: 0,
      lastActiveDate: null,
    },
  };
}
