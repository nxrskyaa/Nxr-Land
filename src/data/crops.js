export function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

export const CROPS = deepFreeze([
  {
    id: 'turnip',
    label: 'Cloud Turnip',
    seedPrice: 8,
    sellPrice: 18,
    growthMs: 45_000,
    stages: ['seed', 'sprout', 'leaves', 'ripe'],
    colors: { leaf: '#78b85a', crop: '#f5eee3', accent: '#b889d6' },
    form: { crop: 'round', leaves: 4, height: 0.5 },
  },
  {
    id: 'carrot',
    label: 'Sunset Carrot',
    seedPrice: 10,
    sellPrice: 24,
    growthMs: 60_000,
    stages: ['seed', 'sprout', 'fronds', 'ripe'],
    colors: { leaf: '#5ca65b', crop: '#f18b4b', accent: '#ffd27a' },
    form: { crop: 'tapered', leaves: 5, height: 0.65 },
  },
  {
    id: 'tomato',
    label: 'Button Tomato',
    seedPrice: 14,
    sellPrice: 34,
    growthMs: 90_000,
    stages: ['seed', 'sprout', 'bush', 'flower', 'ripe'],
    colors: { leaf: '#4f9854', crop: '#e95d5d', accent: '#ffd66b' },
    form: { crop: 'cluster', fruitCount: 3, height: 0.9 },
  },
  {
    id: 'strawberry',
    label: 'Heart Strawberry',
    seedPrice: 18,
    sellPrice: 45,
    growthMs: 120_000,
    stages: ['seed', 'sprout', 'leaves', 'flower', 'ripe'],
    colors: { leaf: '#56a765', crop: '#e8526f', accent: '#fff1b8' },
    form: { crop: 'heart', runners: 2, height: 0.45 },
  },
  {
    id: 'pumpkin',
    label: 'Moon Pumpkin',
    seedPrice: 25,
    sellPrice: 68,
    growthMs: 180_000,
    stages: ['seed', 'sprout', 'vine', 'flower', 'ripe'],
    colors: { leaf: '#4d9253', crop: '#e99a45', accent: '#f8c96d' },
    form: { crop: 'ribbed', vineLength: 1.2, height: 0.7 },
  },
  {
    id: 'sunflower',
    label: 'Glow Sunflower',
    seedPrice: 20,
    sellPrice: 52,
    growthMs: 150_000,
    stages: ['seed', 'sprout', 'stem', 'bud', 'bloom'],
    colors: { leaf: '#5b9d58', crop: '#f6c84f', accent: '#79513a' },
    form: { crop: 'flower', petals: 12, height: 1.4 },
  },
]);

export const CROP_BY_ID = deepFreeze(Object.fromEntries(CROPS.map((crop) => [crop.id, crop])));
