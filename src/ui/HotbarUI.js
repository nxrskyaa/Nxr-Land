import { ITEM_BY_ID, TOOLS } from '../data/items.js';

const NUMBER_CODES = Object.fromEntries(Array.from({ length: 9 }, (_, index) => [`Digit${index + 1}`, index]));
const REFRESH_EVENTS = ['economy:purchased', 'economy:sold', 'crop:planted', 'crop:harvested', 'hotbar:selected'];

function editable(target) {
  return Boolean(target?.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"]'));
}

export class HotbarUI {
  constructor({ container, state, eventBus, economySystem } = {}) {
    this.container = container;
    this.state = state;
    this.eventBus = eventBus;
    this.economySystem = economySystem;
    this.listeners = [];
    this.unsubscribers = [];
    this.#mount();
    REFRESH_EVENTS.forEach((type) => {
      const unsubscribe = eventBus?.on?.(type, () => this.refresh());
      if (unsubscribe) this.unsubscribers.push(unsubscribe);
    });
  }

  #listen(target, type, handler) {
    target?.addEventListener?.(type, handler);
    this.listeners.push(() => target?.removeEventListener?.(type, handler));
  }

  #mount() {
    const doc = this.container?.ownerDocument;
    if (!doc) return;
    const bar = doc.createElement('nav');
    bar.className = 'hotbar-ui';
    bar.setAttribute('aria-label', 'Tool and seed hotbar');
    this.container.append(bar);
    this.element = bar;
    this.#listen(bar, 'click', (event) => {
      const button = event.target.closest('[data-hotbar-item]');
      if (!button) return;
      event.preventDefault();
      const result = this.economySystem?.selectHotbarItem?.(button.dataset.hotbarItem);
      if (result?.ok) button.setAttribute('aria-pressed', 'true');
      this.refresh();
    });
    this.#listen(doc.defaultView, 'keydown', (event) => {
      const index = NUMBER_CODES[event.code];
      if (index === undefined || editable(event.target)) return;
      const itemId = this.#items()[index]?.id;
      if (!itemId) return;
      event.preventDefault();
      this.economySystem?.selectHotbarItem?.(itemId);
      this.refresh();
    });
    this.refresh();
  }

  #items() {
    const inventory = this.state.economy.inventory;
    const ordered = [
      ...TOOLS,
      ...Object.keys(inventory).map((itemId) => ITEM_BY_ID[itemId]).filter((item) => item?.type === 'seed'),
    ];
    return [...new Map(ordered.filter((item) => (inventory[item.id] ?? 0) > 0).map((item) => [item.id, item])).values()].slice(0, 9);
  }

  refresh() {
    if (!this.element) return;
    const selected = this.state.economy.selectedHotbarId;
    const buttons = this.#items().map((item, index) => {
      const button = this.element.ownerDocument.createElement('button');
      button.type = 'button';
      button.className = 'hotbar-slot';
      button.dataset.hotbarItem = item.id;
      button.setAttribute('aria-pressed', String(item.id === selected));
      button.title = `${index + 1}: ${item.label}`;
      const key = this.element.ownerDocument.createElement('kbd');
      key.textContent = String(index + 1);
      const label = this.element.ownerDocument.createElement('span');
      label.textContent = item.label;
      const quantity = this.element.ownerDocument.createElement('b');
      quantity.textContent = String(this.state.economy.inventory[item.id]);
      button.append(key, label, quantity);
      return button;
    });
    this.element.replaceChildren(...buttons);
  }

  dispose() {
    this.listeners?.splice(0).forEach((remove) => remove());
    this.unsubscribers?.splice(0).forEach((unsubscribe) => unsubscribe());
    this.element?.remove();
    this.element = null;
  }
}
