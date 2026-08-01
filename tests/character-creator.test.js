/* @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../src/game/createState.js';
import { CharacterCreator, sanitizePlayerName } from '../src/ui/CharacterCreator.js';
import { CHARACTER_OPTIONS, DEFAULT_APPEARANCE, normalizeAppearance } from '../src/visuals/CharacterFactory.js';

describe('character creator name sanitation', () => {
  it('removes markup/control characters, collapses spaces, and limits length', () => {
    expect(sanitizePlayerName('  <b>Meadow\u0000   Friend</b>  ')).toBe('bMeadow Friendb');
    expect(sanitizePlayerName('A'.repeat(40))).toHaveLength(20);
    expect(sanitizePlayerName('   ')).toBe('New Gardener');
  });
});

describe('character appearance options', () => {
  it('uses catalog defaults for arbitrary and legacy invalid option values', () => {
    expect(normalizeAppearance({
      skinTone: '#abcdef',
      hairStyle: 'wardrobe-hair-not-real',
      hairColor: '#123456',
      top: '#654321',
      bottom: '#fedcba',
      shoes: '#123456',
      accessory: 'legacy-hat',
    })).toEqual(DEFAULT_APPEARANCE);
  });

  it('accepts every catalog option and migrates the legacy default hair id', () => {
    for (const [group, key] of Object.entries({
      skinTones: 'skinTone', hairStyles: 'hairStyle', hairColors: 'hairColor', tops: 'top', bottoms: 'bottom',
      shoes: 'shoes', accessories: 'accessory',
    })) {
      for (const { value } of CHARACTER_OPTIONS[group]) {
        expect(normalizeAppearance({ [key]: value })[key]).toBe(value);
      }
    }
    expect(normalizeAppearance({ hairStyle: 'wardrobe-hair-meadow-bob' }).hairStyle).toBe('meadow-bob');
  });
});

function createCreator(saveResult) {
  document.body.innerHTML = '<button id="return-focus">Open creator</button><main id="app"></main>';
  const previousFocus = document.querySelector('#return-focus');
  previousFocus.focus();
  const state = createInitialState();
  const player = { updateAppearance: vi.fn() };
  const eventBus = { emit: vi.fn() };
  const saveManager = { save: vi.fn(() => saveResult), lastStatus: saveResult ? 'saved' : 'error' };
  const onComplete = vi.fn();
  const creator = new CharacterCreator({
    container: document.querySelector('#app'), state, player, eventBus, saveManager, onComplete,
  });
  return { creator, state, player, eventBus, saveManager, onComplete, previousFocus };
}

describe('CharacterCreator confirmation', () => {
  it('renders all seven labeled groups with exactly one checked radio for invalid saved appearance', () => {
    const { creator, state } = createCreator(true);
    state.player.appearance = {
      skinTone: '#ffffff', hairStyle: 'unknown', hairColor: '#000000', top: 'bad', bottom: null,
      shoes: '#ffffff', accessory: 'unknown',
    };
    creator.dispose();
    const replacement = new CharacterCreator({
      container: document.querySelector('#app'), state, player: { updateAppearance: vi.fn() },
    });

    const groups = [...document.querySelectorAll('[role="radiogroup"]')];
    expect(groups).toHaveLength(7);
    expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual([
      'Skin tone', 'Hair style', 'Hair color', 'Favorite top', 'Bottoms', 'Shoes', 'Accessory',
    ]);
    groups.forEach((group) => {
      expect(group.querySelectorAll('[role="radio"][aria-checked="true"]')).toHaveLength(1);
    });
    replacement.dispose();
  });

  it('updates shoes and accessories live and supports arrow-key selection', () => {
    const { creator, player } = createCreator(true);
    const shoes = document.querySelector('[data-options="shoes"]');
    const accessory = document.querySelector('[data-options="accessories"]');
    const glasses = accessory.querySelector('[data-value="round-glasses"]');

    glasses.click();
    expect(player.updateAppearance).toHaveBeenLastCalledWith(
      expect.objectContaining({ accessory: 'round-glasses' }), { syncState: false },
    );

    const selectedShoe = shoes.querySelector('[aria-checked="true"]');
    selectedShoe.focus();
    selectedShoe.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(shoes.querySelector('[aria-checked="true"]')).not.toBe(selectedShoe);
    expect(document.activeElement).toBe(shoes.querySelector('[aria-checked="true"]'));
    creator.dispose();
  });

  it('rolls back state and the live character without completion when persistence fails', () => {
    const { creator, state, player, eventBus, onComplete } = createCreator(false);
    const original = structuredClone(state.player);
    creator.nameInput.value = 'Mira';
    document.querySelector('[data-options="accessories"] [data-value="round-glasses"]').click();

    expect(creator.confirm()).toBe(false);
    expect(state.player).toEqual(original);
    expect(player.updateAppearance).toHaveBeenLastCalledWith(original.appearance, { syncState: false });
    expect(document.querySelector('.creator-overlay')).not.toBeNull();
    expect(document.querySelector('.creator-status').textContent).toMatch(/save/i);
    expect(document.querySelector('.creator-status').getAttribute('role')).toBe('alert');
    expect(eventBus.emit).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('rolls back thrown save errors and allows a successful retry', () => {
    const { creator, state, player, eventBus, saveManager, onComplete } = createCreator(false);
    const original = structuredClone(state.player);
    saveManager.save
      .mockImplementationOnce(() => { throw new Error('storage unavailable'); })
      .mockReturnValueOnce(true);
    creator.nameInput.value = 'Mira';

    expect(creator.confirm()).toBe(false);
    expect(state.player).toEqual(original);
    expect(player.updateAppearance).toHaveBeenLastCalledWith(original.appearance, { syncState: false });
    expect(eventBus.emit).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();

    expect(creator.confirm()).toBe(true);
    expect(saveManager.save).toHaveBeenCalledTimes(2);
    expect(state.player).toEqual(expect.objectContaining({ name: 'Mira', creatorComplete: true }));
    expect(eventBus.emit).toHaveBeenCalledOnce();
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('persists before completing, emits once, removes the dialog, and restores focus', () => {
    const { creator, state, eventBus, saveManager, onComplete, previousFocus } = createCreator(true);
    creator.nameInput.value = 'Mira';

    expect(creator.confirm()).toBe(true);
    expect(creator.confirm()).toBe(false);
    expect(saveManager.save).toHaveBeenCalledTimes(1);
    expect(state.player).toEqual(expect.objectContaining({ name: 'Mira', creatorComplete: true }));
    expect(eventBus.emit).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.creator-overlay')).toBeNull();
    expect(document.activeElement).toBe(previousFocus);
  });
});
