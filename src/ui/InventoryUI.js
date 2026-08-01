import { ITEM_BY_ID } from '../data/items.js';

const REFRESH_EVENTS = ['economy:purchased', 'economy:sold', 'crop:planted', 'crop:harvested', 'quest:completed'];

export class InventoryUI {
  constructor({ container, state, eventBus } = {}) {
    this.container = container;
    this.state = state;
    this.eventBus = eventBus;
    this.unsubscribers = [];
    this.#mount();
    REFRESH_EVENTS.forEach((type) => {
      const unsubscribe = eventBus?.on?.(type, () => this.refresh());
      if (unsubscribe) this.unsubscribers.push(unsubscribe);
    });
  }

  #mount() {
    const doc = this.container?.ownerDocument;
    if (!doc || !this.state?.economy) return;
    const panel = doc.createElement('section');
    panel.className = 'inventory-ui game-panel';
    panel.setAttribute('aria-label', 'Inventory');
    panel.innerHTML = '<header><span>Satchel</span><strong data-coin-balance></strong></header><div class="inventory-list" data-inventory-list></div>';
    this.container.append(panel);
    this.element = panel;
    this.refresh();
  }

  refresh() {
    if (!this.element) return;
    this.element.querySelector('[data-coin-balance]').textContent = `${this.state.economy.coin} coin`;
    const list = this.element.querySelector('[data-inventory-list]');
    list.replaceChildren();
    const entries = Object.entries(this.state.economy.inventory)
      .filter(([itemId, quantity]) => ITEM_BY_ID[itemId] && quantity > 0)
      .sort(([left], [right]) => left.localeCompare(right));
    for (const [itemId, quantity] of entries) {
      const item = ITEM_BY_ID[itemId];
      const row = list.ownerDocument.createElement('div');
      row.className = `inventory-item inventory-item--${item.type}`;
      row.dataset.inventoryItem = itemId;
      const label = list.ownerDocument.createElement('span');
      label.textContent = item.label;
      const amount = list.ownerDocument.createElement('b');
      amount.dataset.quantity = '';
      amount.textContent = String(quantity);
      row.append(label, amount);
      list.append(row);
    }
    if (!entries.length) {
      const empty = list.ownerDocument.createElement('p');
      empty.className = 'panel-empty';
      empty.textContent = 'Your satchel is empty';
      list.append(empty);
    }
  }

  dispose() {
    this.unsubscribers?.splice(0).forEach((unsubscribe) => unsubscribe());
    this.element?.remove();
    this.element = null;
  }
}
