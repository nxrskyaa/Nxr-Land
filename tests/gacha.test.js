/* @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../src/game/createState.js';
import { EventBus } from '../src/game/EventBus.js';
import { GachaSystem, GACHA_POOLS } from '../src/systems/GachaSystem.js';
import { GachaUI } from '../src/ui/GachaUI.js';
import { WardrobeUI } from '../src/ui/WardrobeUI.js';
import { Pet, followTarget } from '../src/entities/Pet.js';
import { CharacterFactory } from '../src/visuals/CharacterFactory.js';

function setup({ save = true, rng = () => 0.01, state = createInitialState() } = {}) {
  const eventBus = new EventBus();
  const saveManager = { save: vi.fn(() => save) };
  const system = new GachaSystem({ state, eventBus, saveManager, rng });
  return { state, eventBus, saveManager, system };
}

describe('GachaSystem', () => {
  it('exposes separate pools with rates that sum to one', () => {
    expect(GACHA_POOLS.pet.ticketId).toBe('gacha-ticket');
    expect(GACHA_POOLS.wardrobe.ticketId).toBe('wardrobe-ticket');
    for (const pool of Object.values(GACHA_POOLS)) {
      expect(pool.rates.common + pool.rates.rare + pool.rates.epic).toBeCloseTo(1);
      expect(pool.pityThreshold).toBeGreaterThan(0);
      expect(pool.rates).toEqual(expect.objectContaining({ common: expect.any(Number), rare: expect.any(Number), epic: expect.any(Number) }));
    }
  });

  it('selects rarity deterministically and atomically spends a pool ticket', () => {
    const context = setup({ rng: () => 0.91 });
    context.state.economy.inventory['gacha-ticket'] = 1;
    const result = context.system.pull('pet');
    expect(result).toMatchObject({ ok: true, pool: 'pet', rarity: 'rare', currency: 'ticket' });
    expect(context.state.economy.inventory['gacha-ticket']).toBe(0);
    expect(context.state.collection.pets).toContain(result.item.id);
    expect(context.state.gacha.pity.pet).toBe(0);
  });

  it('guarantees a non-common rarity at pity and resets pity after the guarantee', () => {
    const context = setup({ rng: () => 0.99 });
    context.state.economy.inventory['gacha-ticket'] = 1;
    context.state.gacha.pity.pet = GACHA_POOLS.pet.pityThreshold - 1;
    const result = context.system.pull('pet');
    expect(result.ok).toBe(true);
    expect(['rare', 'epic']).toContain(result.rarity);
    expect(result.pityTriggered).toBe(true);
    expect(context.state.gacha.pity.pet).toBe(0);
  });

  it('converts duplicate items to style dust instead of duplicating collection entries', () => {
    const context = setup({ rng: () => 0.01 });
    context.state.economy.inventory['gacha-ticket'] = 1;
    const first = context.system.pull('pet');
    context.state.economy.inventory['gacha-ticket'] = 1;
    const second = context.system.pull('pet');
    expect(second.item.id).toBe(first.item.id);
    expect(second.duplicate).toBe(true);
    expect(context.state.collection.pets).toHaveLength(1);
    expect(context.state.gacha.styleDust).toBeGreaterThan(0);
  });

  it.each([false, 'throw'])('rolls back ticket, pity, collection and dust when save is %s', (mode) => {
    const context = setup({ save: false });
    if (mode === 'throw') context.saveManager.save.mockImplementation(() => { throw new Error('quota'); });
    context.state.economy.inventory['gacha-ticket'] = 1;
    const before = structuredClone(context.state);
    const events = [];
    context.eventBus.on('gacha:pull', (payload) => events.push(payload));
    expect(context.system.pull('pet')).toMatchObject({ ok: false, code: 'save-failed' });
    expect(context.state).toEqual(before);
    expect(events).toEqual([]);
  });

  it('does not rollback or repeat a committed pull when a listener throws', () => {
    const context = setup();
    context.state.economy.inventory['gacha-ticket'] = 1;
    const seen = [];
    context.eventBus.on('gacha:pull', () => { throw new Error('observer'); });
    context.eventBus.on('gacha:pull', (payload) => seen.push(payload.item.id));
    expect(context.system.pull('pet').ok).toBe(true);
    expect(seen).toHaveLength(1);
    expect(context.state.economy.inventory['gacha-ticket']).toBe(0);
  });

  it('supports a coin pull when no ticket is supplied', () => {
    const context = setup({ rng: () => 0.01 });
    context.state.economy.coin = GACHA_POOLS.wardrobe.coinCost;
    const result = context.system.pull('wardrobe', { currency: 'coin' });
    expect(result).toMatchObject({ ok: true, currency: 'coin' });
    expect(context.state.economy.coin).toBe(0);
  });
});

describe('Pet and collection UIs', () => {
  it('follows the player with a bounded smooth offset and mounts collection controls', () => {
    const followed = followTarget({ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 2 }, 0.5);
    expect(followed.x).toBeGreaterThan(0);
    expect(followed.x).toBeLessThan(2);
    const scene = { add: vi.fn() };
    const pet = new Pet({ scene, petId: 'pet-mossbun', position: { x: 0, y: 0, z: 0 } });
    pet.update(0.1, { x: 2, y: 0, z: 2 });
    expect(pet.position.x).toBeGreaterThan(0);
    expect(pet.position.x).toBeLessThan(2);
    pet.dispose();

    document.body.innerHTML = '<main id="app"></main>';
    const state = createInitialState();
    state.collection.pets.push('pet-mossbun');
    state.economy.inventory['gacha-ticket'] = 1;
    const system = new GachaSystem({ state, saveManager: { save: () => true } });
    const gacha = new GachaUI({ container: document.querySelector('#app'), gachaSystem: system });
    const wardrobe = new WardrobeUI({ container: document.querySelector('#app'), state, player: { updateAppearance: vi.fn() }, saveManager: { save: () => true } });
    expect(document.querySelector('[data-gacha-pool="pet"]')).not.toBeNull();
    expect(document.querySelector('[data-gacha-rates]')).not.toBeNull();
    expect(document.querySelector('[data-wardrobe-item="pet-mossbun"]')).not.toBeNull();
    gacha.dispose();
    wardrobe.dispose();
  });

  it('equips owned wardrobe pieces, updates the shared character factory, and persists the choice', () => {
    const state = createInitialState();
    const player = { updateAppearance: vi.fn() };
    const saveManager = { save: vi.fn(() => true) };
    const ui = new WardrobeUI({ container: document.body, state, player, saveManager });
    state.collection.wardrobe.push('wardrobe-hair-cloud-curls');
    ui.refresh();
    const button = ui.element.querySelector('[data-wardrobe-item="wardrobe-hair-cloud-curls"]');
    button.click();
    expect(state.collection.equipped.wardrobe.hair).toBe('wardrobe-hair-cloud-curls');
    expect(player.updateAppearance).toHaveBeenCalled();
    expect(saveManager.save).toHaveBeenCalledTimes(1);

    const factory = new CharacterFactory();
    const root = factory.create({ ...state.player.appearance, hairStyle: 'cloud-curls' });
    expect(root.userData.appearance.hairStyle).toBe('meadow-bob');
    factory.dispose();
    ui.dispose();
  });
});
