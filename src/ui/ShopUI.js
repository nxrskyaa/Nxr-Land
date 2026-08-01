import { PRODUCE, SEEDS } from '../data/items.js';

const REFRESH_EVENTS = ['economy:purchased', 'economy:sold', 'crop:harvested'];

export class ShopUI {
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
    const panel = doc.createElement('section');
    panel.className = 'shop-ui game-panel';
    panel.setAttribute('aria-label', 'Village market');
    panel.innerHTML = `
      <details><summary>Village Market</summary>
        <div class="shop-scroll"><h2>Seed shelf</h2><div data-shop-buy-list></div><h2>Sell harvest</h2><div data-shop-sell-list></div></div>
        <p data-shop-status role="status" aria-live="polite"></p>
      </details>`;
    this.container.append(panel);
    this.element = panel;
    this.#listen(panel, 'click', (event) => {
      const buy = event.target.closest('[data-shop-buy]');
      const sell = event.target.closest('[data-shop-sell]');
      if (!buy && !sell) return;
      const result = buy
        ? this.economySystem?.buy?.(buy.dataset.shopBuy)
        : this.economySystem?.sell?.(sell.dataset.shopSell);
      this.#showResult(result);
    });
    this.refresh();
  }

  #button(item, action, price, quantity) {
    const button = this.element.ownerDocument.createElement('button');
    button.type = 'button';
    button.className = 'shop-item';
    button.dataset[`shop${action === 'Buy' ? 'Buy' : 'Sell'}`] = item.id;
    button.disabled = action === 'Sell' && quantity < 1;
    const copy = this.element.ownerDocument.createElement('span');
    copy.textContent = item.label;
    const detail = this.element.ownerDocument.createElement('small');
    detail.textContent = action === 'Buy' ? `${price} coin` : `${price} coin · ${quantity} owned`;
    button.append(copy, detail);
    return button;
  }

  refresh() {
    if (!this.element) return;
    const buyList = this.element.querySelector('[data-shop-buy-list]');
    const sellList = this.element.querySelector('[data-shop-sell-list]');
    buyList.replaceChildren(...SEEDS.map((item) => this.#button(item, 'Buy', item.price, 0)));
    sellList.replaceChildren(...PRODUCE.map((item) => this.#button(
      item, 'Sell', item.sellPrice, this.state.economy.inventory[item.id] ?? 0,
    )));
  }

  #showResult(result) {
    const status = this.element?.querySelector('[data-shop-status]');
    if (!status || !result) return;
    status.setAttribute('role', result.ok ? 'status' : 'alert');
    status.textContent = result.ok
      ? `${result.action === 'buy' ? 'Bought' : 'Sold'} ${result.quantity} ${result.itemId.replace(/^(seed|produce)-/, '')}`
      : result.message;
  }

  dispose() {
    this.listeners?.splice(0).forEach((remove) => remove());
    this.unsubscribers?.splice(0).forEach((unsubscribe) => unsubscribe());
    this.element?.remove();
    this.element = null;
  }
}
