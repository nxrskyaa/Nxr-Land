import { describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../src/game/createState.js';
import { EventBus } from '../src/game/EventBus.js';
import { BUILDING_BY_ID } from '../src/data/buildings.js';
import { BuildingSystem, LAND_EXPANSIONS, HOUSE_UPGRADE_COST } from '../src/systems/BuildingSystem.js';
import { BuildingUI } from '../src/ui/BuildingUI.js';

function setup({ coin = 10000, save = true } = {}) {
  const state = createInitialState();
  state.economy.coin = coin;
  const eventBus = new EventBus();
  const saveManager = { save: vi.fn(() => save) };
  const colliders = [];
  const system = new BuildingSystem({ state, eventBus, saveManager, colliders });
  return { state, eventBus, saveManager, colliders, system };
}

describe('BuildingSystem', () => {
  it('starts with the home parcel and building mode unlocks', () => {
    const state = createInitialState();
    expect(state.world.ownedLand).toEqual(['home-plot']);
    expect(state.world.placedBuildings).toEqual([]);
    expect(state.world.unlocks).toEqual(expect.arrayContaining(['building-mode', 'land-expansions']));
  });

  it('validates ownership, parcel bounds, overlap, and static collisions before placement', () => {
    const { system, state, colliders } = setup();
    const id = 'building-garden-bench';
    expect(system.place(id, 7, 5).ok).toBe(true);
    expect(system.place(id, 7.5, 5)).toMatchObject({ ok: false, code: 'overlap' });
    expect(system.place(id, 11.5, 5)).toMatchObject({ ok: false, code: 'out-of-bounds' });
    expect(system.place(id, -14, -6)).toMatchObject({ ok: false, code: 'land-not-owned' });
    colliders.push({ type: 'rect', x: -12.1, z: -4.6, width: 3.2, depth: 0.8, id: 'mosswood-gate' });
    expect(system.purchaseLand('expansion-west')).toMatchObject({ ok: true, price: 1200 });
    expect(system.place('building-round-lantern', -12.1, -4.6)).toMatchObject({ ok: false, code: 'collision' });
    expect(state.world.placedBuildings).toHaveLength(1);
    expect(colliders).toHaveLength(2);
  });

  it('supports rotation and sells for a 60 percent refund while removing its collider', () => {
    const { system, state, colliders } = setup();
    const placed = system.place('building-produce-stall', 6.5, 7, Math.PI / 2);
    expect(placed).toMatchObject({ ok: true, rotation: Math.PI / 2 });
    expect(system.getPreview('building-produce-stall', 6.5, 7, 0).valid).toBe(false);
    const sold = system.sell(placed.building.id);
    expect(sold).toMatchObject({ ok: true, refund: BUILDING_BY_ID['building-produce-stall'].price * 0.6 });
    expect(state.world.placedBuildings).toEqual([]);
    expect(colliders).toEqual([]);
  });

  it('rolls back false or thrown saves and emits success only after save', () => {
    for (const mode of ['false', 'throw']) {
      const { system, state, saveManager } = setup({ save: false });
      if (mode === 'throw') saveManager.save.mockImplementation(() => { throw new Error('quota'); });
      const before = structuredClone(state);
      expect(system.purchaseLand('expansion-west')).toMatchObject({ ok: false, code: 'save-failed' });
      expect(state).toEqual(before);
    }
  });

  it('purchases both expansions and upgrades the starter house once', () => {
    const { system, state } = setup();
    expect(system.purchaseLand('expansion-west')).toMatchObject({ price: 1200 });
    expect(system.purchaseLand('expansion-north')).toMatchObject({ price: 1800 });
    expect(system.upgradeHouse()).toMatchObject({ ok: true, price: HOUSE_UPGRADE_COST });
    expect(state.world.ownedLand).toEqual(['home-plot', 'expansion-west', 'expansion-north']);
    expect(state.world.upgrades.houseLevel).toBe(2);
  });

  it('renders a ghost preview with valid/invalid tint and confirm/cancel/rotation controls', () => {
    document.body.innerHTML = '<main id="game"></main>';
    const { system, eventBus } = setup();
    const ui = new BuildingUI({ container: document.querySelector('#game'), buildingSystem: system, eventBus });
    expect(ui.root.querySelector('[data-building-preview]')).toBeTruthy();
    ui.selectBuilding('building-garden-bench');
    ui.previewAt(7, 5);
    expect(ui.root.querySelector('[data-building-preview]').dataset.valid).toBe('true');
    ui.rotate();
    ui.confirm();
    expect(system.state.world.placedBuildings).toHaveLength(1);
    ui.cancel();
    ui.dispose();
  });

  it('reconstructs identical transforms from persisted placements', () => {
    const first = setup();
    const result = first.system.place('building-garden-bench', 7, 5, Math.PI / 2);
    expect(result.ok).toBe(true);
    const secondState = structuredClone(first.state);
    const second = new BuildingSystem({ state: secondState, colliders: [] });
    expect(second.getPlacedTransforms()).toEqual(first.system.getPlacedTransforms());
  });
});

describe('land expansion data', () => {
  it('documents conservative prices and parcel rectangles', () => {
    expect(LAND_EXPANSIONS).toMatchObject({
      'expansion-west': { price: 1200 }, 'expansion-north': { price: 1800 },
    });
  });
});