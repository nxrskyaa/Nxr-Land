import { WARDROBE, WARDROBE_BY_ID } from '../data/items.js';

const SLOTS = ['hair', 'top', 'bottom', 'shoes', 'accessory'];
const HAIR_STYLES = { 'wardrobe-hair-meadow-bob': 'meadow-bob', 'wardrobe-hair-cloud-curls': 'soft-curls', 'wardrobe-hair-river-braid': 'leafy-pixie', 'wardrobe-hair-star-sprouts': 'twin-buns' };
const HAIR_CYCLE = ['meadow-bob', 'soft-curls', 'leafy-pixie', 'twin-buns'];
const ACCESSORY_CYCLE = ['leaf-pin', 'flower-clip', 'round-glasses'];

function stableIndex(id, modulo) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash % modulo;
}

function hairStyleFor(id) {
  if (HAIR_STYLES[id]) return HAIR_STYLES[id];
  return HAIR_CYCLE[stableIndex(id, HAIR_CYCLE.length)];
}

function accessoryFor(id) {
  if (id.includes('glasses')) return 'round-glasses';
  if (id.includes('flower') || id.includes('bow') || id.includes('pin')) return 'flower-clip';
  if (id.includes('hat') || id.includes('beret') || id.includes('crown')) return 'leaf-pin';
  return ACCESSORY_CYCLE[stableIndex(id, ACCESSORY_CYCLE.length)];
}

export function appearanceFromWardrobe(state) {
  const equipped = state.collection.equipped.wardrobe;
  const appearance = { ...state.player.appearance };
  for (const slot of SLOTS) {
    const item = WARDROBE_BY_ID[equipped[slot]];
    if (!item) continue;
    if (slot === 'hair') appearance.hairStyle = hairStyleFor(item.id);
    else if (slot === 'accessory') appearance.accessory = accessoryFor(item.id);
    else appearance[slot] = item.colors[0];
  }
  return appearance;
}

export class WardrobeUI {
  constructor({ container, state, player, saveManager, eventBus } = {}) {
    this.container = container; this.state = state; this.player = player; this.saveManager = saveManager; this.eventBus = eventBus; this.#mount();
  }
  #mount() {
    const doc = this.container?.ownerDocument; if (!doc || !this.state?.collection) return;
    this.element = doc.createElement('section'); this.element.className = 'wardrobe-ui game-panel'; this.element.setAttribute('aria-label', 'Wardrobe collection');
    this.element.innerHTML = '<h2>Wardrobe</h2><div data-wardrobe-list></div><p data-wardrobe-status role="status"></p>';
    this.container.append(this.element); this.refresh();
  }
  refresh() {
    const list = this.element?.querySelector('[data-wardrobe-list]'); if (!list) return; list.replaceChildren();
    for (const id of this.state.collection.wardrobe) {
      const item = WARDROBE_BY_ID[id]; if (!item) continue;
      const button = list.ownerDocument.createElement('button'); button.type = 'button'; button.dataset.wardrobeItem = id; button.dataset.slot = item.slot; button.textContent = `${item.label} · ${item.rarity}`; button.setAttribute('aria-pressed', String(this.state.collection.equipped.wardrobe[item.slot] === id));
      button.addEventListener('click', () => this.equip(id)); list.append(button);
    }
  }
  equip(id) {
    const item = WARDROBE_BY_ID[id];
    if (!item || !this.state.collection.wardrobe.includes(id)) return { ok: false, code: 'not-owned' };
    const previous = this.state.collection.equipped.wardrobe[item.slot]; this.state.collection.equipped.wardrobe[item.slot] = id;
    const appearance = appearanceFromWardrobe(this.state); this.state.player.appearance = appearance;
    try {
      if (this.saveManager?.save && this.saveManager.save(this.state) === false) throw new Error('save-failed');
    } catch { this.state.collection.equipped.wardrobe[item.slot] = previous; return { ok: false, code: 'save-failed' }; }
    this.player?.updateAppearance?.(appearance); this.eventBus?.emitSafe?.('wardrobe:equipped', { item, slot: item.slot }); this.refresh();
    const status = this.element?.querySelector('[data-wardrobe-status]'); if (status) status.textContent = `${item.label} equipped`;
    return { ok: true, item };
  }
  dispose() { this.element?.remove(); this.element = null; }
}
