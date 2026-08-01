import { deepFreeze } from '../utils/deepFreeze.js';

export const PETS = deepFreeze([
  {
    id: 'pet-mossbun', name: 'Mossbun', rarity: 'common',
    palette: { primary: '#93bd74', secondary: '#dce8ae', accent: '#6d8f59' },
    shape: { body: 'round', ears: 'leaf', tail: 'puff' },
    accessory: { type: 'sprout', color: '#66a45c' },
    bonus: { type: 'watering-radius', amount: 0.02 },
  },
  {
    id: 'pet-pebblit', name: 'Pebblit', rarity: 'common',
    palette: { primary: '#a9a6a0', secondary: '#d9d0c4', accent: '#746f6b' },
    shape: { body: 'oval', ears: 'none', tail: 'chip' },
    accessory: { type: 'moss-patch', color: '#7fa36c' },
    bonus: { type: 'sell-price', amount: 0.01 },
  },
  {
    id: 'pet-pipfin', name: 'Pipfin', rarity: 'common',
    palette: { primary: '#76b4bb', secondary: '#d2eff0', accent: '#efb66c' },
    shape: { body: 'teardrop', ears: 'fins', tail: 'fan' },
    accessory: { type: 'shell', color: '#f0c7a1' },
    bonus: { type: 'movement-speed', amount: 0.02 },
  },
  {
    id: 'pet-bramblepup', name: 'Bramblepup', rarity: 'common',
    palette: { primary: '#ad7b5c', secondary: '#ead0a4', accent: '#66935f' },
    shape: { body: 'bean', ears: 'floppy', tail: 'curl' },
    accessory: { type: 'berry-collar', color: '#c45f65' },
    bonus: { type: 'clear-speed', amount: 0.03 },
  },
  {
    id: 'pet-dewfox', name: 'Dewfox', rarity: 'rare',
    palette: { primary: '#9bc7d0', secondary: '#eef8ef', accent: '#6e8fb1' },
    shape: { body: 'slender', ears: 'tall', tail: 'plume' },
    accessory: { type: 'dew-bell', color: '#b9e8ef' },
    bonus: { type: 'growth-speed', amount: 0.03 },
  },
  {
    id: 'pet-emberkit', name: 'Emberkit', rarity: 'rare',
    palette: { primary: '#e08a5f', secondary: '#f8d8a6', accent: '#9f5860' },
    shape: { body: 'round', ears: 'pointed', tail: 'flame' },
    accessory: { type: 'scarf', color: '#b95758' },
    bonus: { type: 'harvest-coin', amount: 0.03 },
  },
  {
    id: 'pet-lumimoth', name: 'Lumimoth', rarity: 'rare',
    palette: { primary: '#cfbce8', secondary: '#f5ecb9', accent: '#806caa' },
    shape: { body: 'tiny', ears: 'antennae', tail: 'none' },
    accessory: { type: 'glow-wings', color: '#fff0a8' },
    bonus: { type: 'night-visibility', amount: 0.05 },
  },
  {
    id: 'pet-starcap', name: 'Starcap', rarity: 'epic',
    palette: { primary: '#765f9f', secondary: '#e5d7f4', accent: '#f2cc76' },
    shape: { body: 'mushroom', ears: 'cap-points', tail: 'stardust' },
    accessory: { type: 'constellation', color: '#ffe79b' },
    bonus: { type: 'rare-reward', amount: 0.04 },
  },
]);

export const PET_BY_ID = deepFreeze(Object.fromEntries(PETS.map((pet) => [pet.id, pet])));
