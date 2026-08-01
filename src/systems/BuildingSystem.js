import { BUILDING_BY_ID } from '../data/buildings.js';
import { WORLD_BOUNDS } from '../game/World.js';

export const LAND_EXPANSIONS = Object.freeze({
  'expansion-west': Object.freeze({ id: 'expansion-west', price: 1200, bounds: Object.freeze({ minX: -17, maxX: -11.3, minZ: -9.1, maxZ: -3.9 }) }),
  'expansion-north': Object.freeze({ id: 'expansion-north', price: 1800, bounds: Object.freeze({ minX: -5.6, maxX: 0.6, minZ: 8.05, maxZ: 12.75 }) }),
});
export const LAND_PARCELS = Object.freeze({
  'home-plot': Object.freeze({ id: 'home-plot', bounds: Object.freeze({ minX: 4, maxX: 12, minZ: 1.55, maxZ: 10.05 }) }),
  ...LAND_EXPANSIONS,
});
export const HOUSE_UPGRADE_COST = 2500;
export const SELL_REFUND_RATE = 0.6;

const normalizedRotation = (rotation) => Number.isFinite(rotation) ? rotation : 0;
const rotatedSize = (building, rotation) => Math.abs(Math.sin(rotation % Math.PI)) > 0.5
  ? { width: building.size.depth, depth: building.size.width }
  : { ...building.size };
const intersectsRect = (a, b) => Math.abs(a.x - b.x) < (a.width + b.width) / 2
  && Math.abs(a.z - b.z) < (a.depth + b.depth) / 2;
const intersectsCircle = (rect, circle) => {
  const x = Math.max(rect.x - rect.width / 2, Math.min(circle.x, rect.x + rect.width / 2));
  const z = Math.max(rect.z - rect.depth / 2, Math.min(circle.z, rect.z + rect.depth / 2));
  return Math.hypot(x - circle.x, z - circle.z) < circle.radius;
};

export class BuildingSystem {
  constructor({ state, eventBus, saveManager, colliders = [], bounds = WORLD_BOUNDS } = {}) {
    if (!state?.world || !state.economy) throw new Error('BuildingSystem requires world and economy state');
    this.state = state;
    this.eventBus = eventBus;
    this.saveManager = saveManager;
    this.colliders = colliders;
    this.bounds = bounds;
    for (const placement of this.state.world.placedBuildings) {
      if (!placement.buildingId && BUILDING_BY_ID[placement.id]) placement.buildingId = placement.id;
      placement.y ??= 0;
      placement.rotation = normalizedRotation(placement.rotation);
    }
    this.#rebuildColliders();
  }

  #save() {
    try { return this.saveManager?.save ? this.saveManager.save(this.state) !== false : true; } catch { return false; }
  }

  #transaction(eventType, mutate, payload) {
    const snapshot = structuredClone(this.state);
    try {
      mutate();
      const saved = this.#save();
      if (!saved) { Object.assign(this.state, snapshot); this.#rebuildColliders(); return { ok: false, code: 'save-failed', message: 'Could not save building progression' }; }
      this.eventBus?.emitSafe?.(eventType, payload());
      return { ok: true, code: 'ok', payload: payload() };
    } catch {
      Object.assign(this.state, snapshot); this.#rebuildColliders();
      return { ok: false, code: 'transaction-failed', message: 'Building transaction could not be prepared' };
    }
  }

  #rebuildColliders() {
    this.colliders.splice(0, this.colliders.length, ...this.state.world.placedBuildings.map((placement) => this.#colliderFor(placement)));
  }

  #colliderFor(placement) {
    const buildingId = placement.buildingId ?? (BUILDING_BY_ID[placement.id] ? placement.id : null);
    const definition = BUILDING_BY_ID[buildingId];
    if (!definition) return { type: 'rect', id: placement.id, x: placement.x, z: placement.z, width: 0, depth: 0 };
    const size = rotatedSize(definition, placement.rotation);
    return { type: 'rect', id: placement.id, x: placement.x, z: placement.z, width: size.width, depth: size.depth };
  }

  #candidate(buildingId, x, z, rotation) {
    const definition = BUILDING_BY_ID[buildingId];
    if (!definition || !Number.isFinite(x) || !Number.isFinite(z)) return null;
    const safeRotation = normalizedRotation(rotation);
    const size = rotatedSize(definition, safeRotation);
    return { buildingId, x, z, rotation: safeRotation, width: size.width, depth: size.depth };
  }

  #parcel(candidate) {
    return Object.values(LAND_PARCELS).find((parcel) => this.state.world.ownedLand.includes(parcel.id)
      && candidate.x - candidate.width / 2 >= parcel.bounds.minX
      && candidate.x + candidate.width / 2 <= parcel.bounds.maxX
      && candidate.z - candidate.depth / 2 >= parcel.bounds.minZ
      && candidate.z + candidate.depth / 2 <= parcel.bounds.maxZ);
  }

  getPreview(buildingId, x, z, rotation = 0) {
    const candidate = this.#candidate(buildingId, x, z, rotation);
    if (!candidate) return { valid: false, code: 'unknown-building' };
    const parcelAtCenter = Object.values(LAND_PARCELS).find((parcel) => candidate.x >= parcel.bounds.minX && candidate.x <= parcel.bounds.maxX
      && candidate.z >= parcel.bounds.minZ && candidate.z <= parcel.bounds.maxZ);
    if (!parcelAtCenter || !this.state.world.ownedLand.includes(parcelAtCenter.id)) return { ...candidate, valid: false, code: 'land-not-owned' };
    if (!this.#parcel(candidate)) return { ...candidate, valid: false, code: 'out-of-bounds' };
    if (candidate.x - candidate.width / 2 < this.bounds.minX || candidate.x + candidate.width / 2 > this.bounds.maxX
      || candidate.z - candidate.depth / 2 < this.bounds.minZ || candidate.z + candidate.depth / 2 > this.bounds.maxZ) return { ...candidate, valid: false, code: 'out-of-bounds' };
    const collider = this.#colliderFor(candidate);
    const placedIds = new Set(this.state.world.placedBuildings.map((entry) => entry.id));
    const collidedEntry = this.colliders.find((entry) => entry.id !== collider.id
      && (entry.type === 'circle' ? intersectsCircle(collider, entry) : intersectsRect(collider, entry)));
    if (collidedEntry) return { ...candidate, valid: false, code: placedIds.has(collidedEntry.id) ? 'overlap' : 'collision' };
    return { ...candidate, valid: true, code: 'ok' };
  }

  place(buildingId, x, z, rotation = 0) {
    const preview = this.getPreview(buildingId, x, z, rotation);
    if (!preview.valid) return { ok: false, code: preview.code, message: `Cannot place building: ${preview.code}` };
    const definition = BUILDING_BY_ID[buildingId];
    if (this.state.economy.coin < definition.price) return { ok: false, code: 'insufficient-funds' };
    const id = `${buildingId}-${Date.now()}-${this.state.world.placedBuildings.length}`;
    const building = { id, buildingId, x: preview.x, y: 0, z: preview.z, rotation: preview.rotation };
    const transaction = this.#transaction('building:placed', () => { this.state.economy.coin -= definition.price; this.state.world.placedBuildings.push(building); this.#rebuildColliders(); }, () => Object.freeze({ building, price: definition.price }));
    return transaction.ok ? { ok: true, code: 'ok', building, rotation: building.rotation } : transaction;
  }

  sell(id) {
    const index = this.state.world.placedBuildings.findIndex((entry) => entry.id === id || entry.buildingId === id);
    if (index < 0) return { ok: false, code: 'unknown-building' };
    const building = this.state.world.placedBuildings[index];
    const definition = BUILDING_BY_ID[building.buildingId ?? building.id];
    if (!definition) return { ok: false, code: 'unknown-building' };
    const refund = definition.price * SELL_REFUND_RATE;
    const transaction = this.#transaction('building:sold', () => {
      this.state.world.placedBuildings.splice(index, 1); this.state.economy.coin += refund; this.#rebuildColliders();
    }, () => Object.freeze({ building, refund }));
    return transaction.ok ? { ok: true, code: 'ok', building, refund } : transaction;
  }

  purchaseLand(landId) {
    const expansion = LAND_EXPANSIONS[landId];
    if (!expansion) return { ok: false, code: 'unknown-land' };
    if (this.state.world.ownedLand.includes(landId)) return { ok: false, code: 'already-owned' };
    if (this.state.economy.coin < expansion.price) return { ok: false, code: 'insufficient-funds' };
    const transaction = this.#transaction('land:purchased', () => { this.state.economy.coin -= expansion.price; this.state.world.ownedLand.push(landId); }, () => Object.freeze({ landId, price: expansion.price }));
    return transaction.ok ? { ok: true, code: 'ok', landId, price: expansion.price } : transaction;
  }

  upgradeHouse() {
    if (this.state.world.upgrades.houseLevel >= 2) return { ok: false, code: 'max-level' };
    if (this.state.economy.coin < HOUSE_UPGRADE_COST) return { ok: false, code: 'insufficient-funds' };
    const transaction = this.#transaction('house:upgraded', () => { this.state.economy.coin -= HOUSE_UPGRADE_COST; this.state.world.upgrades.houseLevel = 2; }, () => Object.freeze({ price: HOUSE_UPGRADE_COST, level: 2 }));
    return transaction.ok ? { ok: true, code: 'ok', price: HOUSE_UPGRADE_COST, level: 2 } : transaction;
  }

  getPlacedTransforms() { return this.state.world.placedBuildings.map((entry) => ({ buildingId: entry.buildingId ?? entry.id, x: entry.x, y: entry.y ?? 0, z: entry.z, rotation: normalizedRotation(entry.rotation) })); }
}