import { describe, expect, it, vi } from 'vitest';
import { actionSuccessMessage, choosePlotAction, findNearestPlot, updateFarmingFrame } from '../src/game/Game.js';

const positions = {
  'home-plot-1': { x: 5, y: 0.3, z: 3 },
  'home-plot-2': { x: 7, y: 0.3, z: 3 },
};

describe('farming game helpers', () => {
  it('formats action feedback without touching harvest-only fields for other actions', () => {
    expect(actionSuccessMessage({ ok: true, action: 'till' })).toBe('Soft soil, ready for a seed');
    expect(actionSuccessMessage({ ok: true, action: 'plant' })).toBe('Cloud Turnip planted');
    expect(actionSuccessMessage({ ok: true, action: 'water' })).toBe('Watered — this crop can grow now');
    expect(actionSuccessMessage({ ok: true, action: 'harvest', itemId: 'produce-turnip' })).toBe('Harvested turnip');
  });

  it('finds only the nearest plot inside the action radius', () => {
    expect(findNearestPlot({ x: 5.2, z: 3.1 }, positions, 1.5)).toMatchObject({ plotId: 'home-plot-1' });
    expect(findNearestPlot({ x: 0, z: 0 }, positions, 1.5)).toBeNull();
  });

  it('chooses the next contextual farming action', () => {
    expect(choosePlotAction({ state: 'empty' })).toEqual({ action: 'till', tool: 'tool-hoe' });
    expect(choosePlotAction({ state: 'tilled' }, { 'seed-turnip': 1 })).toEqual({ action: 'plant', cropId: 'turnip' });
    expect(choosePlotAction({ state: 'planted' })).toEqual({ action: 'water', tool: 'tool-watering-can' });
    expect(choosePlotAction({ state: 'growing' })).toEqual({ action: 'status' });
    expect(choosePlotAction({ state: 'harvestable' })).toEqual({ action: 'harvest' });
    expect(choosePlotAction({ state: 'tilled' }, {})).toEqual({ action: 'status', reason: 'no-seeds' });
  });

  it('honors explicit hotbar selection instead of silently using another tool or seed', () => {
    const inventory = { 'tool-hoe': 1, 'tool-watering-can': 1, 'seed-turnip': 1, 'seed-carrot': 1 };
    expect(choosePlotAction({ state: 'empty' }, inventory, 'seed-carrot'))
      .toEqual({ action: 'status', reason: 'select-hoe' });
    expect(choosePlotAction({ state: 'empty' }, inventory, 'tool-hoe'))
      .toEqual({ action: 'till', tool: 'tool-hoe' });
    expect(choosePlotAction({ state: 'tilled' }, inventory, 'seed-carrot'))
      .toEqual({ action: 'plant', cropId: 'carrot' });
    expect(choosePlotAction({ state: 'tilled' }, inventory, 'tool-hoe'))
      .toEqual({ action: 'status', reason: 'select-seed' });
    expect(choosePlotAction({ state: 'planted' }, inventory, 'tool-hoe'))
      .toEqual({ action: 'status', reason: 'select-watering-can' });
    expect(choosePlotAction({ state: 'planted' }, inventory, 'tool-watering-can'))
      .toEqual({ action: 'water', tool: 'tool-watering-can' });
  });

  it('advances authoritative time, growth, and visuals once per frame', () => {
    const timeSystem = { update: vi.fn(() => ({ ok: true })) };
    const farmingSystem = { updateGrowth: vi.fn(() => [{ ok: true }]) };
    const world = { syncFarmingPlots: vi.fn() };
    expect(updateFarmingFrame({ timeSystem, farmingSystem, world }, 0.05)).toEqual([{ ok: true }]);
    expect(timeSystem.update).toHaveBeenCalledWith(0.05);
    expect(farmingSystem.updateGrowth).toHaveBeenCalledOnce();
    expect(world.syncFarmingPlots).toHaveBeenCalledWith(farmingSystem);
  });
});
