import { QUESTS } from '../data/quests.js';

const INITIAL_DAY = 1;
const INITIAL_TIME_OF_DAY_MS = 28_800_000;
const INITIAL_PLOT_COUNT = 6;
const STARTING_COIN = 50;

const INITIAL_PLAYTIME_REWARD_TRACK = [
  { minutes: 5, reward: { coin: 20, items: { 'seed-turnip': 2 } } },
  { minutes: 15, reward: { items: { 'wardrobe-ticket': 1 } } },
  { minutes: 30, reward: { coin: 35, items: { 'pet-treat': 1 } } },
  { minutes: 45, reward: { items: { 'gacha-ticket': 1 } } },
  { minutes: 60, reward: { items: { 'rare-chest': 1 } } },
];

const INITIAL_DAILY_REWARD_TRACK = [
  { day: 1, reward: { coin: 30 } },
  { day: 2, reward: { items: { 'seed-pack': 1 } } },
  { day: 3, reward: { items: { 'wardrobe-ticket': 1 } } },
  { day: 4, reward: { coin: 60 } },
  { day: 5, reward: { items: { 'pet-treat': 1 } } },
  { day: 6, reward: { items: { 'gacha-ticket': 1 } } },
  { day: 7, reward: { items: { 'rare-chest': 1 } } },
];

function cloneReward(reward) {
  return {
    ...reward,
    ...(reward.items ? { items: { ...reward.items } } : {}),
  };
}

function cloneRewardTrack(track, includeClaimStatus = false) {
  return track.map((entry) => ({
    ...entry,
    ...(includeClaimStatus ? { claimed: false } : {}),
    reward: cloneReward(entry.reward),
  }));
}

function createPlots() {
  return Array.from({ length: INITIAL_PLOT_COUNT }, (_, index) => ({
    id: `home-plot-${index + 1}`,
    state: 'empty',
    cropId: null,
    plantedAt: null,
    wateredAt: null,
    growthStartedAt: null,
  }));
}

export function createInitialState() {
  return {
    schemaVersion: 1,
    player: {
      name: 'New Gardener',
      creatorComplete: false,
      appearance: {
        skinTone: '#d99b72',
        hairStyle: 'meadow-bob',
        hairColor: '#49352f',
        top: '#dc786b',
        bottom: '#536f72',
        shoes: '#5a4038',
        accessory: 'leaf-pin',
      },
      position: { x: 0, y: 0, z: 4 },
    },
    world: {
      day: INITIAL_DAY,
      timeOfDayMs: INITIAL_TIME_OF_DAY_MS,
      elapsedMs: 0,
      weather: 'clear',
      ownedLand: ['home-plot'],
      placedBuildings: [],
      unlocks: [],
      upgrades: { houseLevel: 1 },
    },
    crops: {
      plots: createPlots(),
    },
    economy: {
      coin: STARTING_COIN,
      selectedHotbarId: 'tool-hoe',
      inventory: {
        'tool-hoe': 1,
        'tool-watering-can': 1,
        'tool-axe': 1,
        'seed-turnip': 3,
      },
    },
    collection: {
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
      interactedIds: [],
      progress: Object.fromEntries(QUESTS.map((quest) => [quest.id, 0])),
    },
    rewards: {
      daily: {
        lastClaimDate: null,
        streak: 0,
        claimedDays: [],
        track: cloneRewardTrack(INITIAL_DAILY_REWARD_TRACK),
      },
      playtime: {
        milestones: cloneRewardTrack(INITIAL_PLAYTIME_REWARD_TRACK, true),
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
