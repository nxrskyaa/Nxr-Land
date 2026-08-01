import { GACHA_POOLS } from '../systems/GachaSystem.js';

export class GachaUI {
  constructor({ container, gachaSystem, eventBus } = {}) {
    this.container = container; this.gachaSystem = gachaSystem; this.eventBus = eventBus; this.unsub = eventBus?.on?.('gacha:pull', () => this.refresh());
    this.#mount();
  }
  #mount() {
    const doc = this.container?.ownerDocument; if (!doc || !this.gachaSystem) return;
    this.element = doc.createElement('section'); this.element.className = 'gacha-ui game-panel'; this.element.setAttribute('aria-label', 'Collection wishes');
    for (const [id, pool] of Object.entries(GACHA_POOLS)) {
      const section = doc.createElement('div'); section.dataset.gachaPool = id;
      section.innerHTML = `<h2>${pool.label}</h2><p data-gacha-rates>Common ${pool.rates.common * 100}% · Rare ${pool.rates.rare * 100}% · Epic ${pool.rates.epic * 100}% · Pity ${pool.pityThreshold}</p><div data-gacha-collection></div><button type="button" data-pull="${id}">Wish with ticket</button><button type="button" data-pull-coin="${id}">Wish for ${pool.coinCost} coin</button><p data-gacha-result aria-live="polite"></p>`;
      section.querySelector('[data-pull]')?.addEventListener('click', () => this.#pull(id, 'ticket'));
      section.querySelector('[data-pull-coin]')?.addEventListener('click', () => this.#pull(id, 'coin'));
      this.element.append(section);
    }
    this.container.append(this.element); this.refresh();
  }
  #pull(pool, currency) {
    const result = this.gachaSystem.pull(pool, { currency });
    const resultNode = this.element.querySelector(`[data-gacha-pool="${pool}"] [data-gacha-result]`);
    if (resultNode) resultNode.textContent = result.ok ? `${result.rarity.toUpperCase()}: ${result.item.name ?? result.item.label}${result.duplicate ? ' · duplicate → Style Dust' : ''}` : result.message;
    this.element.querySelector(`[data-gacha-pool="${pool}"] [data-pull]`).disabled = false;
    return result;
  }
  refresh() {
    if (!this.element) return;
    const pets = this.element.querySelector('[data-gacha-pool="pet"] [data-gacha-collection]');
    if (pets) { pets.replaceChildren(...(this.gachaSystem.state.collection.pets ?? []).map((id) => { const node = pets.ownerDocument.createElement('span'); node.dataset.wardrobeItem = id; node.textContent = id; return node; })); }
    this.element.querySelectorAll('[data-gacha-result]').forEach((node) => { node.dataset.ready = ''; });
  }
  dispose() { this.unsub?.(); this.element?.remove(); this.element = null; }
}
