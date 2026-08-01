import { CROPS } from './crops.js';
import { deepFreeze } from '../utils/deepFreeze.js';

export const TOOLS = deepFreeze([
  { id: 'tool-hoe', label: 'Garden Hoe', type: 'tool', price: 20, action: 'till' },
  { id: 'tool-watering-can', label: 'Watering Can', type: 'tool', price: 25, action: 'water' },
  { id: 'tool-axe', label: 'Hand Axe', type: 'tool', price: 40, action: 'clear' },
]);

export const SEEDS = deepFreeze(CROPS.map((crop) => ({
  id: `seed-${crop.id}`,
  label: `${crop.label} Seeds`,
  type: 'seed',
  cropId: crop.id,
  price: crop.seedPrice,
})));

export const PRODUCE = deepFreeze(CROPS.map((crop) => ({
  id: `produce-${crop.id}`,
  label: crop.label,
  type: 'produce',
  cropId: crop.id,
  sellPrice: crop.sellPrice,
})));

export const REWARD_ITEMS = deepFreeze([
  { id: 'seed-pack', label: 'Garden Seed Pack', type: 'bundle', rarity: 'common', colors: ['#78b85a', '#f5eee3'] },
  { id: 'wardrobe-ticket', label: 'Wardrobe Ticket', type: 'ticket', rarity: 'rare', colors: ['#d8b7ef', '#f6df79'] },
  { id: 'pet-treat', label: 'Pet Treat', type: 'consumable', rarity: 'common', colors: ['#e4bd76', '#b46b58'] },
  { id: 'gacha-ticket', label: 'Companion Wish Ticket', type: 'ticket', rarity: 'rare', colors: ['#9bc7d0', '#cfbce8'] },
  { id: 'rare-chest', label: 'Rare Reward Chest', type: 'chest', rarity: 'rare', colors: ['#806caa', '#f2cc76'] },
  { id: 'spirit-seed', label: 'Spirit Seed', type: 'quest-item', rarity: 'epic', colors: ['#fff0a8', '#a78dd1'] },
]);

export const ITEMS = deepFreeze([...TOOLS, ...SEEDS, ...PRODUCE, ...REWARD_ITEMS]);

export const ITEM_BY_ID = deepFreeze(Object.fromEntries(ITEMS.map((item) => [item.id, item])));

export const WARDROBE = deepFreeze([
  { id: 'wardrobe-hair-meadow-bob', label: 'Meadow Bob', slot: 'hair', rarity: 'common', colors: ['#62493d', '#d8a46b'], source: 'starter' },
  { id: 'wardrobe-hair-cloud-curls', label: 'Cloud Curls', slot: 'hair', rarity: 'common', colors: ['#7b5c4d', '#f0d7b5'], source: 'wardrobe-banner' },
  { id: 'wardrobe-hair-river-braid', label: 'River Braid', slot: 'hair', rarity: 'rare', colors: ['#443d55', '#769bb6'], source: 'quest' },
  { id: 'wardrobe-hair-star-sprouts', label: 'Star Sprouts', slot: 'hair', rarity: 'epic', colors: ['#5a4672', '#d8b7ef'], source: 'wardrobe-banner' },
  { id: 'wardrobe-top-garden-tee', label: 'Garden Tee', slot: 'top', rarity: 'common', colors: ['#f4e4be', '#7bbf83'], source: 'starter' },
  { id: 'wardrobe-top-market-apron', label: 'Market Apron', slot: 'top', rarity: 'common', colors: ['#f5c878', '#9d6f55'], source: 'market' },
  { id: 'wardrobe-top-raincoat', label: 'Puddle Raincoat', slot: 'top', rarity: 'rare', colors: ['#e9bf4f', '#7bb2c8'], source: 'daily-reward' },
  { id: 'wardrobe-top-heartroot-jacket', label: 'Heartroot Jacket', slot: 'top', rarity: 'epic', colors: ['#a75d68', '#f2c78d'], source: 'chapter-1' },
  { id: 'wardrobe-bottom-patch-shorts', label: 'Patch Shorts', slot: 'bottom', rarity: 'common', colors: ['#7594a3', '#f0d29c'], source: 'starter' },
  { id: 'wardrobe-bottom-field-skirt', label: 'Field Skirt', slot: 'bottom', rarity: 'common', colors: ['#c98577', '#f2c8a2'], source: 'market' },
  { id: 'wardrobe-bottom-river-overalls', label: 'River Overalls', slot: 'bottom', rarity: 'rare', colors: ['#5d87a0', '#d5eef2'], source: 'wardrobe-banner' },
  { id: 'wardrobe-bottom-moon-trousers', label: 'Moon Trousers', slot: 'bottom', rarity: 'epic', colors: ['#534c72', '#b8acd8'], source: 'wardrobe-banner' },
  { id: 'wardrobe-shoes-garden-clogs', label: 'Garden Clogs', slot: 'shoes', rarity: 'common', colors: ['#9a6f4f', '#e4bd76'], source: 'starter' },
  { id: 'wardrobe-shoes-puddle-boots', label: 'Puddle Boots', slot: 'shoes', rarity: 'common', colors: ['#e1a64f', '#f3dc85'], source: 'market' },
  { id: 'wardrobe-shoes-leaf-sneakers', label: 'Leaf Sneakers', slot: 'shoes', rarity: 'rare', colors: ['#75ad75', '#f4eee0'], source: 'playtime-reward' },
  { id: 'wardrobe-shoes-starlight', label: 'Starlight Steps', slot: 'shoes', rarity: 'epic', colors: ['#8a79bd', '#e7dafa'], source: 'wardrobe-banner' },
  { id: 'wardrobe-accessory-straw-hat', label: 'Tiny Straw Hat', slot: 'accessory', rarity: 'common', colors: ['#deb96d', '#b46b58'], source: 'starter' },
  { id: 'wardrobe-accessory-sprout-pin', label: 'Sprout Pin', slot: 'accessory', rarity: 'common', colors: ['#66a966', '#f6df79'], source: 'quest' },
  { id: 'wardrobe-accessory-river-satchel', label: 'River Satchel', slot: 'accessory', rarity: 'rare', colors: ['#719bb0', '#b77b58'], source: 'wardrobe-banner' },
  { id: 'wardrobe-accessory-spirit-crown', label: 'Spirit Crown', slot: 'accessory', rarity: 'epic', colors: ['#e3ce83', '#a78dd1'], source: 'rare-reward' },
]);

export const WARDROBE_BY_ID = deepFreeze(Object.fromEntries(WARDROBE.map((piece) => [piece.id, piece])));
