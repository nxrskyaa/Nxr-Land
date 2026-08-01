/* @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { CROPS } from '../src/data/crops.js';
import { createInitialState } from '../src/game/createState.js';
import { EventBus } from '../src/game/EventBus.js';
import { SaveManager } from '../src/game/SaveManager.js';
import { FarmingSystem } from '../src/systems/FarmingSystem.js';
import { EconomySystem } from '../src/systems/EconomySystem.js';
import { InventoryUI } from '../src/ui/InventoryUI.js';
import { ShopUI } from '../src/ui/ShopUI.js';
import { HotbarUI } from '../src/ui/HotbarUI.js';

function setup({ save = true } = {}) {
  const state = createInitialState();
  const eventBus = new EventBus();
  const emitted = [];
  eventBus.on('economy:purchased', (payload) => emitted.push(['economy:purchased', payload]));
  eventBus.on('economy:sold', (payload) => emitted.push(['economy:sold', payload]));
  eventBus.on('hotbar:selected', (payload) => emitted.push(['hotbar:selected', payload]));
  const saveManager = { save: vi.fn(() => save) };
  const economy = new EconomySystem({ state, eventBus, saveManager });
  return { state, eventBus, emitted, saveManager, economy };
}

describe('EconomySystem atomic transactions', () => {
  it('keeps the selected hotbar item inside valid schema-versioned save state', () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() };
    const manager = new SaveManager({ storage, createInitialState });
    const state = createInitialState();
    expect(state.economy.selectedHotbarId).toBe('tool-hoe');
    expect(manager.save(state)).toBe(true);
    state.economy.selectedHotbarId = null;
    expect(manager.save(state)).toBe(false);
    expect(manager.lastStatus).toBe('invalid');
  });

  it('purchases catalog seeds and persists before emitting success', () => {
    const { state, economy, saveManager, emitted } = setup();
    state.economy.coin = 20;
    state.economy.inventory['seed-turnip'] = 0;

    expect(economy.buy('seed-turnip', 2)).toEqual(expect.objectContaining({
      ok: true, action: 'buy', itemId: 'seed-turnip', quantity: 2, coin: 4, inventoryQuantity: 2,
    }));
    expect(state.economy).toMatchObject({ coin: 4, inventory: { 'seed-turnip': 2 } });
    expect(saveManager.save).toHaveBeenCalledWith(state);
    expect(emitted).toEqual([['economy:purchased', expect.objectContaining({ total: 16, coin: 4 })]]);
  });

  it('sells produce from inventory for its catalog value', () => {
    const { state, economy, emitted } = setup();
    state.economy.coin = 5;
    state.economy.inventory['produce-turnip'] = 2;

    expect(economy.sell('produce-turnip', 2)).toEqual(expect.objectContaining({
      ok: true, action: 'sell', itemId: 'produce-turnip', quantity: 2, coin: 41, inventoryQuantity: 0,
    }));
    expect(state.economy.coin).toBe(41);
    expect(state.economy.inventory['produce-turnip']).toBe(0);
    expect(emitted).toEqual([['economy:sold', expect.objectContaining({ total: 36, coin: 41 })]]);
  });

  it('rejects insufficient funds and stock without mutation, persistence, or events', () => {
    const { state, economy, saveManager, emitted } = setup();
    state.economy.coin = 7;
    state.economy.inventory['produce-turnip'] = 1;
    const before = structuredClone(state);

    expect(economy.buy('seed-turnip')).toMatchObject({ ok: false, code: 'insufficient-funds' });
    expect(economy.sell('produce-turnip', 2)).toMatchObject({ ok: false, code: 'insufficient-stock' });
    expect(state).toEqual(before);
    expect(saveManager.save).not.toHaveBeenCalled();
    expect(emitted).toEqual([]);
  });

  it.each([
    ['buy', 'mystery', 1, 'not-for-sale'],
    ['sell', 'seed-turnip', 1, 'not-sellable'],
    ['buy', 'seed-turnip', 0, 'invalid-quantity'],
    ['sell', 'produce-turnip', 1.5, 'invalid-quantity'],
  ])('validate-first rejects %s(%s, %s)', (method, itemId, quantity, code) => {
    const { state, economy, saveManager, emitted } = setup();
    state.economy.inventory['produce-turnip'] = 2;
    const before = structuredClone(state);
    expect(economy[method](itemId, quantity)).toMatchObject({ ok: false, code });
    expect(state).toEqual(before);
    expect(saveManager.save).not.toHaveBeenCalled();
    expect(emitted).toEqual([]);
  });

  it('rolls back failed and thrown persistence transactions and emits no success', () => {
    for (const mode of ['false', 'throw']) {
      const { state, economy, saveManager, emitted } = setup({ save: false });
      state.economy.inventory['produce-turnip'] = 1;
      if (mode === 'throw') saveManager.save.mockImplementation(() => { throw new Error('quota'); });
      const before = structuredClone(state);
      expect(economy.sell('produce-turnip')).toMatchObject({ ok: false, code: 'save-failed' });
      expect(state).toEqual(before);
      expect(emitted).toEqual([]);
    }
  });

  it('persists hotbar selection atomically and rejects unavailable items', () => {
    const { state, economy, saveManager, emitted } = setup();
    expect(economy.selectHotbarItem('seed-turnip')).toMatchObject({ ok: true, itemId: 'seed-turnip' });
    expect(state.economy.selectedHotbarId).toBe('seed-turnip');
    expect(emitted.at(-1)).toEqual(['hotbar:selected', expect.objectContaining({ itemId: 'seed-turnip' })]);

    saveManager.save.mockReturnValue(false);
    const before = structuredClone(state);
    expect(economy.selectHotbarItem('seed-carrot')).toMatchObject({ ok: false, code: 'unavailable-item' });
    expect(economy.selectHotbarItem('tool-hoe')).toMatchObject({ ok: false, code: 'save-failed' });
    expect(state).toEqual(before);
    expect(emitted).toHaveLength(1);
  });
});

describe('economy and farming integration', () => {
  it('buys a turnip seed, plants, advances deterministic time, harvests, and sells for expected state', () => {
    const { state, economy, eventBus, saveManager } = setup();
    state.economy.coin = 50;
    state.economy.inventory['seed-turnip'] = 0;
    const farming = new FarmingSystem({ state, eventBus, saveManager });
    const plotId = state.crops.plots[0].id;
    const turnip = CROPS.find((crop) => crop.id === 'turnip');

    expect(economy.buy('seed-turnip')).toMatchObject({ ok: true, coin: 42 });
    expect(farming.till(plotId).ok).toBe(true);
    expect(farming.plant(plotId, 'turnip').ok).toBe(true);
    expect(state.economy.inventory['seed-turnip']).toBe(0);
    expect(farming.water(plotId).ok).toBe(true);
    state.world.elapsedMs = turnip.growthMs;
    farming.updateGrowth();
    expect(farming.harvest(plotId).ok).toBe(true);
    expect(state.economy.inventory['produce-turnip']).toBe(1);
    expect(economy.sell('produce-turnip')).toMatchObject({ ok: true, coin: 60 });
    expect(state.economy.inventory).toMatchObject({ 'seed-turnip': 0, 'produce-turnip': 0 });
    expect(saveManager.save).toHaveBeenCalledTimes(7);
  });
});

function setupUI() {
  document.body.innerHTML = '<main id="game"></main>';
  const context = setup();
  const container = document.querySelector('#game');
  const inventory = new InventoryUI({ container, state: context.state, eventBus: context.eventBus });
  const shop = new ShopUI({ container, state: context.state, eventBus: context.eventBus, economySystem: context.economy });
  const hotbar = new HotbarUI({ container, state: context.state, eventBus: context.eventBus, economySystem: context.economy });
  return { ...context, container, inventory, shop, hotbar };
}

describe('inventory, market, and hotbar UI', () => {
  it('renders authoritative coin and stock, buys and sells from accessible market controls', () => {
    const { state, container, inventory, shop, hotbar } = setupUI();
    state.economy.inventory['produce-turnip'] = 1;
    container.querySelector('[data-shop-buy="seed-turnip"]').click();
    expect(container.querySelector('[data-coin-balance]').textContent).toContain('42');
    expect(container.querySelector('[data-inventory-item="seed-turnip"] [data-quantity]').textContent).toBe('4');
    container.querySelector('[data-shop-sell="produce-turnip"]').click();
    expect(container.querySelector('[data-coin-balance]').textContent).toContain('60');
    expect(container.querySelector('[data-shop-status]').textContent).toMatch(/sold/i);
    inventory.dispose(); shop.dispose(); hotbar.dispose();
  });

  it('selects hotbar slots with number keys and touch/click while ignoring editable targets', () => {
    const { state, container, inventory, shop, hotbar } = setupUI();
    const first = container.querySelector('[data-hotbar-item="tool-hoe"]');
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1' }));
    expect(first.getAttribute('aria-pressed')).toBe('true');
    const turnip = container.querySelector('[data-hotbar-item="seed-turnip"]');
    turnip.focus();
    turnip.click();
    expect(container.querySelector('[data-hotbar-item="seed-turnip"]').getAttribute('aria-pressed')).toBe('true');
    expect(state.economy.selectedHotbarId).toBe('seed-turnip');

    const input = document.createElement('input');
    container.append(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', bubbles: true }));
    expect(state.economy.selectedHotbarId).toBe('seed-turnip');
    inventory.dispose(); shop.dispose(); hotbar.dispose();
  });

  it('refreshes from farming/economy events and disposes elements and listeners idempotently', () => {
    const { state, eventBus, container, inventory, shop, hotbar, economy } = setupUI();
    state.economy.inventory['produce-turnip'] = 1;
    state.economy.inventory['seed-turnip'] = 0;
    eventBus.emit('crop:planted', { cropId: 'turnip' });
    expect(container.querySelector('[data-inventory-item="seed-turnip"]')).toBeNull();
    expect(container.querySelector('[data-hotbar-item="seed-turnip"]')).toBeNull();
    eventBus.emit('crop:harvested', { itemId: 'produce-turnip' });
    expect(container.querySelector('[data-inventory-item="produce-turnip"] [data-quantity]').textContent).toBe('1');
    inventory.dispose(); shop.dispose(); hotbar.dispose();
    inventory.dispose(); shop.dispose(); hotbar.dispose();
    expect(container.querySelector('.inventory-ui')).toBeNull();
    expect(container.querySelector('.shop-ui')).toBeNull();
    expect(container.querySelector('.hotbar-ui')).toBeNull();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1' }));
    expect(economy.getSelectedHotbarItem()).toBe(state.economy.selectedHotbarId);
  });
});
