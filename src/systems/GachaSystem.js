import { PETS } from '../data/pets.js';
import { WARDROBE } from '../data/items.js';

export const GACHA_POOLS = Object.freeze({
  pet: Object.freeze({
    id: 'pet', label: 'Pet Wish', ticketId: 'gacha-ticket', coinCost: 100,
    pityThreshold: 10, rates: Object.freeze({ common: 0.7, rare: 0.25, epic: 0.05 }),
    items: PETS,
  }),
  wardrobe: Object.freeze({
    id: 'wardrobe', label: 'Wardrobe Wish', ticketId: 'wardrobe-ticket', coinCost: 100,
    pityThreshold: 10, rates: Object.freeze({ common: 0.7, rare: 0.25, epic: 0.05 }),
    items: WARDROBE,
  }),
});

const DUST_BY_RARITY = Object.freeze({ common: 5, rare: 15, epic: 50 });
const failure = (code, message, extra = {}) => ({ ok: false, code, message, ...extra });

function chooseRarity(pool, roll, guaranteed) {
  if (guaranteed) return roll < pool.rates.epic / (pool.rates.rare + pool.rates.epic) ? 'epic' : 'rare';
  if (roll < pool.rates.common) return 'common';
  if (roll < pool.rates.common + pool.rates.rare) return 'rare';
  return 'epic';
}

function chooseItem(pool, rarity, roll) {
  const items = pool.items.filter((item) => item.rarity === rarity);
  return items[Math.min(items.length - 1, Math.floor(roll * items.length))];
}

export class GachaSystem {
  constructor({ state, eventBus, saveManager, rng = Math.random } = {}) {
    if (!state?.economy?.inventory || !state.collection || !state.gacha) throw new Error('GachaSystem requires collection state');
    this.state = state;
    this.eventBus = eventBus;
    this.saveManager = saveManager;
    this.rng = rng;
    this.locked = false;
  }

  getPoolMetadata(poolId) {
    const pool = GACHA_POOLS[poolId];
    if (!pool) return null;
    return { id: pool.id, label: pool.label, ticketId: pool.ticketId, coinCost: pool.coinCost, pityThreshold: pool.pityThreshold, rates: { ...pool.rates } };
  }

  #save() {
    try { return this.saveManager?.save ? this.saveManager.save(this.state) !== false : true; } catch { return false; }
  }

  pull(poolId, { currency = 'ticket' } = {}) {
    if (this.locked) return failure('pull-locked', 'A pull is already being resolved');
    const pool = GACHA_POOLS[poolId];
    if (!pool) return failure('unknown-pool', 'That collection is unavailable', { pool: poolId });
    const inventory = this.state.economy.inventory;
    const canTicket = currency === 'ticket' && (inventory[pool.ticketId] ?? 0) > 0;
    const canCoin = currency === 'coin' && this.state.economy.coin >= pool.coinCost;
    if (!canTicket && !canCoin) return failure('insufficient-currency', currency === 'ticket' ? `You need a ${pool.label} ticket` : `You need ${pool.coinCost} coin`);

    this.locked = true;
    const snapshot = structuredClone(this.state);
    try {
      const pity = this.state.gacha.pity[poolId];
      const pityTriggered = pity >= pool.pityThreshold - 1;
      const rarity = chooseRarity(pool, this.rng(), pityTriggered);
      const item = chooseItem(pool, rarity, this.rng());
      const key = poolId === 'pet' ? 'pets' : 'wardrobe';
      const duplicate = this.state.collection[key].includes(item.id);
      if (currency === 'ticket') inventory[pool.ticketId] -= 1;
      else this.state.economy.coin -= pool.coinCost;
      this.state.gacha.pity[poolId] = rarity === 'common' && !pityTriggered ? pity + 1 : 0;
      if (duplicate) this.state.gacha.styleDust += DUST_BY_RARITY[rarity];
      else this.state.collection[key].push(item.id);
      const payload = Object.freeze({ ok: true, pool: poolId, item, rarity, duplicate, pityTriggered, currency, styleDust: this.state.gacha.styleDust });
      if (this.eventBus?.transact) {
        // The mutation above is already applied; transact only supplies durable save and safe post-commit dispatch.
        const committed = this.eventBus.transact('gacha:pull', payload, { state: this.state, mutate: () => {}, save: () => this.#save(), snapshot });
        if (!committed.ok) { Object.keys(this.state).forEach((key) => delete this.state[key]); Object.assign(this.state, structuredClone(snapshot)); return failure('save-failed', 'Could not save this pull'); }
      } else if (!this.#save()) {
        Object.keys(this.state).forEach((key) => delete this.state[key]); Object.assign(this.state, structuredClone(snapshot));
        return failure('save-failed', 'Could not save this pull');
      } else this.eventBus?.emitSafe?.('gacha:pull', payload);
      return payload;
    } catch (error) {
      Object.keys(this.state).forEach((key) => delete this.state[key]); Object.assign(this.state, structuredClone(snapshot));
      return failure('transaction-failed', 'Pull could not be completed', { error });
    } finally { this.locked = false; }
  }
}
