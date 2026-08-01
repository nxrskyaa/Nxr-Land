import { describe, expect, it, vi } from 'vitest';
import { CROPS } from '../src/data/crops.js';
import { createInitialState } from '../src/game/createState.js';
import { FarmingSystem } from '../src/systems/FarmingSystem.js';

function setup() {
  const state = createInitialState();
  state.world.elapsedMs = 0;
  for (const crop of CROPS) state.economy.inventory[`seed-${crop.id}`] = 2;
  const events = [];
  const eventBus = { emit: vi.fn((type, payload) => events.push([type, payload])) };
  const saveManager = { save: vi.fn(() => true) };
  const positions = Object.fromEntries(state.crops.plots.map((plot, index) => [plot.id, { x: index, y: 0.3, z: 3 }]));
  const farming = new FarmingSystem({ state, eventBus, saveManager, plotPositions: positions });
  return { state, farming, events, eventBus, saveManager };
}

const actions = [
  ['plant', ['home-plot-1', 'turnip']],
  ['water', ['home-plot-1']],
  ['harvest', ['home-plot-1']],
];

describe('FarmingSystem validation and atomicity', () => {
  it('rejects unknown plots for every action without saves, events, or mutation', () => {
    const { state, farming, eventBus, saveManager } = setup();
    const before = structuredClone(state);
    for (const [method, args] of [['till', ['missing']], ...actions.map(([method]) => [method, ['missing', 'turnip']])]) {
      expect(farming[method](...args)).toMatchObject({ ok: false, code: 'unknown-plot' });
    }
    expect(state).toEqual(before);
    expect(eventBus.emit).not.toHaveBeenCalled();
    expect(saveManager.save).not.toHaveBeenCalled();
  });

  it('rolls back successful-looking actions when persistence fails and emits nothing', () => {
    const { state, farming, eventBus, saveManager } = setup();
    saveManager.save.mockReturnValue(false);
    const before = structuredClone(state);

    expect(farming.till('home-plot-1')).toMatchObject({ ok: false, code: 'save-failed' });
    expect(state).toEqual(before);
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it('rolls back harvest inventory and plot state when persistence fails', () => {
    const { state, farming, eventBus, saveManager } = setup();
    const plot = state.crops.plots[0];
    farming.till(plot.id); farming.plant(plot.id, 'turnip'); farming.water(plot.id);
    state.world.elapsedMs = 45_000; farming.updateGrowth();
    eventBus.emit.mockClear(); saveManager.save.mockReset().mockReturnValue(false);
    const before = structuredClone(state);

    expect(farming.harvest(plot.id)).toMatchObject({ ok: false, code: 'save-failed' });
    expect(state).toEqual(before);
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it('rolls back growth transitions when persistence fails', () => {
    const { state, farming, eventBus, saveManager } = setup();
    const plot = state.crops.plots[0];
    farming.till(plot.id); farming.plant(plot.id, 'turnip'); farming.water(plot.id);
    eventBus.emit.mockClear(); saveManager.save.mockReset().mockReturnValue(false);
    const before = structuredClone(state);

    expect(farming.updateGrowth()).toEqual([expect.objectContaining({ ok: false, code: 'save-failed' })]);
    expect(state).toEqual(before);
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it('rejects every invalid state transition without partial mutation', () => {
    const { state, farming, eventBus, saveManager } = setup();
    const plot = state.crops.plots[0];
    for (const [stateName, method, args] of [
      ['tilled', 'till', [plot.id]],
      ['empty', 'plant', [plot.id, 'turnip']],
      ['tilled', 'water', [plot.id]],
      ['planted', 'harvest', [plot.id]],
      ['watered', 'plant', [plot.id, 'turnip']],
      ['growing', 'water', [plot.id]],
      ['harvestable', 'till', [plot.id]],
    ]) {
      Object.assign(plot, { state: stateName, cropId: stateName === 'empty' || stateName === 'tilled' ? null : 'turnip' });
      const before = structuredClone(plot);
      expect(farming[method](...args)).toMatchObject({ ok: false, code: 'invalid-transition' });
      expect(plot).toEqual(before);
    }
    expect(eventBus.emit).not.toHaveBeenCalled();
    expect(saveManager.save).not.toHaveBeenCalled();
  });

  it('validates crop IDs and seed availability before planting atomically', () => {
    const { state, farming, eventBus, saveManager } = setup();
    const plot = state.crops.plots[0];
    farming.till(plot.id);
    eventBus.emit.mockClear(); saveManager.save.mockClear();
    const before = structuredClone(state);
    expect(farming.plant(plot.id, 'mystery')).toMatchObject({ ok: false, code: 'unknown-crop' });
    expect(state).toEqual(before);
    state.economy.inventory['seed-turnip'] = 0;
    const noSeeds = structuredClone(state);
    expect(farming.plant(plot.id, 'turnip')).toMatchObject({ ok: false, code: 'insufficient-seed' });
    expect(state).toEqual(noSeeds);
    expect(eventBus.emit).not.toHaveBeenCalled();
    expect(saveManager.save).not.toHaveBeenCalled();
  });

  it('requires finite authoritative world timestamps', () => {
    const { state, farming, saveManager } = setup();
    farming.till('home-plot-1');
    saveManager.save.mockClear();
    state.world.elapsedMs = Number.NaN;
    const before = structuredClone(state.crops.plots[0]);
    expect(farming.plant('home-plot-1', 'turnip')).toMatchObject({ ok: false, code: 'invalid-time' });
    expect(state.crops.plots[0]).toEqual(before);
    expect(saveManager.save).not.toHaveBeenCalled();
  });
});

describe('FarmingSystem complete loops', () => {
  it.each(CROPS.map((crop) => [crop.id, crop.growthMs]))('runs the complete loop for %s', (cropId, growthMs) => {
    const { state, farming, events, saveManager } = setup();
    const plot = state.crops.plots[0];
    const seedBefore = state.economy.inventory[`seed-${cropId}`];
    expect(farming.till(plot.id)).toMatchObject({ ok: true, state: 'tilled' });
    expect(farming.plant(plot.id, cropId)).toMatchObject({ ok: true, state: 'planted' });
    expect(state.economy.inventory[`seed-${cropId}`]).toBe(seedBefore - 1);
    expect(farming.water(plot.id)).toMatchObject({ ok: true, state: 'watered' });
    expect(farming.updateGrowth()).toEqual(expect.arrayContaining([expect.objectContaining({ plotId: plot.id, state: 'growing' })]));
    state.world.elapsedMs = growthMs - 1;
    farming.updateGrowth();
    expect(plot.state).toBe('growing');
    state.world.elapsedMs = growthMs;
    farming.updateGrowth();
    expect(plot.state).toBe('harvestable');
    expect(farming.harvest(plot.id)).toMatchObject({ ok: true, itemId: `produce-${cropId}`, quantity: 1, value: expect.any(Number) });
    expect(state.economy.inventory[`produce-${cropId}`]).toBe(1);
    expect(plot).toMatchObject({ state: 'empty', cropId: null, plantedAt: null, wateredAt: null });
    expect(saveManager.save).toHaveBeenCalledTimes(6);
    expect(events.map(([type]) => type)).toEqual([
      'plot:tilled', 'crop:planted', 'crop:watered', 'crop:growing',
      ...events.filter(([type]) => type === 'crop:stage').map(() => 'crop:stage'),
      'crop:harvestable', 'crop:harvested',
    ]);
    const planted = events.find(([type]) => type === 'crop:planted')[1];
    expect(planted).toEqual(expect.objectContaining({ plotId: plot.id, cropId, position: expect.objectContaining({ x: 0, z: 3 }) }));
    expect(Object.keys(planted).sort()).toEqual(['crop', 'cropId', 'plotId', 'position', 'state', 'timestamp'].sort());
  });

  it('keeps plots independent and only saves growth mutations', () => {
    const { state, farming, saveManager } = setup();
    for (const id of ['home-plot-1', 'home-plot-2']) {
      farming.till(id); farming.plant(id, 'turnip'); farming.water(id);
    }
    state.crops.plots[1].wateredAt = 20;
    state.crops.plots[1].growthStartedAt = 20;
    state.world.elapsedMs = 45_000;
    saveManager.save.mockClear();
    farming.updateGrowth();
    expect(state.crops.plots[0].state).toBe('harvestable');
    expect(state.crops.plots[1].state).toBe('growing');
    expect(saveManager.save).toHaveBeenCalledOnce();
    farming.updateGrowth();
    expect(saveManager.save).toHaveBeenCalledOnce();
  });

  it('maps growth stages at exact boundaries and survives reload from state timestamps', () => {
    const { state, farming, events } = setup();
    farming.till('home-plot-1'); farming.plant('home-plot-1', 'tomato'); farming.water('home-plot-1'); farming.updateGrowth();
    const plot = state.crops.plots[0];
    const duration = CROPS.find((crop) => crop.id === 'tomato').growthMs;
    state.world.elapsedMs = duration * 0.5;
    farming.updateGrowth();
    const expectedStage = farming.getVisualState(plot.id);
    const reloaded = new FarmingSystem({ state, plotPositions: farming.plotPositions });
    expect(reloaded.getVisualState(plot.id)).toEqual(expectedStage);
    expect(events.filter(([type]) => type === 'crop:stage').at(-1)[1]).toEqual(expect.objectContaining({
      plotId: plot.id, cropId: 'tomato', stageIndex: expectedStage.stageIndex, stage: expectedStage.stage,
    }));
  });
});
