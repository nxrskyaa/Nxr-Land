import { deepFreeze } from '../utils/deepFreeze.js';

export const BUILDINGS = deepFreeze([
  { id: 'building-village-planter', name: 'Village Planter', price: 60, size: { width: 2, depth: 1 }, type: 'civic', palette: { base: '#b98962', accent: '#77a96d', trim: '#ead39c' } },
  { id: 'building-garden-bench', name: 'Garden Bench', price: 80, size: { width: 2, depth: 1 }, type: 'decoration', palette: { base: '#9b6b4d', accent: '#d3aa72', trim: '#efe0bd' } },
  { id: 'building-round-lantern', name: 'Round Lantern', price: 95, size: { width: 1, depth: 1 }, type: 'light', palette: { base: '#66586e', accent: '#f6d982', trim: '#d9c7aa' } },
  { id: 'building-bird-bath', name: 'Bird Bath', price: 120, size: { width: 1, depth: 1 }, type: 'decoration', palette: { base: '#a9b6b1', accent: '#86bdc7', trim: '#e4e0d1' } },
  { id: 'building-produce-stall', name: 'Produce Stall', price: 180, size: { width: 2, depth: 2 }, type: 'shop', palette: { base: '#bd765c', accent: '#efd18a', trim: '#72966c' } },
  { id: 'building-picnic-table', name: 'Picnic Table', price: 160, size: { width: 2, depth: 2 }, type: 'decoration', palette: { base: '#a96e51', accent: '#e0b77c', trim: '#d66d6d' } },
  { id: 'building-pet-nook', name: 'Pet Nook', price: 240, size: { width: 2, depth: 2 }, type: 'pet', palette: { base: '#9274a5', accent: '#ddc6e8', trim: '#efcc7a' } },
  { id: 'building-greenhouse', name: 'Pocket Greenhouse', price: 400, size: { width: 3, depth: 2 }, type: 'farming', palette: { base: '#82a98b', accent: '#bddfe0', trim: '#f0e5c4' } },
]);

export const BUILDING_BY_ID = deepFreeze(Object.fromEntries(BUILDINGS.map((building) => [building.id, building])));
