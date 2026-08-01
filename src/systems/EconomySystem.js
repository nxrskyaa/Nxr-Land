import { ITEM_BY_ID } from '../data/items.js';

function failure(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

function success(action, itemId, quantity, coin, inventoryQuantity, extra = {}) {
  return { ok: true, code: 'ok', action, itemId, quantity, coin, inventoryQuantity, ...extra };
}

export class EconomySystem {
  constructor({ state, eventBus, saveManager } = {}) {
    if (!state?.economy || !state.economy.inventory || !Number.isFinite(state.economy.coin)) {
      throw new Error('EconomySystem requires economy state');
    }
    this.state = state;
    this.eventBus = eventBus;
    this.saveManager = saveManager;
    if (!Object.hasOwn(state.economy, 'selectedHotbarId')) state.economy.selectedHotbarId = 'tool-hoe';
  }

  #save() {
    if (!this.saveManager?.save) return true;
    try {
      return this.saveManager.save(this.state) !== false;
    } catch {
      return false;
    }
  }

  #quantity(quantity) {
    return Number.isSafeInteger(quantity) && quantity > 0;
  }

  #stock(itemId) {
    return this.state.economy.inventory[itemId] ?? 0;
  }

  #transact({ action, eventType, item, quantity, unitPrice, coinDelta, stockDelta }) {
    const economy = this.state.economy;
    const previousStock = this.#stock(item.id);
    const total = unitPrice * quantity;
    const payload = () => Object.freeze({
      action, itemId: item.id, item, quantity, unitPrice, total,
      coin: economy.coin, inventoryQuantity: economy.inventory[item.id],
    });
    const mutate = () => {
      economy.coin += coinDelta;
      economy.inventory[item.id] = previousStock + stockDelta;
    };

    if (this.eventBus?.transact) {
      const transaction = this.eventBus.transact(eventType, payload, {
        state: this.state,
        mutate,
        save: () => this.#save(),
      });
      if (!transaction.ok) {
        return failure(transaction.code, transaction.code === 'transaction-failed'
          ? 'Transaction could not be prepared'
          : 'Could not save this transaction', { itemId: item.id, quantity });
      }
    } else {
      const hadStock = Object.hasOwn(economy.inventory, item.id);
      const previousCoin = economy.coin;
      mutate();
      if (!this.#save()) {
        economy.coin = previousCoin;
        if (hadStock) economy.inventory[item.id] = previousStock;
        else delete economy.inventory[item.id];
        return failure('save-failed', 'Could not save this transaction', { itemId: item.id, quantity });
      }
      this.eventBus?.emit?.(eventType, payload());
    }
    return success(action, item.id, quantity, economy.coin, economy.inventory[item.id], { unitPrice, total });
  }

  buy(itemId, quantity = 1) {
    if (!this.#quantity(quantity)) return failure('invalid-quantity', 'Quantity must be a positive integer', { itemId, quantity });
    const item = ITEM_BY_ID[itemId];
    if (!item || item.type !== 'seed' || !Number.isFinite(item.price)) {
      return failure('not-for-sale', 'This item is not sold at the market', { itemId, quantity });
    }
    const stock = this.#stock(itemId);
    if (!Number.isSafeInteger(stock) || stock < 0) return failure('invalid-stock', 'Inventory stock is invalid', { itemId, quantity });
    const total = item.price * quantity;
    if (!Number.isFinite(this.state.economy.coin) || this.state.economy.coin < total) {
      return failure('insufficient-funds', `You need ${total} coin`, { itemId, quantity, total });
    }
    return this.#transact({
      action: 'buy', eventType: 'economy:purchased', item, quantity,
      unitPrice: item.price, coinDelta: -total, stockDelta: quantity,
    });
  }

  sell(itemId, quantity = 1) {
    if (!this.#quantity(quantity)) return failure('invalid-quantity', 'Quantity must be a positive integer', { itemId, quantity });
    const item = ITEM_BY_ID[itemId];
    if (!item || item.type !== 'produce' || !Number.isFinite(item.sellPrice)) {
      return failure('not-sellable', 'The market does not buy this item', { itemId, quantity });
    }
    const stock = this.#stock(itemId);
    if (!Number.isSafeInteger(stock) || stock < quantity) {
      return failure('insufficient-stock', `Not enough ${item.label} in inventory`, { itemId, quantity, available: Number.isSafeInteger(stock) ? stock : 0 });
    }
    const total = item.sellPrice * quantity;
    return this.#transact({
      action: 'sell', eventType: 'economy:sold', item, quantity,
      unitPrice: item.sellPrice, coinDelta: total, stockDelta: -quantity,
    });
  }

  getSelectedHotbarItem() {
    return this.state.economy.selectedHotbarId;
  }

  selectHotbarItem(itemId) {
    const item = ITEM_BY_ID[itemId];
    const stock = this.#stock(itemId);
    if (!item || !['tool', 'seed'].includes(item.type) || !Number.isSafeInteger(stock) || stock < 1) {
      return failure('unavailable-item', 'That hotbar item is not available', { itemId });
    }
    const previous = this.state.economy.selectedHotbarId;
    if (previous === itemId) return success('select', itemId, 1, this.state.economy.coin, stock);
    this.state.economy.selectedHotbarId = itemId;
    if (!this.#save()) {
      this.state.economy.selectedHotbarId = previous;
      return failure('save-failed', 'Could not save hotbar selection', { itemId });
    }
    const payload = Object.freeze({ itemId, item, inventoryQuantity: stock });
    this.eventBus?.emit?.('hotbar:selected', payload);
    return success('select', itemId, 1, this.state.economy.coin, stock);
  }
}
