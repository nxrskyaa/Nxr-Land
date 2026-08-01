import { deepFreeze } from '../utils/deepFreeze.js';

export const QUESTS = deepFreeze([
  {
    id: 'chapter-1-arrive', chapter: 1, order: 1, title: 'A New Patch of Sky',
    objective: 'Walk into Town Plaza and meet Mira.', destination: 'Town Plaza',
    event: { type: 'location:entered', target: 'town-plaza' },
    progress: { metric: 'visits', required: 1 }, reward: { coin: 20 },
    dialogue: { start: ['Follow the lantern path into the village.'], complete: ['Welcome to Nxr Land. We have been waiting for a new gardener.'] },
  },
  {
    id: 'chapter-1-clear-garden', chapter: 1, order: 2, title: 'Room to Grow',
    objective: 'Clear three weeds from the home garden.', destination: 'Home Plot',
    event: { type: 'garden:cleared', target: 'weed' },
    progress: { metric: 'weedsCleared', required: 3 }, reward: { coin: 25, items: { 'seed-turnip': 3 } },
    dialogue: { start: ['The soil is hiding beneath those weeds.'], complete: ['There it is—good earth and a fresh beginning.'] },
  },
  {
    id: 'chapter-1-plant-crop', chapter: 1, order: 3, title: 'First Roots',
    objective: 'Till, plant, and water your first crop.', destination: 'Home Plot garden',
    event: { type: 'crop:watered', target: 'any-crop' },
    progress: { metric: 'wateredCrops', required: 1 }, reward: { coin: 30, items: { 'seed-carrot': 2 } },
    dialogue: { start: ['Plant the seeds Mira gave you and offer them a drink.'], complete: ['A tiny root has taken hold. Heartroot felt that.'] },
  },
  {
    id: 'chapter-1-reopen-market', chapter: 1, order: 4, title: 'Market Morning',
    objective: 'Bring Tomo one harvested crop to reopen the market.', destination: 'Market Lane',
    event: { type: 'item:sold', target: 'produce-any' },
    progress: { metric: 'produceSold', required: 1 }, reward: { coin: 50, unlock: 'market' },
    dialogue: { start: ['Tomo needs fresh produce before the shutters can rise.'], complete: ['Fresh shelves, open doors—the market is back!'] },
  },
  {
    id: 'chapter-1-find-spirit-seed', chapter: 1, order: 5, title: 'Whisper by the River',
    objective: 'Find the Spirit Seed glowing in River Garden.', destination: 'River Garden',
    event: { type: 'item:collected', target: 'spirit-seed' },
    progress: { metric: 'spiritSeedsFound', required: 1 }, reward: { coin: 40, items: { 'gacha-ticket': 1 } },
    dialogue: { start: ['Lumi heard a soft chime beyond the bridge.'], complete: ['This seed carries an old, warm heartbeat.'] },
  },
  {
    id: 'chapter-1-hatch-first-pet', chapter: 1, order: 6, title: 'A Little Companion',
    objective: 'Bring the Spirit Seed to Lumi and hatch your first pet.', destination: 'Lumi’s research nook',
    event: { type: 'pet:hatched', target: 'starter-pet' },
    progress: { metric: 'petsHatched', required: 1 }, reward: { coin: 40, unlock: 'pet-gacha' },
    dialogue: { start: ['Lumi knows how to wake the friend sleeping inside.'], complete: ['Two bright eyes! You will not tend the land alone now.'] },
  },
  {
    id: 'chapter-1-rebuild-planter', chapter: 1, order: 7, title: 'Something We Build',
    objective: 'Place the rebuilt village planter in Town Plaza.', destination: 'Town Plaza',
    event: { type: 'building:placed', target: 'building-village-planter' },
    progress: { metric: 'plantersPlaced', required: 1 }, reward: { coin: 75, unlock: 'building-mode' },
    dialogue: { start: ['A planter made together will remind the village how to bloom.'], complete: ['The plaza already feels alive again.'] },
  },
  {
    id: 'chapter-1-restore-heartroot', chapter: 1, order: 8, title: 'Heartroot’s First Light',
    objective: 'Offer the Spirit Seed’s light to Heartroot.', destination: 'Heartroot, Town Plaza',
    event: { type: 'heartroot:restored', target: 'first-light' },
    progress: { metric: 'lightsRestored', required: 1 }, reward: { coin: 150, wardrobe: ['wardrobe-top-heartroot-jacket'], unlock: 'land-expansions' },
    dialogue: { start: ['Carry your shared spark to the sleeping tree.'], complete: ['One light has returned. Nxr Land remembers how to hope.'] },
  },
]);

export const QUEST_BY_ID = deepFreeze(Object.fromEntries(QUESTS.map((quest) => [quest.id, quest])));
